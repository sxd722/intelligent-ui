import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createDebugSession} from '../server/cardspec/debug-session.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {loadApiKey} from '../server/env.mjs'
const root='artifacts/rats-debug-qa/model-correction';await mkdir(root,{recursive:true})
const original=JSON.parse(await readFile('artifacts/rsi-adaptive/runs/2034bac5-9cd1-4c5e-8eb8-4d3d978079f8.json','utf8')).artifacts[0]
const response0=JSON.parse(await readFile('artifacts/rats-debug-qa/model-retest/model-trace.json','utf8'))
const args=JSON.parse(response0.response.message.tool_calls[0].function.arguments)
const d=createDebugSession({context:()=>original.spec.context,artifactRoot:root,runner:(spec,o)=>runDebugBrowser(spec,{...o,scenarios:['normal'],viewports:[432,320],captureSteps:true})})
const feedback=await d.test({source:original.source,steps:args.steps})
if(feedback.repairLane!=='test')throw Error('Expected host restoration conflict')
const messages=[{role:'system',content:'仅修正测试。代码已保存，禁止重新输出或修改实现；根据宿主testRevision修正冲突预期，所有操作、其他断言及requirement保持原样，调用card_retest。'}, {role:'user',content:JSON.stringify({originalSteps:args.steps,feedback})}]
const health=await(await fetch('http://127.0.0.1:8787/api/health')).json(),key=loadApiKey();if(!key.ok)throw Error('No model credential')
const round=createModelClient({base:health.upstream,key:key.value,model:'glm-5.3-flash'})
const start=Date.now(),response=await round(messages,{maxTokens:2048,reasoningEffort:'low',temperature:0,tools:[d.retestTool()],toolChoice:{type:'function',function:{name:'card_retest'}},signal:AbortSignal.timeout(60000)}),modelMs=Date.now()-start
await writeFile(root+'/model-trace.json',JSON.stringify({messages,response,modelMs},null,2))
const calls=response.message.tool_calls||[];if(calls.length!==1||calls[0].function.name!=='card_retest')throw Error('Expected one retest')
const input=JSON.parse(calls[0].function.arguments),fixed=await d.retest(input),browser=d.evidence()
let commit;try{commit=d.commit({version:fixed.version})}catch(e){commit={error:e.message}}
const result={passed:browser.status==='tested'&&browser.runs.every(r=>r.actions.every(a=>a.ok&&a.assertion?.passed!==false&&a.restored!==false))&&commit.source===original.source,status:fixed.status,model:response.model,modelMs,usage:response.usage,unchangedSource:commit.source===original.source,sourceCharactersAvoided:original.source.length,outputCharacters:JSON.stringify(input).length,codeChanges:0,error:commit.error,modelCalls:1,scope:'Correction of actual GLM reload expectation, not full regeneration'}
await writeFile(root+'/trace.json',JSON.stringify(d.snapshot(),null,2));await writeFile(root+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result))
