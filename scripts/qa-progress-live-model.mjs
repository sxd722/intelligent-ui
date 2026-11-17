import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createDebugSession} from '../server/cardspec/debug-session.mjs'
import {createResearchSession} from '../server/research/session.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
import {loadApiKey} from '../server/env.mjs'
const root='artifacts/debug-progress-qa/'+(process.env.QA_RUN||'live-model');await mkdir(root,{recursive:true})
const original=JSON.parse(await readFile('artifacts/rsi-adaptive/runs/2034bac5-9cd1-4c5e-8eb8-4d3d978079f8.json','utf8')).artifacts[0]
const events=[],calls=[];let browsers=0
const debug=createDebugSession({context:()=>original.spec.context,artifactRoot:root,cardId:'debug',runner:(spec,o)=>runDebugBrowser(spec,{...o,viewports:[432,320],captureSteps:true,artifactDir:`${root}/browser-${++browsers}`})})
const seed=await debug.test({source:original.source,steps:[{op:'check'}]})
const research=createResearchSession({maxRounds:0,maxCalls:0,timeoutMs:240000,onEvent:e=>events.push(e)})
const key=loadApiKey(),health=await(await fetch('http://127.0.0.1:8787/api/health')).json();if(!key.ok)throw Error('Credential unavailable')
const model=createModelClient({base:health.upstream,key:key.value,model:'glm-5.3-flash'})
const tasks=[
 '路径一：从初始状态开始，点阅读手稿、推进时间、阅读手稿、推进时间。断言笔记2、reads2、money8、stage2。关联R3。',
 '路径二：每次重新从初始开始，先阅读/推进两次，然后探查墙体/推进一次（stage3，sanity5）；然后挥霍财力/推进四次（money依次6、4、2、0，最后ending="破产 · 流亡"）。关联R5。',
 '路径三：从初始阅读/推进两次，然后reload，验证stage2、notes2、money8恢复不变。关联R8。'
]
const recorded=process.env.QA_REPLAY?JSON.parse(await readFile('artifacts/debug-progress-qa/'+process.env.QA_REPLAY+'/model-trace.json','utf8')):null
const started=Date.now();let source,error
try{
 source=await research.run(async(messages,options)=>{
  if(calls.length>=5)throw Error('QA model turn ceiling reached')
  const start=Date.now(),task=tasks[calls.length]
  const prompt=task?[...messages,{role:'user',content:`本次只提交这条测试，不改代码，不发解释：${task}\n已保存version=${seed.version}；用名称定位；reload恢复不是状态变化。`}]:messages
  const result=recorded?recorded[calls.length].response:await model(prompt,{...options,signal:AbortSignal.any([options.signal,AbortSignal.timeout(90000)]),maxTokens:3072,reasoningEffort:'low',temperature:0,tools:options.tools.filter(t=>t.function.name===(task?'card_retest':'card_commit')),toolChoice:{type:'function',function:{name:task?'card_retest':'card_commit'}}})
  calls.push({elapsedMs:Date.now()-start,inputCharacters:JSON.stringify(prompt).length,request:prompt,response:result});await writeFile(root+'/model-trace.json',JSON.stringify(calls,null,2));return result
 },[{role:'system',content:'只做原卡片验收；每次测试从初始开始。返回exact version + steps，不输出源码。下一轮宿主给出新路径，全部验证后提交原候选。'},{role:'user',content:JSON.stringify({version:seed.version,initialFeedback:seed,goal:'墙中之鼠：四阶段资源管理、多个结局、刷新恢复。保留未覆盖需求为partial，不宣称全部实现。'})}],{debugSession:debug,signal:AbortSignal.timeout(240000),onPiece:()=>{}})
}catch(e){error=e.message}
const snapshot=debug.snapshot(),result={scope:recorded?'Replay of recorded real GLM responses through new harness + fresh browser validation; zero model calls':'Live GLM continuation on saved source; three independently specified paths, not full regeneration',elapsedMs:Date.now()-started,modelCalls:recorded?0:calls.length,replayedModelResponses:recorded?calls.length:0,browserRuns:browsers,sourceUnchanged:source===original.source,error,committed:snapshot.committed,retained:snapshot.retained,compression:events.filter(e=>e.type==='debug_context_compacted'),usage:calls.map(c=>c.response.usage),pathTests:snapshot.tests.map(t=>({status:t.status,steps:t.steps.length,failed:t.feedback?.summary?.failed}))}
await writeFile(root+'/events.json',JSON.stringify(events,null,2));await writeFile(root+'/debug.json',JSON.stringify(snapshot,null,2));await writeFile(root+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result))
if(error||!result.sourceUnchanged)process.exitCode=1
