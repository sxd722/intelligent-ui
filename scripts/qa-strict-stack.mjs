import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
import {summarizeDebugFeedback} from '../server/cardspec/debug-feedback.mjs'
const root='artifacts/strict-stack-qa';await fs.mkdir(root,{recursive:true})
const module=`export default function App({data,state,setState,bridge}){return <div><svg width="100%" height={65} viewBox="0 0 120 65"><circle cx={60} cy={32} r={12+data.n} fill="var(--cs-accent)"/></svg><p>本地 {state.n} · 共享 {data.n}</p><button onClick={()=>setState({n:state.n+1})}>增加</button><button onClick={()=>bridge.call("inc")}>共享加一</button></div>}`
const surface=id=>`<sandbox id="${id}" label="${id}" brief="独立计数与共享圆形" height={160} input={{n:state.n}} initial={{n:0}} actions={{inc:"inc"}} source={${JSON.stringify(module)}}/>`
const source=`<card theme="soft"><state id="n" type="number" initial={0}/><title>两个独立实验台</title><row>${surface('a')}${surface('b')}</row><text>宿主共享：{state.n}</text><button onPress="inc">宿主加一</button><action id="inc"><increment target="n"/></action></card>`
const r=compileCard(source,{final:true,context:{renderMode:'hybrid',cardSize:'square'}});await validateRichContent(r);assert(r.complete,JSON.stringify(r.diagnostics));await fs.writeFile(root+'/multi.json',JSON.stringify({source,spec:r.spec},null,2))
const steps=[{op:'click',handle:'sandbox:a:0',expect:{text:'本地 1 · 共享 0'}},{op:'click',handle:'sandbox:b:0',expect:{text:'本地 1 · 共享 0'}},{op:'click',handle:'sandbox:b:0',expect:{text:'本地 2 · 共享 0'}},{op:'click',handle:'sandbox:a:1',expect:{state:{n:1},text:'共享 1'}},{op:'click',name:'宿主加一',expect:{state:{n:2},text:'共享 2'}},{op:'reload',expect:{state:{n:2},text:'本地 2 · 共享 2'}}]
const browser=await runDebugBrowser(r.spec,{steps,scenarios:['normal'],viewports:[320,432],artifactDir:root+'/multi',captureSteps:true,signal:AbortSignal.timeout(90000)})
await fs.writeFile(root+'/multi-browser.json',JSON.stringify(browser,null,2));assert.equal(browser.status,'tested');assert(browser.runs.every(r=>r.actions.every(a=>a.ok&&a.assertion?.passed!==false&&a.restored!==false)),JSON.stringify(browser.runs.map(r=>({width:r.width,actions:r.actions.map(a=>({step:a.step,ok:a.ok,error:a.error,assertion:a.assertion,restored:a.restored}))}))))
const bad=compileCard(source.replace(JSON.stringify(module),JSON.stringify(module.replace('return <div>','if(data.n<0)throw Error("局部故障测试");return <div>'))).replace('</card>','<button onPress="fail">触发局部故障</button><action id="fail"><set target="n" value={-1}/></action></card>'),{final:true,context:{renderMode:'hybrid',cardSize:'square'}})
await validateRichContent(bad);assert(bad.complete,JSON.stringify(bad.diagnostics))
const isolation=await runDebugBrowser(bad.spec,{steps:[{op:'click',name:'触发局部故障',expect:{state:{n:-1}}},{op:'click',handle:'sandbox:b:0',expect:{text:'本地 1 · 共享 -1'}}],scenarios:['normal'],viewports:[432],artifactDir:root+'/isolation',signal:AbortSignal.timeout(45000)})
await fs.writeFile(root+'/isolation-browser.json',JSON.stringify(isolation,null,2));assert.equal(isolation.status,'tested');assert(isolation.runs[0].actions.every(a=>a.ok&&a.assertion.passed));assert(isolation.runs[0].final.errors.some(e=>e.includes('局部故障测试')))
// Replay the actual two-sandbox candidate that was rejected by the former cap.
const latest='artifacts/generation-debug/b1219ed3-62cc-407a-8eba-a7283f07bb20',original=await fs.readFile(latest+'/a7361397f393e18c1db5/candidate.cardspec','utf8')
const current=compileCard(original,{final:true,context:{renderMode:'hybrid',cardSize:'square',expressionDialect:'js-v1'}});await validateRichContent(current)
await fs.writeFile(root+'/latest-compile.json',JSON.stringify({complete:current.complete,diagnostics:current.diagnostics,modules:Object.keys(current.spec?.sandboxModules||{})},null,2))
if(current.complete){const tested=JSON.parse(await fs.readFile(latest+'/ce7aaf8cbeff936a17bf/test-2.json'));const replay=await runDebugBrowser(current.spec,{steps:tested.steps,scenarios:['normal'],viewports:[320,432],artifactDir:root+'/latest',signal:AbortSignal.timeout(90000)});await fs.writeFile(root+'/latest-replay.json',JSON.stringify(replay,null,2))}
const finalSource=await fs.readFile(latest+'/ce7aaf8cbeff936a17bf/candidate.cardspec','utf8'),last=compileCard(finalSource,{final:true,context:{renderMode:'hybrid',cardSize:'square',expressionDialect:'js-v1'}});await validateRichContent(last)
const path=JSON.parse(await fs.readFile(latest+'/ce7aaf8cbeff936a17bf/test-6.json'))
if(last.complete){const replay=await runDebugBrowser(last.spec,{steps:path.steps,scenarios:['normal'],viewports:[320,432],artifactDir:root+'/latest-accepted',signal:AbortSignal.timeout(90000)});await fs.writeFile(root+'/latest-accepted-replay.json',JSON.stringify(replay,null,2))}
// Compare original feedback trimming with the new compact summary on real trace.
const feedback=[]
for(const d of await fs.readdir(latest))for(const name of await fs.readdir(latest+'/'+d))if(/^test-\d+\.json$/.test(name)){const record=JSON.parse(await fs.readFile(latest+'/'+d+'/'+name));const compact=summarizeDebugFeedback(record);feedback.push({file:d+'/'+name,status:record.status,browserBytes:JSON.stringify(record.browser||{}).length,feedbackBytes:JSON.stringify(compact).length,feedback:compact})}
await fs.writeFile(root+'/feedback-comparison.json',JSON.stringify(feedback,null,2))
console.log(JSON.stringify({multi:browser.runs.map(r=>({width:r.width,passed:true,errors:r.final.errors})),latestCompiled:current.complete,feedback:feedback.map(r=>({file:r.file,bytes:r.feedbackBytes,failed:r.feedback.summary.failed}))}))
