// Independent audit of immutable generated code. Never rewrites its algorithm.
import {readFile,writeFile} from 'node:fs/promises'
import {getQuickJS} from 'quickjs-emscripten'
import {evaluate} from '../shared/cardspec/expression.mjs'
import {executeLogic} from '../shared/cardspec/logic-engine.mjs'
const root='artifacts/javascript-upgrade',record=JSON.parse(await readFile(root+'/deep-baselines-r11/transformer.json','utf8'))
const node=record.output.spec.children.find(n=>n.type==='logic'),source=evaluate(node.props.source,{}),initial=evaluate(node.props.initial,{})
const vm=await getQuickJS(),run=(state,event)=>executeLogic(vm,{source,state,event})
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0)
const norm=a=>{const m=a.reduce((s,x)=>s+x,0)/a.length,v=a.reduce((s,x)=>s+(x-m)**2,0)/a.length;return a.map(x=>(x-m)/Math.sqrt(v+1e-5))}
const softmax=a=>{const e=a.map(x=>Math.exp(x-Math.max(...a))),s=e.reduce((s,x)=>s+x,0);return e.map(x=>x/s)}
const gelu=x=>.5*x*(1+Math.tanh(Math.sqrt(2/Math.PI)*(x+.044715*x**3)))
const add=(a,b)=>a.map((r,i)=>r.map((x,j)=>x+b[i][j]))
const err=(a,b)=>Math.max(...a.flat().map((x,i)=>Math.abs(x-b.flat()[i])))
function oracle(s,scaled){
 const X=[[s.x00,-.5],[.5,1],[-1,.3]],L=X.map(norm)
 // Generated matrices use column-vector Q/K/V convention; preserve it.
 const project=W=>L.map(x=>W.map(row=>dot(row,x))),Q=project(s.Wq),K=project(s.Wk),V=project(s.Wv)
 const A=Q.map(q=>softmax(K.map(k=>dot(q,k)/(scaled?Math.sqrt(q.length):1))))
 const attn=A.map(row=>V[0].map((_,j)=>dot(row,V.map(v=>v[j]))))
 const H=s.resAttn?add(X,attn):attn,U=H.map(norm)
 const Z=U.map(u=>s.b1.map((b,j)=>dot(u,s.W1.map(row=>row[j]))+b)),Act=Z.map(row=>row.map(gelu))
 const O=Act.map(a=>s.W2.map((row,j)=>dot(row,a)+s.b2[j])),Y=s.resFfn?add(H,O):O
 return {X,L,A,attn,H,U,Z,Act,O,Y}
}
const init=run(initial,{type:'init'}),selected=run(init,{type:'tk',value:'1'}),changed=run(selected,{type:'xv',value:-.7}),reset=run(changed,{type:'rst'})
const weights=s=>JSON.stringify([s.Wq,s.Wk,s.Wv,s.W1,s.W2,s.b1,s.b2])
const numerics=[]
for(const start of [init,changed])for(const resAttn of [true,false])for(const resFfn of [true,false]){
 let s=run(start,{type:'ra',checked:resAttn});s=run(s,{type:'rf',checked:resFfn})
 const own=oracle(s,false),baseline=oracle(s,true)
 numerics.push({changed:start===changed,resAttn,resFfn,declaredErrors:Object.fromEntries(Object.keys(own).map(k=>[k,err(s[k],own[k])])),baselineErrors:Object.fromEntries(Object.keys(baseline).map(k=>[k,err(s[k],baseline[k])]))})
}
const checks=[
 {name:'token selection and neuron selection update current inspection',passed:selected.tok===1&&run(selected,{type:'pickNeu',id:'n2'}).neu===2},
 {name:'editing input recomputes output in the same event',passed:changed.X[0][0]===-.7&&JSON.stringify(changed.Y)!==JSON.stringify(selected.Y)},
 {name:'weights remain fixed across edits',passed:weights(changed)===weights(init)},
 {name:'reset restores initial numeric output',passed:JSON.stringify(reset.Y)===JSON.stringify(init.Y)},
 {name:'serialized state continues identically',passed:JSON.stringify(run(JSON.parse(JSON.stringify(selected)),{type:'xv',value:-.7}))===JSON.stringify(changed)},
 {name:'generated declared unscaled formula is internally consistent (3 decimal display)',passed:numerics.every(r=>Object.values(r.declaredErrors).every(x=>x<=.000501))},
 {name:'matches H5 scaled-dot-product Pre-LN baseline (3 decimal display)',passed:numerics.every(r=>Object.values(r.baselineErrors).every(x=>x<=.000501))},
]
const report={at:new Date().toISOString(),sourceHash:record.result.sourceHash,checks,numerics,scope:'Immutable R11 source; isolated QuickJS, independent oracle, generated weight orientation. No UI/layout/live tool claim.',finding:'Both Pre-LN sites and residual toggle semantics now match the baseline structure. Generated attention explicitly omits sqrt(d_k) scaling. Internal consistency does not establish H5 algorithm parity.'}
await writeFile(root+'/transformer-r11-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify({checks,numerics:numerics.map(r=>({changed:r.changed,resAttn:r.resAttn,resFfn:r.resFfn,maxDeclared:Math.max(...Object.values(r.declaredErrors)),maxBaseline:Math.max(...Object.values(r.baselineErrors))}))},null,2))
