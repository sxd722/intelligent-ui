import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeTaskIntent} from '../shared/cardspec/core-task.mjs'
import {routeCoreTasks} from '../server/tools/task-routing.mjs'
import {evidencePresentation} from '../shared/cardspec/evidence-presentation.mjs'
import {TOOLS} from '../shared/cardspec/tools.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {createResearchSession} from '../server/research/session.mjs'
const catalog=Object.values(TOOLS).map(t=>({...t,available:true}))
const emptyDiscovery=async()=>({tools:[],retrieval:{method:'test',catalogSize:catalog.length}})
const task=(overrides={})=>({kind:'monitor',query:'原神 枪战 影域',domain:'gaming',data:'live',outcome:'切换来源查看正面负面样本及引用',...overrides})
const intent=(...tasks)=>normalizeTaskIntent({tasks})

test('intent is bounded, preserves entities, rejects code/schema expansion',()=>{
 assert.equal(intent(task()).tasks[0].query,'原神 枪战 影域')
 assert.throws(()=>intent(task({kind:'magic'})))
 assert.throws(()=>intent(task({query:''})))
 assert.throws(()=>intent(task({command:'shell'})))
 assert.throws(()=>intent(...Array(4).fill(task())))
})
test('gaming sentiment crosses coarse learning category, keeps source diversity',async()=>{
 const r=await routeCoreTasks(catalog,intent(task()),{discover:emptyDiscovery})
 const selected=r.tasks[0].tools
 assert.equal(selected[0].id,'opencli.bilibili.search')
 for(const site of ['bilibili','xiaohongshu','weibo'])assert.ok(selected.some(t=>t.source===site),site)
 assert.ok(!selected.some(t=>/creator|history|following/.test(t.id)))
 assert.ok(selected[0].reasons.includes('source audience matches domain'))
})
test('non live tasks skip discovery even if topic names a tool domain',async()=>{
 let reads=0
 const r=await routeCoreTasks(catalog,intent(task({kind:'express',domain:'movies',data:'provided',query:'改写观影日记'}),task({kind:'calculate',domain:'finance',data:'none',query:''})),{discover:async()=>{reads++;throw Error('unneeded')}})
 assert.equal(reads,0);assert.ok(r.tasks.every(t=>t.route==='local'&&t.tools.length===0))
})
test('multi task routing retains each subgoal, availability, and semantic long tail',async()=>{
 const c=catalog.map(t=>t.site==='douban'?{...t,available:false,reason:'需绑定'}:t)
 const r=await routeCoreTasks(c,intent(task({kind:'decide',domain:'movies',query:'今晚看什么',outcome:'选两部比较'}),task({kind:'plan',domain:'travel',query:'周末杭州',outcome:'选景点规划'}),task({kind:'find',domain:'astronomy',query:'空间天气',outcome:'阅读原文'})),{discover:async()=>({tools:[{id:'autocli.hackernews.search',score:.6,matchedBy:'semantic'}],retrieval:{}})})
 assert.ok(r.tasks[0].tools.some(t=>t.source==='douban'&&!t.available&&t.reason==='需绑定'))
 assert.ok(r.tasks[1].tools.some(t=>t.source==='ctrip'))
 assert.equal(r.tasks[2].route,'search-or-unavailable')
 assert.equal(r.tasks[2].tools.length,0)
})
test('evidence gates cannot create missing coordinates, dates or sentiment',()=>{
 const p=evidencePresentation({items:[{id:1,title:'A',score:20},{id:2,title:'B',score:10}],fetchedAt:'2026-11-11'})
 assert.equal(p.candidates.find(c=>c.kind==='distribution').available,false)
 assert.equal(p.candidates.find(c=>c.kind==='map').available,false)
 assert.equal(p.candidates.find(c=>c.kind==='timeline').available,false)
 assert.deepEqual(p.candidates.find(c=>c.kind==='metrics').fields,['score'])
 const good=evidencePresentation({analysis:{dataset:{id:'D1'}},items:[{analysisLabel:'正面',analysisQuote:'喜欢',lat:30,lng:120},{analysisLabel:'未分类',analysisQuote:''}]})
 assert.equal(good.candidates.find(c=>c.kind==='distribution').records,1)
 assert.equal(good.classification.unknown,1)
 assert.equal(good.candidates.find(c=>c.kind==='map').records,1)
})
test('rail intent excludes unrelated travel offers, unknown domains do not inherit weak matches',async()=>{
 const discover=async()=>({tools:[{id:'opencli.ctrip.search',score:.8},{id:'opencli.dianping.search',score:.7},{id:'opencli.zhihu.search',score:.3}],retrieval:{}})
 const r=await routeCoreTasks(catalog,intent(task({kind:'find',domain:'transport',query:'杭州到上海的火车',terms:['车次'],outcome:'选择班次'}),task({kind:'understand',domain:'botany',query:'辨认植物',outcome:'识别植物并核对资料'})),{discover})
 assert.ok(r.tasks[0].tools.some(t=>t.id==='opencli.12306.trains'))
 assert.ok(r.tasks[0].tools.every(t=>t.source==='12306'||t.id==='opencli.zhihu.search'))
 assert.ok(r.tasks[1].tools.every(t=>t.id==='opencli.zhihu.search'))
 assert.equal(r.tasks[1].route,'general-search')
})
test('short route precedes generation once, host discloses contracts and reserves a real read',async()=>{
 let reads=0,rounds=0
 const ext=createGenerationTools({goal:'看看游戏反馈',allowPlanning:false,catalog,discover:emptyDiscovery,invoke:async()=>{reads++;return {value:{items:[],source:'test',fetchedAt:'2026-11-11',truncated:false}}}})
 const session=createResearchSession({extensions:ext})
 const run=async(messages,options)=>{
  rounds++
  if(options.toolChoice?.function.name==='cli_read'){assert.match(JSON.stringify(messages),/宿主已展开/);return {message:{tool_calls:[{id:'read',function:{name:'cli_read',arguments:JSON.stringify({id:'opencli.bilibili.search',input:{query:'原神 枪战 影域'},task:0})}}]}}}
  if(options.toolChoice){assert.equal(options.toolChoice.function.name,'task_route');assert.equal(options.maxTokens,1000);return {message:{tool_calls:[{id:'route',function:{name:'task_route',arguments:JSON.stringify({tasks:[task()]})}}]},usage:{total_tokens:80}}}
  assert.match(JSON.stringify(messages),/opencli.bilibili.search/);return {message:{content:'<card/>'}}
 }
 await session.run(run,[],{});await session.run(run,[],{})
 assert.equal(rounds,4);assert.equal(reads,1)
 assert.equal(ext.bindingPlan().length,1);assert.equal(ext.pendingReads().length,0)
 assert.equal(session.snapshot().trace.filter(t=>t.phase==='task_route'&&t.status==='succeeded').length,1)
 assert.equal(session.snapshot().taskIntent.tasks[0].query,task().query)
})
test('card plan combines intent in same call; malformed route falls back without repair call',async()=>{
 const ext=createGenerationTools({goal:'查询并比较旅游候选，规划行程',allowPlanning:true,catalog,discover:emptyDiscovery,invoke:async()=>({value:{items:[],source:'test',fetchedAt:'2026-11-11',truncated:false}})})
 const session=createResearchSession({extensions:ext});let n=0
 await session.run(async(m,o)=>{n++;if(o.toolChoice?.function.name==='cli_read')return {message:{tool_calls:[{id:'read',function:{name:'cli_read',arguments:JSON.stringify({id:'opencli.ctrip.search',task:0,input:{query:'杭州'}})}}]}};if(o.toolChoice)return {message:{tool_calls:[{function:{name:'plan_cards',arguments:JSON.stringify({taskIntent:{tasks:[task({kind:'plan',domain:'travel',query:'杭州',outcome:'景点选择影响行程'})]},cards:[{title:'旅行',goal:'选景点后更新行程'}],followups:[]})}}]}};assert.match(JSON.stringify(m),/ctrip/);return {message:{content:'ok'}}},[],{})
 assert.equal(n,3);assert.equal(ext.plan().cards.length,1)
 const fallback=createResearchSession({extensions:createGenerationTools({goal:'查天气',allowPlanning:false,catalog,discover:emptyDiscovery})});let calls=0
 await fallback.run(async(m,o)=>{calls++;return o.toolChoice?{message:{tool_calls:[{function:{name:'task_route',arguments:'bad json'}}]}}:{message:{content:'fallback'}}},[],{})
 assert.equal(calls,2);assert.ok(fallback.snapshot().trace.some(t=>t.status==='fallback'))
})
