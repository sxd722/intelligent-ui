import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {getQuickJS} from 'quickjs-emscripten'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {evaluate} from '../shared/cardspec/expression.mjs'
import {makeScope,createStore} from '../shared/cardspec/store.mjs'
import {executeLogic} from '../shared/cardspec/logic-engine.mjs'
import {logicTickMs} from '../shared/cardspec/logic-contract.mjs'
import {validateLogicView} from '../shared/cardspec/logic-view.mjs'
const QuickJS=await getQuickJS(),results=[]
for(const id of ['order','greenhouse']){
 const raw=JSON.parse(await readFile(`artifacts/logic-qa/${id}.json`,'utf8')),compiled=compileCard(raw.source,{final:true})
 assert.equal(compiled.complete,true,JSON.stringify(compiled.diagnostics))
 const spec=compiled.spec,scope=makeScope(spec,createStore()),node=spec.children.find(n=>n.type==='logic')
 assert.ok(node,'model must actually use the new module')
 const p=Object.fromEntries(Object.entries(node.props).map(([k,v])=>[k,evaluate(v,scope)]))
 let state=p.initial
 const step=event=>{const next=executeLogic(QuickJS,{source:p.source,state,event,input:p.input||{}});validateLogicView(node.children,{...scope,local:next});state=next}
 if(id==='order'){
  step({type:'qty',value:3});step({type:'price',value:12});step({type:'next'});assert.equal(state.total,36)
  step({type:'confirm'});step({type:'again'});step({type:'qty',value:9});assert.equal(state.receipts[0].qty,3);assert.equal(state.receipts[0].total,36)
  results.push({id,status:'passed',receipt:state.receipts[0],generationRepairs:raw.metadata.repair_count})
 }else{
  assert.equal(logicTickMs(p.source,p.tickMs),500)
  for(let i=0;i<5;i++)step({type:'tick',dt:500});step({type:'save'});const saved=structuredClone(state.snapshots[0])
  for(let i=0;i<5;i++)step({type:'tick',dt:500});assert.deepEqual(state.snapshots[0],saved);assert.notEqual(state.temp,saved.temp)
  step({type:'load',args:{id:saved.id}});assert.equal(state.temp,saved.temp)
  let boundary
  for(let i=0;i<50;i++)try{step({type:'tick',dt:500})}catch(e){boundary={message:e.message,retainedSteps:state.steps,retainedPoints:state.history.length};break}
  assert.equal(boundary.retainedPoints,40)
  results.push({id,status:'core interactions passed; model capacity defect contained',tickMs:500,generationRepairs:raw.metadata.repair_count,boundary})
 }
}
await writeFile('artifacts/logic-qa/model-replay.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results))
