import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {loadApiKey} from '../server/env.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {generationCallOptions} from '../server/cardspec/build-policy.mjs'
import {createGenerationBudget,generationPolicy} from '../server/cardspec/budget.mjs'
import {createDebugSession} from '../server/cardspec/debug-session.mjs'
import {buildDeepCard} from '../server/cardspec/deep-build.mjs'
const sourceId=process.argv[2]||'904b36d3-a420-40e8-a5e2-1daeac9a463a',label=process.argv[3]||'auto'
if(!/^[\w-]+$/.test(label)||!/^[a-f0-9-]{36}$/.test(sourceId))throw Error('invalid output/source')
const previous=JSON.parse(await readFile(`artifacts/deep-build/${sourceId}/trace.json`,'utf8'))
if(process.env.QA_REVIEW)previous.reviewDiagnostics=JSON.parse(await readFile(process.env.QA_REVIEW,'utf8'))
const dir=`artifacts/sgs-harness-20261102/${label}`,cardId=randomUUID();await mkdir(dir,{recursive:true})
const health=await(await fetch('http://127.0.0.1:8787/api/health')).json()
const key=loadApiKey();if(!key.ok)throw Error('model key unavailable')
const round=createModelClient({base:health.upstream,key:key.value,model:health.model})
const context={buildMode:'deep',renderMode:'web',expressionDialect:'js-v1',cardSize:'full',extendedGeneration:true,viewport:{width:432,height:900}}
const budget=createGenerationBudget({...generationPolicy(previous.goal,{buildMode:'deep'}),modelCalls:14,repairs:5,timeoutMs:480000})
const events=[],started=Date.now(),debug=createDebugSession({context:()=>context,budget,cardId}),signal=AbortSignal.timeout(480000)
await writeFile(dir+'/run.json',JSON.stringify({cardId,sourceId,startedAt:new Date().toISOString(),model:health.model,context,scope:'Real-model resume on new harness; same original request, additional user review; no CLI needed'},null,2))
let result,error
try{result=await buildDeepCard({input:{prompt:previous.goal},context,debug,budget,signal,cardId,resume:{...previous,sourceId},emit:e=>{events.push(e);if(e.message)console.log(Math.round((Date.now()-started)/1000),e.message)},streamUpstream:async(messages,options)=>{
 if(process.env.QA_TARGETED==='1'&&budget.snapshot().modelCalls>=1){
  const current=JSON.parse(await readFile(`artifacts/deep-build/${cardId}/trace.json`,'utf8'))
  const changed=Object.entries(current.workspace||{}).some(([name,f])=>f.content!==previous.workspace[name]?.content)
  if(changed||budget.snapshot().modelCalls>=3)throw Object.assign(Error(changed?'定向实现已交付，转独立业务复验；不宣称全需求自动验收完成':'定向修复3次未提交，保留原代码'),{code:'GENERATION_BUDGET'})
 }
 budget.model(options.stage||'generate')
 const review='用户本轮复验重点：出牌、AI自主行动、胜负和刷新恢复；修复过度压缩的布局。已观察到.card宽40高28、日志max-height12，牌名被裁切且主视觉留白。恢复可读字号与约44px触控，日志有可用滚动区，保持所有玩法；不要靠缩字裁切或固定初始手牌迎合测试。刷新在AI回合/响应中也不能重复摸牌或丢失待响应。验收逐条使用可观察操作，先覆盖核心闭环，不重复全文规划。'
 const request=messages.map(m=>({...m}));request[1].content=JSON.stringify({...JSON.parse(request[1].content),userReview:review})
 return (await round(request,generationCallOptions({buildMode:'deep',modelProfile:'default'},options))).message.content
}})}catch(e){error={message:e.message,code:e.code}}
await writeFile(dir+'/result.json',JSON.stringify({cardId,sourceId,elapsedMs:Date.now()-started,result,error,budget:budget.snapshot(),events},null,2))
console.log(JSON.stringify({cardId,sourceId,status:result?'succeeded':'stopped',error,elapsedMs:Date.now()-started,calls:budget.snapshot().modelCalls}))
