import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createDebugSession} from '../server/cardspec/debug-session.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {loadApiKey} from '../server/env.mjs'
const root='artifacts/rats-debug-qa/model-retest';await mkdir(root,{recursive:true})
const original=JSON.parse(await readFile('artifacts/rsi-adaptive/runs/2034bac5-9cd1-4c5e-8eb8-4d3d978079f8.json','utf8')).artifacts[0]
const d=createDebugSession({context:()=>original.spec.context,artifactRoot:root,runner:(spec,o)=>runDebugBrowser(spec,{...o,scenarios:['normal'],viewports:[432,320],captureSteps:true})})
const initial=await d.test({source:original.source,steps:[{op:'check',expect:{state:{stage:1,reads:0,money:8}}}]})
const messages=[{role:'system',content:'你是只读测试作者。源码已保存，不输出或修改代码。只调用card_retest(version,steps)补测下列独立路径；每次从初始状态开始。不要根据截图猜预期；根据给定玩法规则设计断言。'}, {role:'user',content:JSON.stringify({goal:'玩法规则：点击阅读手稿放入槽位，再点击推进时间才执行一次阅读。每次笔记+1、阅读次数+1，不扣金钱；两次阅读进入第2幕。验证两次阅读、金钱仍8、笔记为2，随后reload恢复这些值。',feedback:initial})}]
const health=await(await fetch('http://127.0.0.1:8787/api/health')).json(),key=loadApiKey();if(!key.ok)throw Error('No model credential')
const round=createModelClient({base:health.upstream,key:key.value,model:'glm-5.3-flash'})
const start=Date.now();let response
try{response=await round(messages,{maxTokens:2048,reasoningEffort:'low',temperature:0,tools:[d.retestTool()],toolChoice:{type:'function',function:{name:'card_retest'}},signal:AbortSignal.timeout(60000)})}
catch(e){await writeFile(root+'/result.json',JSON.stringify({passed:false,error:e.message,modelMs:Date.now()-start}));throw e}
const modelMs=Date.now()-start,calls=response.message.tool_calls||[]
await writeFile(root+'/model-trace.json',JSON.stringify({messages,response,modelMs},null,2))
if(calls.length!==1||calls[0].function.name!=='card_retest')throw Error('Expected one retest')
const input=JSON.parse(calls[0].function.arguments),feedback=await d.retest(input),browser=d.evidence()
const passed=browser.status==='tested'&&browser.runs.every(r=>r.actions.every(a=>a.ok&&a.assertion?.passed!==false&&a.restored!==false))
const result={passed,status:feedback.status,model:response.model,modelMs,usage:response.usage,sourceCharactersAvoided:original.source.length,outputCharacters:JSON.stringify(input).length,codeChanges:0,modelCalls:1,scope:'Focused GLM test-only follow-up, not full regeneration or latency benchmark'}
await writeFile(root+'/trace.json',JSON.stringify(d.snapshot(),null,2));await writeFile(root+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result))
