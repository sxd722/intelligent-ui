// An audit of an immutable model artifact, not a production special case or
// a replacement implementation. Oracle follows the H5 baseline's Pre-LN order
// using the generated model's own weights and dimensions.
import {readFile,writeFile} from 'node:fs/promises'
import {getQuickJS} from 'quickjs-emscripten'
import {evaluate} from '../shared/cardspec/expression.mjs'
import {executeLogic} from '../shared/cardspec/logic-engine.mjs'
const record=JSON.parse(await readFile('artifacts/javascript-upgrade/deep-baselines/transformer.json','utf8'))
const logic=record.output.spec.children.find(n=>n.type==='logic'),QuickJS=await getQuickJS()
const source=evaluate(logic.props.source,{}),initial=evaluate(logic.props.initial,{})
const run=(state,event)=>executeLogic(QuickJS,{source,state,event,input:{}})
const initialized=run(initial,{type:'init'}),selected=run(initialized,{type:'pickH',rowId:'t1',columnId:'n1'}),changed=run(selected,{type:'dial',value:-.7}),reset=run(changed,{type:'reset'})
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0)
const multiply=(a,b)=>a.map(row=>b[0].map((_,j)=>dot(row,b.map(r=>r[j]))))
const normalize=row=>{const mean=row.reduce((s,x)=>s+x,0)/row.length;const variance=row.reduce((s,x)=>s+(x-mean)**2,0)/row.length;return row.map(x=>(x-mean)/Math.sqrt(variance+1e-5))}
const plus=(a,b)=>a.map((r,i)=>r.map((x,j)=>x+b[i][j]))
const softmax=values=>{const max=Math.max(...values),exps=values.map(x=>Math.exp(x-max)),sum=exps.reduce((s,x)=>s+x,0);return exps.map(x=>x/sum)}
const w=initialized.w,X=initialized.x,normalized=X.map(normalize),q=multiply(normalized,w.Wq),k=multiply(normalized,w.Wk),v=multiply(normalized,w.Wv)
const attention=q.map(row=>softmax(k.map(key=>dot(row,key)/Math.sqrt(key.length))))
const attentionOutput=multiply(attention,v),residual=plus(X,attentionOutput)
const hidden=multiply(residual.map(normalize),w.W1).map(row=>row.map((x,j)=>{const z=x+w.b1[j];return .5*z*(1+Math.tanh(Math.sqrt(2/Math.PI)*(z+.044715*z**3)))}))
const ffn=multiply(hidden,w.W2).map(row=>row.map((x,j)=>x+w.b2[j])),output=plus(residual,ffn)
const error=(a,b)=>Math.max(...a.flat().map((x,i)=>Math.abs(x-b.flat()[i])))
const checks={selectionUpdatesTokenAndNeuron:selected.tok===1&&selected.neuron===1,inputChangesOutput:JSON.stringify(changed.out)!==JSON.stringify(initialized.out),resetRestoresNumerics:JSON.stringify(reset.out)===JSON.stringify(initialized.out),restoredStateContinues:JSON.stringify(run(JSON.parse(JSON.stringify(selected)),{type:'dial',value:-.7}))===JSON.stringify(changed),attentionMatchesOracle:error(initialized.a,attention)<1e-9,attentionRowsSumToOne:initialized.a.every(row=>Math.abs(row.reduce((s,x)=>s+x,0)-1)<1e-9),attentionResidualMatchesPreLN:error(initialized.res1,residual)<1e-9,finalOutputMatchesPreLN:error(initialized.out,output)<1e-9}
const result={artifactHash:record.result.sourceHash,checks,errors:{attention:error(initialized.a,attention),attentionResidual:error(initialized.res1,residual),finalOutput:error(initialized.out,output)},expected:{residual,output},actual:{residual:initialized.res1,output:initialized.out},conclusion:'Interactions and normalization of attention are functional; numerical parity is NOT achieved. Model source adds normalized input to attention and omits normalization before FFN. Do not count this artifact as baseline-equivalent.'}
await writeFile('artifacts/javascript-upgrade/transformer-r1-audit.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
