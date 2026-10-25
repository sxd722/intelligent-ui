import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {getQuickJS} from 'quickjs-emscripten'
import {evaluate} from '../shared/cardspec/expression.mjs'
import {executeLogic} from '../shared/cardspec/logic-engine.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
import {observableContent} from '../shared/cardspec/feedback-diagnostics.mjs'
import {toolResultDiagnostics} from '../shared/cardspec/tool-result-diagnostics.mjs'
import {fixtureValue} from '../shared/cardspec/baselines/fixtures.mjs'

const root='artifacts/javascript-upgrade',read=async id=>JSON.parse(await readFile(`${root}/deep-baselines-r13/${id}.json`,'utf8'))
const records=await Promise.all(['sentiment','family','movies','transformer','trains'].map(read))
const consumption=records.map(r=>({id:r.result.id,sourceHash:r.result.sourceHash,warnings:toolResultDiagnostics(r.output.spec)}))
const sentiment=records[0],s=sentiment.output.spec,store=createStore();makeScope(s,store)
executeAction(s,store,'setView',{event:{value:'list'}})
const before=observableContent(s,store),bindingResults={}
for(const [id,b]of Object.entries(s.bindings)){
 const value=fixtureValue(b.tool,evaluate(b.input,makeScope(s,store)))
 value.items=value.items.map(row=>({...row,title:'刷新验证新标题',content:'新获取的原文'}))
 bindingResults[id]={value,status:'success',updatedAt:new Date().toISOString()}
}
const after=observableContent(s,store,{bindings:bindingResults})
const sentimentRows=makeScope(s,store).data.rows
const sentimentChecks=[
 {name:'fresh tool results change original-source card content',passed:before!==after},
 {name:'attitude statistics denominator excludes news events',passed:sentimentRows.every(r=>r.kind==='用户反馈'),detail:'Generated stats iterate all data.rows; includes news/video rows, so denominator is not user feedback.'},
]

const tf=records[3],node=tf.output.spec.children.find(n=>n.type==='logic'),source=evaluate(node.props.source,{}),initial=evaluate(node.props.initial,{})
const vm=await getQuickJS(),run=(state,event)=>executeLogic(vm,{source,state,event})
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0),mm=(a,b)=>a.map(row=>b[0].map((_,j)=>dot(row,b.map(r=>r[j]))))
const norm=a=>{const mean=a.reduce((s,x)=>s+x,0)/a.length,v=a.reduce((s,x)=>s+(x-mean)**2,0)/a.length;return a.map(x=>(x-mean)/Math.sqrt(v+1e-5))}
const softmax=a=>{const e=a.map(x=>Math.exp(x-Math.max(...a))),sum=e.reduce((s,x)=>s+x,0);return e.map(x=>x/sum)}
const gelu=x=>.5*x*(1+Math.tanh(Math.sqrt(2/Math.PI)*(x+.044715*x**3)))
const add=(a,b)=>a.map((r,i)=>r.map((x,j)=>x+b[i][j]))
function oracle(s){
 const lnX=s.x.map(norm),q=mm(lnX,s.Wq),k=mm(lnX,s.Wk),v=mm(lnX,s.Wv)
 const attn=q.map(row=>softmax(k.map(key=>dot(row,key)/Math.sqrt(row.length)))),attnOut=mm(attn,v)
 const h=s.resA?add(s.x,attnOut):attnOut,lnH=h.map(norm)
 const pre=mm(lnH,s.W1).map(row=>row.map((x,j)=>x+s.b1[j])),hidden=pre.map(row=>row.map(gelu))
 const ffnOut=mm(hidden,s.W2).map(row=>row.map((x,j)=>x+s.b2[j])),y=s.resF?add(h,ffnOut):ffnOut
 return {lnX,q,k,v,attn,attnOut,h,lnH,pre,hidden,ffnOut,y}
}
const init=run(initial,{type:'init'}),selected=run(init,{type:'tok',value:'1'}),changed=run(selected,{type:'slide',value:.9}),reset=run(changed,{type:'reset'})
const numerics=[]
for(const start of [init,changed])for(const resA of [true,false])for(const resF of [true,false]){
 const state=run(run(start,{type:'resA',checked:resA}),{type:'resF',checked:resF}),expected=oracle(state)
 numerics.push({edited:start===changed,resA,resF,errors:Object.fromEntries(Object.entries(expected).map(([k,v])=>[k,Math.max(...v.flat().map((x,i)=>Math.abs(x-state[k].flat()[i])))]))})
}
const mathChecks=[
 {name:'selected token edit recalculates same-event output',passed:changed.x[1][0]===.9&&JSON.stringify(changed.y)!==JSON.stringify(selected.y)},
 {name:'reset restores original output',passed:JSON.stringify(reset.y)===JSON.stringify(init.y)},
 {name:'serialization preserves next event semantics',passed:JSON.stringify(run(JSON.parse(JSON.stringify(selected)),{type:'slide',value:.9}))===JSON.stringify(changed)},
 {name:'stated LayerNorm, scaled attention and Pre-LN FFN match independent oracle',passed:numerics.every(n=>Object.values(n.errors).every(e=>e<.000501))},
]
const report={at:new Date().toISOString(),scope:'Immutable R13 model sources, controlled results and isolated numerical audit. No live tools or complete UI parity claim.',consumption,sentiment:{sourceHash:sentiment.result.sourceHash,checks:sentimentChecks,contentHashBefore:createHash('sha256').update(before).digest('hex'),contentHashAfter:createHash('sha256').update(after).digest('hex'),userRows:sentimentRows.filter(r=>r.kind==='用户反馈').length,totalRows:sentimentRows.length},transformer:{sourceHash:tf.result.sourceHash,checks:mathChecks,numerics,finding:'Generated ln computes variance around mean but returns x/sigma instead of (x-mean)/sigma, contradicting its own displayed formula. Source has not been rewritten.'}}
await writeFile(root+'/r13-semantic-audit.json',JSON.stringify(report,null,2))
console.log(JSON.stringify({consumption:consumption.map(r=>({id:r.id,unconsumed:r.warnings.length})),sentiment:sentimentChecks,transformer:mathChecks,maxNumericalError:Math.max(...numerics.flatMap(n=>Object.values(n.errors)))},null,2))
