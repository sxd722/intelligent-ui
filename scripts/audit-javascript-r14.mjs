// Independently recompute immutable generated logic. No model/CLI calls and no
// repairs to the generated source. Self-consistency and baseline parity differ.
import {readFile,writeFile} from 'node:fs/promises'
import {getQuickJS} from 'quickjs-emscripten'
import {evaluate} from '../shared/cardspec/expression.mjs'
import {executeLogic} from '../shared/cardspec/logic-engine.mjs'
const root='artifacts/javascript-upgrade'
const record=JSON.parse(await readFile(`${root}/deep-baselines-r14/transformer.json`,'utf8'))
const logic=record.output.spec.children.find(n=>n.type==='logic')
const source=evaluate(logic.props.source,{}),initial=evaluate(logic.props.initial,{})
const vm=await getQuickJS(),run=(state,event)=>executeLogic(vm,{source,state,event})
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0)
const mm=(a,b)=>a.map(row=>b[0].map((_,j)=>dot(row,b.map(r=>r[j]))))
const norm=a=>{const m=a.reduce((s,x)=>s+x,0)/a.length,v=a.reduce((s,x)=>s+(x-m)**2,0)/a.length;return a.map(x=>(x-m)/Math.sqrt(v+1e-5))}
const softmax=a=>{const e=a.map(x=>Math.exp(x-Math.max(...a))),s=e.reduce((s,x)=>s+x,0);return e.map(x=>x/s)}
const gelu=x=>.5*x*(1+Math.tanh(Math.sqrt(2/Math.PI)*(x+.044715*x**3)))
const add=(a,b)=>a.map((r,i)=>r.map((x,j)=>x+b[i][j]))
function oracle(s,scaled){
 const Ln=s.X.map(norm),Q=mm(Ln,s.Wq),K=mm(Ln,s.Wk),V=mm(Ln,s.Wv)
 const A=Q.map(q=>softmax(K.map(k=>dot(q,k)/(scaled?Math.sqrt(q.length):1)))),attn=mm(A,V)
 const H=s.res1?add(s.X,attn):attn,Lh=H.map(norm)
 const hid=mm(Lh,s.W1).map(r=>r.map((x,j)=>x+s.b1[j])),act=hid.map(r=>r.map(gelu))
 const ffn=mm(act,s.W2).map(r=>r.map((x,j)=>x+s.b2[j])),Y=s.res2?add(H,ffn):ffn
 return {Ln,Q,K,V,A,attn,H,Lh,hid,act,ffn,Y}
}
const errors=(state,expected)=>Object.fromEntries(Object.entries(expected).map(([key,matrix])=>[key,Math.max(...matrix.flat().map((x,i)=>Math.abs(x-state[key].flat()[i])))]))
const init=run(initial,{type:'init'}),numerics=[]
for(const value of [-2,0.5,1,2])for(const res1 of [false,true])for(const res2 of [false,true]){
 const state=run(run(run(init,{type:'xslider',value}),{type:'tres1',checked:res1}),{type:'tres2',checked:res2})
 numerics.push({value,res1,res2,selfConsistency:errors(state,oracle(state,false)),scaledBaseline:errors(state,oracle(state,true))})
}
const changed=run(init,{type:'xslider',value:-2}),selected=run(changed,{type:'pickCell',rowId:'t2',columnId:'n3'})
const checks=[
 {name:'same-event input recalculates output',passed:changed.X[0][0]===-2&&JSON.stringify(changed.Y)!==JSON.stringify(init.Y)},
 {name:'matrix selection carries token and neuron across stages',passed:run(selected,{type:'stage',value:'FFN'}).selToken===2&&selected.selNeuron===3},
 {name:'reset restores initialized state',passed:JSON.stringify(run(selected,{type:'reset'}))===JSON.stringify(init)},
 {name:'serialization preserves next event result',passed:JSON.stringify(run(JSON.parse(JSON.stringify(selected)),{type:'tres1',checked:false}))===JSON.stringify(run(selected,{type:'tres1',checked:false}))},
 {name:'generated displayed unscaled formula is numerically self-consistent',passed:numerics.every(n=>Object.values(n.selfConsistency).every(x=>x<1e-9))},
 {name:'standard scaled dot-product attention baseline parity',passed:numerics.every(n=>Object.values(n.scaledBaseline).every(x=>x<1e-9))},
]
const report={at:new Date().toISOString(),sourceHash:record.result.sourceHash,scope:'Original R14 GLM source; 16 independent numerical combinations; no browser, real tools or full visual parity claim.',checks,numerics,finding:'LayerNorm is now correct. Displayed and implemented attention both omit 1/sqrt(d_k); self-consistency does not establish standard Transformer baseline parity.'}
await writeFile(`${root}/r14-semantic-audit.json`,JSON.stringify(report,null,2))
console.log(JSON.stringify({checks,maxScaledError:Math.max(...numerics.flatMap(n=>Object.values(n.scaledBaseline)))},null,2))
