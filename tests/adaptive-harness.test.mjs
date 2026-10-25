import test from 'node:test'
import assert from 'node:assert/strict'
import {createGenerationBudget,generationPolicy,leaseBudget,inheritedBudget} from '../server/cardspec/budget.mjs'
import {runReadWorkflow} from '../server/cardspec/workflow.mjs'
import {datasetAggregate,validateAnnotations,datasetDescriptor} from '../server/cardspec/datasets.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {createResearchSession} from '../server/research/session.mjs'
import {cardGenerationPrompt} from '../server/cardspec/prompt.mjs'
import {TOOLS} from '../shared/cardspec/tools.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {executeAction,createStore,makeScope} from '../shared/cardspec/store.mjs'
import {compositionRows,selectRecords,toggleSelection,projectPoints} from '../shared/cardspec/composition.mjs'
import {createNumeric} from '../shared/cardspec/numeric.mjs'
import {executeLogic} from '../shared/cardspec/logic-engine.mjs'
import {getQuickJS} from 'quickjs-emscripten'
import {executeHostWorkflow} from '../server/cardspec/host-workflow.mjs'
import {toolDiscoveryReference} from '../shared/cardspec/tool-discovery.mjs'
import {saveCheckpoint,loadCheckpoint} from '../server/cardspec/checkpoints.mjs'
import {mkdtemp,unlink,rmdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {analysisInput} from '../server/cardspec/datasets.mjs'
import {validateWidget} from '../shared/cardspec/widgets.mjs'
const signal=new AbortController().signal,id='opencli.douban.top250'
const rows=[{id:'a',title:'A',source:'one',attitude:'positive',date:'2026-10-20',content:'确实很喜欢'},{id:'b',title:'B',source:'two',attitude:'negative',date:'2026-10-20',content:'不喜欢'}]
test('calendar allows an explicit unselected state but still rejects impossible dates',()=>{
 for(const selectedDate of ['',undefined,'2028-02-29'])assert.doesNotThrow(()=>validateWidget('calendar',{month:'2028-02',selectedDate}))
 for(const selectedDate of ['2027-02-29','2028-02-30','yesterday'])assert.throws(()=>validateWidget('calendar',{month:'2028-02',selectedDate}))
})
test('classification refuses ambiguous duplicate source IDs',()=>{
 assert.throws(()=>validateAnnotations({value:{items:[rows[0],rows[0]]}},{annotations:[{id:'a',label:'正面',quote:'喜欢'}]}),/unique record IDs/)
})
const record={id:'D1',tool:id,value:{items:rows,source:'fixture',fetchedAt:'2026-10-20T00:00:00Z',truncated:false}}
test('shared budget accounts models, true reads, one repair and inherited sandbox',()=>{
 let time=0;const b=createGenerationBudget(generationPolicy('计数器',{profile:'adaptive-v1'}),{now:()=>time})
 b.model('plan');b.model('code');b.model('sandbox');assert.throws(()=>b.model(),/预算/)
 b.read();b.read();b.read();assert.throws(()=>b.read(),/预算/)
 b.repair();assert.throws(()=>b.repair(),/修复/)
 const lease=leaseBudget(b);assert.equal(inheritedBudget(lease),b)
 time=60001;assert.doesNotThrow(()=>b.check())
 time=300000;assert.throws(()=>b.check(),/时间/)
})
test('time limits allow 300s simple and 900s complex/legacy without extra calls or reads',()=>{
 assert.equal(generationPolicy('舆情监控助手',{profile:'adaptive-v1'}).reads,12)
 assert.equal(generationPolicy('计数器',{profile:'adaptive-v1'}).timeoutMs,300000)
 assert.equal(generationPolicy('舆情监控助手',{profile:'adaptive-v1'}).timeoutMs,900000)
 assert.equal(generationPolicy('计数器').timeoutMs,900000)
})

test('optional nested analysis cannot consume final generation and repair reservations',()=>{
 const budget=createGenerationBudget(generationPolicy('舆情监控助手',{profile:'adaptive-v1'}))
 budget.model('plan');budget.model();budget.model();budget.model('analyze')
 assert.equal(budget.remainingModels(),2);assert.throws(()=>budget.model('analyze'),/预留/);assert.equal(budget.remainingModels(),2)
 budget.model();budget.repair();assert.equal(budget.generationReserve(),1);budget.model();assert.equal(budget.remainingModels(),0)
})

test('research closes optional tools early enough to perform one final repair',async()=>{
 const budget=createGenerationBudget(generationPolicy('舆情监控助手',{profile:'adaptive-v1'}))
 for(let i=0;i<4;i++)budget.model()
 const session=createResearchSession({budget,extensions:createGenerationTools({budget,allowPlanning:false})})
 let calls=0
 const model=async(messages,options)=>{calls++;assert.equal(options.tools,undefined);return {message:{role:'assistant',content:'<card><text>Done</text></card>'}}}
 await session.run(model,[],{signal});assert.equal(budget.remainingModels(),1)
 budget.repair();await session.run(model,[],{signal});assert.equal(calls,2);assert.equal(budget.remainingModels(),0)
})
test('workflow validates DAG before effects, serializes browser, bounds public concurrency',async()=>{
 let calls=0,active=0,max=0
 await assert.rejects(runReadWorkflow({steps:[{id:'a',tool:'x',input:{},after:['b']},{id:'b',tool:'y',input:{},after:['a']}]},()=>calls++,signal),/cycle/)
 assert.equal(calls,0)
 const read=async()=>{calls++;active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,5));active--;return {}}
 await runReadWorkflow({steps:[{id:'a',tool:'opencli.a',input:{}},{id:'b',tool:'opencli.b',input:{}}]},read,signal);assert.equal(max,1)
 max=0;await runReadWorkflow({steps:[{id:'a',tool:'a',input:{}},{id:'b',tool:'b',input:{}},{id:'c',tool:'c',input:{}}]},read,signal);assert.equal(max,2)
})
test('failed dependency prevents reads and is not an empty success',async()=>{
 let calls=0;const r=await runReadWorkflow({steps:[{id:'a',tool:'a',input:{}},{id:'b',tool:'b',input:{},after:['a']}]},()=>{calls++;throw Error('AUTH_REQUIRED')},signal)
 assert.equal(calls,1);assert.equal(r.complete,false);assert.equal(r.steps[1].dataAvailable,false)
})
test('aggregation counts original records and preserves coverage/provenance',()=>{
 const r=datasetAggregate(record,{groupBy:'attitude',timeField:'date'})
 assert.equal(r.items.reduce((n,r)=>n+r.value,0),2);assert.deepEqual(r.items.flatMap(r=>r.recordIds).sort(),['a','b'])
 assert.equal(r.dataset.coverage.complete,null);assert.equal(datasetDescriptor(record).version,datasetDescriptor(structuredClone(record)).version)
 assert.throws(()=>datasetAggregate(record,{groupBy:'invented'}),/unknown/)
})
test('classification rejects fabricated citations, duplicate and unknown references',()=>{
 assert.throws(()=>validateAnnotations(record,{annotations:[{id:'a',label:'positive',quote:'fake'}]}),/source/)
 assert.throws(()=>validateAnnotations(record,{annotations:[{id:'x',label:'positive',quote:'确实'}]}),/unknown/)
 assert.equal(validateAnnotations(record,{annotations:[{id:'a',label:'正面',quote:'很喜欢'}]}).length,1)
})
test('discovery and component schemas do not consume physical read budget',async()=>{
 const budget=createGenerationBudget(generationPolicy('计数器',{profile:'adaptive-v1'}))
 const extensions=createGenerationTools({catalog:[{...TOOLS[id],available:true}],budget,invoke:async()=>({value:record.value})})
 const session=createResearchSession({extensions,budget,maxCalls:3})
 await session.execute('component_describe',{names:['logic']},signal)
 await session.execute('cli_describe',{id},signal)
 await session.execute('cli_read',{id,input:{}},signal)
 await session.execute('cli_read',{id,input:{}},signal)
 assert.equal(budget.snapshot().reads,1)
 const s=await session.execute('dataset_aggregate',{dataset:'D1',groupBy:'attitude'},signal)
 assert.equal(s.totalObserved,2);assert.equal(budget.snapshot().reads,1)
})
test('generic component validates and multiselect action receives complete chosen records',()=>{
 const r=compileCard(`<card><data id="rows" value={${JSON.stringify(rows)}}/><state id="ids" type="array" initial={[]}/><experience id="exp" preset="planner" items={data.rows} facets={["source"]} selectedIds={state.ids} onSelect="pick" onApply="apply"/><action id="pick"><set target="ids" value={event.ids}/></action><action id="apply"><set target="ids" value={event.ids}/></action></card>`,{final:true})
 assert.equal(r.complete,true,JSON.stringify(r.diagnostics))
 const view={query:'',facets:{source:'one'}};assert.equal(compositionRows(rows,view).length,1)
 assert.deepEqual(toggleSelection(['a'],'b'),['a','b']);assert.deepEqual(selectRecords(rows,['b']),[rows[1]])
})
test('map never synthesizes missing coordinates',()=>{
 const p=projectPoints([{id:'a',title:'A',latitude:30,longitude:120},{id:'b',title:'B'},{id:'c',latitude:'30',longitude:'120'}])
 assert.equal(p.length,1);assert.equal(p[0].x,50);assert.equal(p[0].y,50)
})
test('numeric helpers work inside isolated JS and reject dimension mistakes',async()=>{
 const n=createNumeric();assert.deepEqual(n.matmul([[1,2]],[[3],[4]]),[[11]]);assert.throws(()=>n.matmul([[1]],[[1,2],[3,4]]))
 assert.ok(Math.abs(n.softmax([1000,1001]).reduce((a,b)=>a+b,0)-1)<1e-12)
 const result=executeLogic(await getQuickJS(),{source:'function update(state,event,input){state.y=numeric.matmul([[1,2]],[[3],[4]])[0][0];state.network=typeof fetch;return state}',state:{},event:{type:'step'}})
 assert.equal(result.y,11);assert.equal(result.network,'undefined')
})
test('adaptive prompt is smaller and offers schema discovery rather than fixed templates',()=>{
 const old=cardGenerationPrompt(null,{compact:true}),next=cardGenerationPrompt(null,{adaptive:true})
 assert.ok(next.length<old.length*.8,`${next.length}/${old.length}`);assert.match(next,/component_describe/);assert.match(next,/experience/)
})
test('runtime workflow preflights all tools, forbids model recursion and namespaces rows',async()=>{
 let calls=0
 await assert.rejects(executeHostWorkflow('workflow.run',{steps:[{id:'a',tool:id,input:{}},{id:'b',tool:'glm.generate',input:{prompt:'loop'}}]},{signal,invoke:()=>calls++}),/readonly/)
 assert.equal(calls,0)
 const value=await executeHostWorkflow('workflow.run',{steps:[{id:'a',tool:id,input:{}},{id:'b',tool:id,input:{}}]},{signal,invoke:async()=>({value:record.value})})
 assert.equal(new Set(value.items.map(r=>r.rowKey)).size,4);assert.equal(value.truncated,false)
 assert.equal(value.items[0].originalId,'a')
})
test('host classification preserves source fields, counts on host and cannot poll',async()=>{
 const value=await executeHostWorkflow('dataset.analyze',{items:rows,instruction:'分类态度'},{signal,analyze:async()=>({annotations:[{id:'a',label:'正面',quote:'很喜欢'}]})})
 assert.equal(value.items[0].title,'A');assert.deepEqual(value.analysis.counts,{'正面':1,'未分类':1})
 const r=compileCard('<card><binding id="a" tool="dataset.analyze" load="visible" input={{items:[],instruction:"分类"}} initial={{items:[],source:"",fetchedAt:"",truncated:false}}/><text>测试</text></card>',{final:true})
 assert.equal(r.complete,false)
})
test('host tool capability IDs are exact, never invented opencli.host paths',()=>{
 const ref=toolDiscoveryReference(['workflow.run','dataset.analyze'].map(id=>({...TOOLS[id],available:true})))
 assert.match(ref,/"prefix":"workflow\."/);assert.match(ref,/"prefix":"dataset\."/);assert.doesNotMatch(ref,/opencli.host/)
})
test('checkpoint is goal-scoped, expires and restores data without replaying reads',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'cardspec-checkpoint-')),id2=randomUUID()
 try{
  await saveCheckpoint(id2,'原请求',[record],{directory,now:1000})
  assert.equal(await loadCheckpoint(id2,'其他请求',{directory,now:1001}),null)
  assert.equal(await loadCheckpoint('../secret','原请求',{directory,now:1001}),null)
  assert.equal(await loadCheckpoint(id2,'原请求',{directory,now:1000000}),null)
  const restored=await loadCheckpoint(id2,'原请求',{directory,now:1001});let reads=0
  const input={limit:20},r={...record,input}
  const tools=createGenerationTools({catalog:[{...TOOLS[id],available:true}],initialRecords:[r],invoke:async()=>reads++})
  const result=await tools.execute('cli_read',{id,input},signal)
  assert.equal(result.totalObserved,restored.records[0].value.items.length);assert.equal(reads,0)
 }finally{await unlink(path.join(directory,id2+'.json'));await rmdir(directory)}
})
test('analysis context remains bounded for very long records',()=>{
 const r={value:{items:Array.from({length:40},(_,i)=>({id:String(i),content:'x'.repeat(100000),description:'y'.repeat(100000),title:'t'}))}}
 const sample=analysisInput(r)
 assert.ok(sample.length>0);assert.ok(JSON.stringify(sample).length<=12100)
 assert.ok(sample.every(row=>r.value.items[Number(row.id)].content.includes(row.content)))
})
