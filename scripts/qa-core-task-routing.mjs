import {mkdir,writeFile} from 'node:fs/promises'
import {loadApiKey} from '../server/env.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {CORE_TASK_INSTRUCTION} from '../shared/cardspec/core-task.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {toolDiscovery} from '../server/tools/semantic-discovery.mjs'
const base='http://127.0.0.1:8787',root='artifacts/core-task-routing-20261111'+(process.env.QA_ROUND?'/'+process.env.QA_ROUND:'')
await mkdir(root,{recursive:true})
const health=await(await fetch(base+'/api/health')).json(),catalogResponse=await(await fetch(base+'/api/tools')).json(),catalog=Array.isArray(catalogResponse)?catalogResponse:catalogResponse.tools
const key=loadApiKey();if(!key.ok)throw Error('Model credential unavailable')
const round=createModelClient({base:health.upstream,key:key.value,model:'volcengine/deepseek-v4.1-flash'})
const cases=[
 {id:'social',prompt:'原神 枪战 影域，玩家到底是喜欢还是讨厌？采集社交平台样本，切换来源看正负态度与原文。',expected:['opencli.bilibili.search']},
 {id:'movies',prompt:'今晚看什么？找正在热映的电影，按类型筛选，选两部比较，再看详情。',expected:['opencli.douban.movie-hot','opencli.douban.search']},
 {id:'travel',prompt:'周末带4岁孩子在杭州玩，看看真实景点和天气，选中几个地点安排两天行程。',expected:['opencli.ctrip.search','opencli.wttr.forecast']},
 {id:'train',prompt:'周五杭州去上海，周日回来，查实际车次并分别固定一班。',expected:['opencli.12306.trains']},
 {id:'writing',prompt:'帮我把下面的拒绝邀请写得温柔但坚定：我这周不能去，以后也不想参加。让我比较三种语气。',local:true},
 {id:'gpa',prompt:'做一个GPA计算器，初始数学3学分4.0，英语2学分3.0，历史2学分3.5。修改成绩能立即看到加权结果。',local:true},
 {id:'learning',prompt:'用一个可调整参数的例子解释贝叶斯定理，先预测再揭晓答案，不要联网。',local:true},
 {id:'new-domain',prompt:'帮我探索适合阳台的食虫植物，找公开来源，比较光照和湿度要求，缺可靠资料就明确说明。'}
]
const results=[]
for(const c of cases){
 const ext=createGenerationTools({catalog,goal:c.prompt,allowPlanning:false}),tool=ext.planningRequest().tool,request=[{role:'system',content:CORE_TASK_INSTRUCTION},{role:'user',content:c.prompt}],started=Date.now()
 const result={...c,request,model:'volcengine/deepseek-v4.1-flash'}
 try{
  const old=await toolDiscovery.discover(catalog,c.prompt)
  const reply=await round(request,{tools:[tool],toolChoice:{type:'function',function:{name:'task_route'}},maxTokens:1000,temperature:.2,signal:AbortSignal.timeout(45000)})
  result.response=reply;result.modelMs=Date.now()-started-old.retrieval.elapsedMs
  const call=reply.message.tool_calls?.[0];if(call?.function.name!=='task_route')throw Error('missing task route call')
  result.routed=await ext.execute('task_route',JSON.parse(call.function.arguments),AbortSignal.timeout(15000));result.old=old
  const ids=result.routed.taskRouting.tasks.flatMap(t=>t.tools.map(t=>t.id))
  result.assessment=c.local?{passed:ids.length===0&&result.routed.taskIntent.tasks.every(t=>t.data!=='live'),scope:'local-only intent'}:c.expected?{passed:c.id==='travel'?c.expected.every(id=>ids.includes(id)):c.expected.some(id=>ids.includes(id)),scope:'candidate recall, not execution'}:{passed:null,scope:'open-domain manual review'}
 }catch(e){result.error=e.message}
 result.elapsedMs=Date.now()-started;results.push(result);await writeFile(root+'/'+c.id+'-routing.json',JSON.stringify(result,null,2));console.log(JSON.stringify({id:c.id,ms:result.elapsedMs,assessment:result.assessment,tasks:result.routed?.taskIntent.tasks.map(t=>t.kind),tools:result.routed?.taskRouting.tasks.flatMap(t=>t.tools.map(t=>t.id)),error:result.error}))
}
await writeFile(root+'/routing-results.json',JSON.stringify(results,null,2));toolDiscovery.close()
