import test from 'node:test'
import assert from 'node:assert/strict'
import {TOOLS} from '../shared/cardspec/tools.mjs'
import {normalizeTaskIntent} from '../shared/cardspec/core-task.mjs'
import {routeCoreTasks} from '../server/tools/task-routing.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {createResearchSession} from '../server/research/session.mjs'
import {bindingPlanDiagnostics} from '../server/cardspec/binding-plan.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
const catalog=Object.values(TOOLS).map(t=>({...t,available:true}))
const discover=async()=>({tools:[{id:'opencli.xiaohongshu.creator-profile',score:9}],retrieval:{method:'fixture'}})
const task=(query='iPhone Duo',domain='consumer tech')=>({kind:'monitor',query,domain,data:'live',outcome:'查看用户口碑与评价',terms:['口碑']})
const signal=new AbortController().signal
const envelope={items:[],source:'fixture',fetchedAt:'2026-11-11',truncated:false}

test('unfamiliar opinion domains retain binding and meaningful source candidates',async()=>{
 for(const t of [task(),task('新款跑鞋','sports gear'),task('某城市新地铁','civic mobility')]){
  const r=await routeCoreTasks(catalog,normalizeTaskIntent({tasks:[t]}),{discover})
  assert.equal(r.tasks[0].requiresBinding,true);assert.equal(r.tasks[0].route,'cli')
  assert(r.tasks[0].tools.every(t=>!/(\.hot|creator-profile)$/.test(t.id)))
  assert.equal(r.tasks[0].presentation.recipe,'opinion-evidence')
 }
 const r=await routeCoreTasks(catalog,normalizeTaskIntent({tasks:[{...task(),kind:'find',terms:[],query:'产品的官方发布信息',outcome:'核对事实'}]}),{discover})
 assert.equal(r.tasks[0].requiresBinding,false);assert.equal(r.tasks[0].presentation.recipe,'fact-evidence')
})
test('web background research cannot exhaust all turns without attempting social CLI',async()=>{
 const reads=[],ext=createGenerationTools({catalog,goal:'产品口碑',allowPlanning:false,discover,invoke:async p=>{reads.push(p);return {value:envelope}}})
 const session=createResearchSession({extensions:ext,providers:{search:async()=>({items:[]})}})
 let turn=0
 await session.run(async(messages,o)=>{
  const forced=o.toolChoice?.function?.name
  const call=(name,input)=>({message:{tool_calls:[{id:String(turn++),function:{name,arguments:JSON.stringify(input)}}]}})
  if(forced==='task_route')return call('task_route',{tasks:[task()]})
  if(forced==='cli_read'){
   assert.match(JSON.stringify(messages),/宿主已展开/)
   assert.equal(o.maxTokens,1024)
   return call('cli_read',{id:'opencli.weibo.search',task:0,input:{keyword:'iPhone Duo'}})
  }
  if(!reads.length)return call('web_search',{query:'iPhone Duo 正式名称'})
  return {message:{content:'<card/>'}}
 },[],{})
 assert.equal(reads.length,1);assert.equal(ext.bindingPlan()[0].tool,'opencli.weibo.search')
 assert.equal(session.snapshot().searches,1);assert.equal(ext.taskRouting().tasks[0].execution.status,'succeeded')
 // Bilibili has an existing native composition adapter; unconfigured sources
 // keep their generic tool-view instead of claiming unsupported mapping.
 const data=await ext.execute('cli_read',{id:'opencli.bilibili.search',task:0,input:{query:'iPhone Duo'}},signal)
 assert.equal(data.taskPresentation.recipe,'opinion-evidence')
 assert.match(data.hostView.consumer,/layout="evidence"/)
 const composed=compileCard('<card>'+data.bindingRecipe.declaration+data.hostView.consumer+'</card>',{final:true,context:{expressionDialect:'js-v1'}})
 assert.equal(composed.complete,true,JSON.stringify(composed.diagnostics))
})
test('real provider errors permit bounded fallback, not infinite forced reads',async()=>{
 let reads=0
 const ext=createGenerationTools({catalog,goal:'口碑',allowPlanning:false,discover,invoke:async()=>{reads++;throw Object.assign(Error('login required'),{code:'AUTH_REQUIRED'})}})
 const session=createResearchSession({extensions:ext});let forcedReads=0
 await session.run(async(m,o)=>{
  const name=o.toolChoice?.function?.name
  if(name==='task_route')return {message:{tool_calls:[{id:'route',function:{name,arguments:JSON.stringify({tasks:[task()]})}}]}}
  if(name==='cli_read'){const id=forcedReads++?'opencli.xiaohongshu.search':'opencli.weibo.search';return {message:{tool_calls:[{id, function:{name,arguments:JSON.stringify({id,task:0,input:id.includes('weibo')?{keyword:'iPhone Duo'}:{query:'iPhone Duo'}})}}]}}}
  return {message:{content:'<card><text>来源需连接</text></card>'}}
 },[],{})
 assert.equal(reads,2);assert.equal(forcedReads,2);assert.equal(ext.pendingReads().length,0)
 const spec=compileCard('<card><text>来源需连接</text></card>',{final:true}).spec
 spec.context.taskRouting=ext.taskRouting()
 const ds=bindingPlanDiagnostics(spec,ext.bindingPlan());assert(!ds.some(d=>d.severity==='error'));assert(ds.some(d=>d.code==='live_task_source_failed'))
})
test('another task binding cannot stand in for missing opinion source; same source tasks are independent',async()=>{
 const ext=createGenerationTools({catalog,goal:'两个产品口碑',allowPlanning:false,discover,invoke:async()=>({value:envelope})})
 await ext.execute('task_route',{tasks:[task('产品甲'),task('产品乙')]},signal)
 await ext.execute('cli_read',{id:'opencli.weibo.search',task:0,input:{keyword:'产品甲'}},signal)
 assert.equal(ext.pendingReads().length,1);assert.equal(ext.pendingReads()[0].task,1)
 const spec=compileCard('<card><binding id="rail" tool="opencli.12306.trains" input={{from:"杭州",to:"上海",date:"2026-11-12"}}/><text>结果</text></card>',{final:true}).spec
 spec.context.taskRouting=ext.taskRouting()
 assert.equal(bindingPlanDiagnostics(spec).filter(d=>d.code==='live_task_binding_missing').length,2)
})
