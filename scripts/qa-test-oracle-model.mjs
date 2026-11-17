import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createDebugSession} from '../server/cardspec/debug-session.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {loadApiKey} from '../server/env.mjs'
const root='artifacts/test-oracle-qa/model-retest';await mkdir(root,{recursive:true})
const old='artifacts/generation-debug/310f4432-ac0e-4631-beb6-e1c764f191ba/226ef9aa72f7de7dae4b',source=await readFile(old+'/candidate.cardspec','utf8')
const good=JSON.parse(await readFile(old+'/test-1.json','utf8')).steps,bad=JSON.parse(await readFile(old+'/test-2.json','utf8')).steps
let count=0
const d=createDebugSession({cardId:'model-retest',artifactRoot:'artifacts/test-oracle-qa/debug',context:()=>({renderMode:'hybrid',expressionDialect:'js-v1',cardSize:'full',userGoal:'修改速度后位移联动；揭晓解释后返回观察；刷新恢复速度'}),runner:(spec,o)=>runDebugBrowser(spec,{...o,scenarios:['normal'],viewports:[432,320],size:'full',captureSteps:true,artifactDir:root+'/browser-'+(++count)})})
await d.test({source,steps:good});const feedback=await d.test({source,steps:bad})
if(feedback.repairLane!=='test')throw Error('Expected host test-conflict classification')
const messages=[{role:'system',content:'你在修复模型写错的测试。代码已由宿主保存，不输出代码。根据实际反馈修正原测试中的矛盾预期，保持所有操作和其他断言，调用 card_retest。不要削减步骤或弱化验收。'}, {role:'user',content:JSON.stringify({goal:'修改速度观察位移，揭晓解释，再返回观察并恢复速度',originalSteps:bad,feedback})}]
const health=await(await fetch('http://127.0.0.1:8787/api/health')).json(),key=loadApiKey()
if(!key.ok)throw Error('No model credential available')
const round=createModelClient({base:health.upstream,key:key.value,model:'volcengine/deepseek-v4.1-flash'})
const started=Date.now(),response=await round(messages,{maxTokens:2048,temperature:0,tools:[d.retestTool()],toolChoice:{type:'function',function:{name:'card_retest'}},signal:AbortSignal.timeout(60000)})
const modelMs=Date.now()-started,calls=response.message.tool_calls||[]
await writeFile(root+'/model-trace.json',JSON.stringify({messages,response,modelMs},null,2))
if(calls.length!==1||calls[0].function.name!=='card_retest')throw Error('Model did not submit a test-only retry')
const args=JSON.parse(calls[0].function.arguments),result=await d.retest(args)
let commit;try{commit=d.commit({version:result.version})}catch(e){commit={error:e.message}}
const outcome={model:response.model,modelMs,usage:response.usage,inputCharacters:JSON.stringify(messages).length,outputCharacters:JSON.stringify(args).length,sourceCharactersAvoided:source.length,status:result.status,repairLane:result.repairLane,unchangedSource:commit.source===source,codeRepairs:d.snapshot().repairs,error:commit.error,modelCalls:1}
await writeFile(root+'/trace.json',JSON.stringify(d.snapshot(),null,2));await writeFile(root+'/result.json',JSON.stringify(outcome,null,2));console.log(JSON.stringify(outcome))
if(!outcome.unchangedSource)process.exitCode=1
