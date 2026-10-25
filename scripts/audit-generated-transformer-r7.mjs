// Independent numerical checks of immutable generated code. Never fixes the
// artifact or substitutes expected numbers into the rendered result.
import {readFile,writeFile} from 'node:fs/promises'
import {getQuickJS} from 'quickjs-emscripten'
import {evaluate} from '../shared/cardspec/expression.mjs'
import {executeLogic} from '../shared/cardspec/logic-engine.mjs'
const root='artifacts/javascript-upgrade',record=JSON.parse(await readFile(root+'/deep-baselines-r7/transformer.json','utf8'))
const node=record.output.spec.children.find(n=>n.type==='logic'),source=evaluate(node.props.source,{}),initial=evaluate(node.props.initial,{})
const vm=await getQuickJS(),run=(state,event)=>executeLogic(vm,{source,state,event})
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0)
const mm=(a,b)=>a.map(row=>b[0].map((_,j)=>dot(row,b.map(r=>r[j]))))
const norm=v=>{const mean=v.reduce((s,x)=>s+x,0)/v.length;const variance=v.reduce((s,x)=>s+(x-mean)**2,0)/v.length;return v.map(x=>(x-mean)/Math.sqrt(variance+1e-5))}
const add=(a,b)=>a.map((r,i)=>r.map((x,j)=>x+b[i][j]))
const softmax=v=>{const ex=v.map(x=>Math.exp(x-Math.max(...v))),sum=ex.reduce((s,x)=>s+x,0);return ex.map(x=>x/sum)}
const err=(a,b)=>Math.max(...a.flat().map((x,i)=>Math.abs(x-b.flat()[i])))
const oracle=s=>{
 const x=s.toks.map(t=>t.x),ln=x.map(norm),q=mm(ln,s.Wq),k=mm(ln,s.Wk),v=mm(ln,s.Wv)
 const probs=q.map(row=>softmax(k.map(key=>dot(row,key)/Math.sqrt(key.length)))),attn=mm(probs,v)
 const h=s.useAttnRes?add(x,attn):attn
 const pre=mm(h.map(norm),s.W1).map(r=>r.map((x,j)=>x+s.b1[j]))
 const act=pre.map(r=>r.map(x=>.5*x*(1+Math.tanh(Math.sqrt(2/Math.PI)*(x+.044715*x**3)))))
 const ffn=mm(act,s.W2).map(r=>r.map((x,j)=>x+s.b2[j])),y=s.useFfnRes?add(h,ffn):ffn
 return {probs,attn,h,pre,act,ffn,y}
}
const initialized=run(initial,{type:'init'}),selected=run(initialized,{type:'pickTok',args:1}),changed=run(selected,{type:'dim',value:-.7}),reset=run(changed,{type:'reset'})
const weights=s=>JSON.stringify([s.Wq,s.Wk,s.Wv,s.W1,s.b1,s.W2,s.b2])
const checks=[
 {name:'scalar event arguments select the requested token',passed:selected.selToken===1},
 {name:'input edit changes only selected token input and recomputes output',passed:changed.toks[1].x[0]===-.7&&changed.toks[0].x[0]===1&&JSON.stringify(changed.y)!==JSON.stringify(selected.y)},
 {name:'input edits do not change trained weights',passed:weights(changed)===weights(initialized)},
 {name:'reset restores original numeric output',passed:JSON.stringify(reset.y)===JSON.stringify(initialized.y)},
 {name:'serialized restored state continues identically',passed:JSON.stringify(run(JSON.parse(JSON.stringify(selected)),{type:'dim',value:-.7}))===JSON.stringify(changed)},
]
const numerics=[]
for(const start of [initialized,changed])for(const useAttnRes of [true,false])for(const useFfnRes of [true,false]){
 let s=run(start,{type:'attnRes',checked:useAttnRes});s=run(s,{type:'ffnRes',checked:useFfnRes})
 const expected=oracle(s),errors=Object.fromEntries(Object.keys(expected).map(k=>[k,err(s[k],expected[k])]))
 numerics.push({changed:start===changed,useAttnRes,useFfnRes,errors})
}
checks.push({name:'attention probabilities and weighted values match independent oracle',passed:numerics.every(r=>r.errors.probs<1e-9&&r.errors.attn<1e-9)})
checks.push({name:'residual and FFN match H5 Pre-LN baseline across edits and toggles',passed:numerics.every(r=>Object.values(r.errors).every(e=>e<1e-9))})
const result={at:new Date().toISOString(),sourceHash:record.result.sourceHash,checks,numerics,scope:'Immutable R7 artifact; generated weights, independent H5 Pre-LN algorithm, actual isolated QuickJS. No browser/layout/live tool claim.',finding:'Generated code adds normalized input instead of original input on the attention residual and omits normalization before FFN. This is model algorithm/architecture fidelity, not an expression parser failure; do not silently repair the business math.'}
await writeFile(root+'/transformer-r7-audit.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
