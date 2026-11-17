import {readFile,writeFile,mkdir,readdir,cp} from 'node:fs/promises'
import {createProgressLedger} from '../server/cardspec/debug-progress.mjs'
import {createDebugSession} from '../server/cardspec/debug-session.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
const root='artifacts/debug-progress-qa';await mkdir(root,{recursive:true})
const read=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/,''))
const original=await read('artifacts/rsi-adaptive/runs/2034bac5-9cd1-4c5e-8eb8-4d3d978079f8.json'),rats=original.artifacts[0]
const oldroot='artifacts/generation-debug/33ac00ef-3141-4e37-9990-53ada6b66cb4',records=[]
for(const version of await readdir(oldroot))for(const file of await readdir(`${oldroot}/${version}`))if(/^test-\d+\.json$/.test(file)){
 const record=await read(`${oldroot}/${version}/${file}`),source=await readFile(`${oldroot}/${version}/candidate.cardspec`,'utf8')
 records.push({n:+file.match(/\d+/)[0],source,record:{...record,compiled:compileCard(source,{final:true,context:rats.spec.context}).complete}})
}
records.sort((a,b)=>a.n-b.n)
const ledger=createProgressLedger(),replay=[]
let best
for(const r of records){const p=ledger.observe(r.record);replay.push({n:r.n,version:r.record.version,oldStatus:r.record.status,...p});if(['passed','partial'].includes(r.record.status)&&!r.record.diagnostics.some(d=>d.severity==='error'))best=r;if(p.stopped)break}
const trace=rats.spec.research?.trace||[]
const stopped=replay.at(-1),feedbacks=trace.filter(x=>x.type==='debug_feedback')
const stopAt=feedbacks[stopped.n-1]?.at,startAt=trace[0]?.at
const historical={scope:'Counterfactual replay of actual old observations; no claim of a fresh generation benchmark',stopRound:stopped.n,originalRounds:records.length,retainedVersion:best?.record.version,originalElapsedMs:original.budget.elapsedMs,stopElapsedMs:stopAt?Date.parse(stopAt)-(Date.parse(original.createdAt)-original.budget.elapsedMs):null,stopAt,firstModelEventAt:startAt,rounds:replay}
await writeFile(root+'/historical.json',JSON.stringify(historical,null,2))
console.log(JSON.stringify({historicalStop:stopped.n,best:best?.n}))
const shopping=await read('artifacts/component-cuj-qa/generated/shopping.json')
const motionRoot='artifacts/generation-debug/310f4432-ac0e-4631-beb6-e1c764f191ba/226ef9aa72f7de7dae4b'
const cases=[
 {id:'rats',source:rats.source,context:rats.spec.context,steps:(await read('artifacts/rats-debug-qa/replay/altar/trace.json')).runs[0].actions.map(a=>a.step)},
 {id:'shopping',source:shopping.source,context:{renderMode:'native',expressionDialect:'js-v1',cardSize:'full',userGoal:'多选计算合计；超预算不能确认；查看明细并返回；刷新恢复选择'},steps:(await read('artifacts/test-oracle-qa/shopping/corrected-steps.json'))},
 {id:'motion',source:await readFile(motionRoot+'/candidate.cardspec','utf8'),context:{renderMode:'hybrid',expressionDialect:'js-v1',cardSize:'full',userGoal:'修改速度联动位移；查看解释并返回；刷新恢复速度'},steps:(await read(motionRoot+'/test-1.json')).steps},
 {id:'kilimanjaro',source:await readFile('artifacts/recent-card-review/3.cardspec','utf8'),context:{renderMode:'hybrid',expressionDialect:'js-v1',cardSize:'full',userGoal:'选择路线后日程与路线天数一致'},steps:[{op:'check',requirement:'R1',expect:{relations:[{left:'derived.plan.length',op:'eq',right:'derived.cur.days'}]}}],stalledSteps:[{op:'click',name:'选这条',index:2,requirement:'R1',expect:{relations:[{left:'derived.plan.length',op:'eq',right:'derived.cur.days'}]}}]},
]
const selected=process.argv.find(x=>x.startsWith('--case='))?.slice(7)
const results=process.argv.includes('--host-only')||selected?(await read(root+'/results.json')).filter(r=>r.id!==selected):[]
for(const c of process.argv.includes('--host-only')?[]:cases.filter(c=>!selected||c.id===selected)){
 const dir=`${root}/${c.id}`;await mkdir(dir,{recursive:true});await writeFile(dir+'/source.cardspec',c.source)
 let browserRuns=0;const started=Date.now()
 const d=createDebugSession({context:()=>({...c.context,extendedGeneration:true}),artifactRoot:root+'/debug',cardId:c.id,runner:(spec,o)=>runDebugBrowser(spec,{...o,viewports:[432,320],size:c.context.cardSize||'auto',captureSteps:true,artifactDir:`${dir}/browser-${++browserRuns}`})})
 const first=await d.test({source:c.source,steps:c.steps})
 const originalEvidence=d.evidence();await writeFile(dir+'/verified.json',JSON.stringify(originalEvidence,null,2))
 // Controlled no-progress stimulus, separately labelled from actual model output.
 let probes=0,failedFeedback;while(!d.stopResult()&&probes<5){probes++;failedFeedback=await d.retest({version:first.version,steps:c.stalledSteps||[{op:'click',name:'QA 不存在的操作',requirement:'R1',expect:{text:'QA 未实现结果'}}]})}
 const saved=d.stopResult(),retained= saved?.source?await d.test({source:saved.source},{final:true}):null
 const healthy=originalEvidence.status==='tested'&&originalEvidence.runs.every(r=>!r.pageErrors?.length&&r.actions.every(a=>a.ok&&a.assertion?.passed!==false&&a.restored!==false))
 const result={id:c.id,elapsedMs:Date.now()-started,browserRuns,first:first.status,originalPathsPass:healthy,actualBusinessFailure:!!c.stalledSteps,failureLane:failedFeedback?.repairLane,retainedUnchanged:saved?.source===c.source,retainedStatus:retained?.status,stopAfterNoProgress:probes,pending:saved?.remainingTasks,passed:healthy&&saved?.source===c.source&&probes===3&&retained?.status==='partial'&&(!c.stalledSteps||failedFeedback.repairLane==='behavior-review'),scope:c.stalledSteps?'Actual generated source; real route-days inconsistency must remain a behavior-review task, not silently pass':'Actual generated source + fresh 432/320 browser replay; repeated locator errors are controlled stagnation probes, no new generation'}
 await writeFile(dir+'/trace.json',JSON.stringify(d.snapshot(),null,2));results.push(result);console.log(JSON.stringify({id:c.id,...result,pending:result.pending?.length}));await writeFile(root+'/results.json',JSON.stringify(results,null,2))
}
if(selected)process.exit(results.some(r=>!r.passed)?1:0)
// Reuse the actual model-authored bad reload expectation; no new model needed.
const bad=await read('artifacts/rats-debug-qa/model-retest/model-trace.json'),input=JSON.parse(bad.response.message.tool_calls[0].function.arguments)
let hostRuns=0;const start=Date.now(),host=createDebugSession({context:()=>rats.spec.context,artifactRoot:root+'/debug',cardId:process.argv.includes('--host-only')?'host-repair-after-build':'host-repair',runner:(spec,o)=>runDebugBrowser(spec,{...o,viewports:[432,320],captureSteps:true,artifactDir:`${root}/host-repair/browser-${++hostRuns}`})})
await host.test({source:rats.source,steps:input.steps});const corrected=await host.hostRepair()
const hostResult={modelCalls:0,browserRuns:hostRuns,elapsedMs:Date.now()-start,passed:corrected?.hostRepair?.verified===true,sourceUnchanged:corrected?host.commit({version:corrected.version}).source===rats.source:false,audit:corrected?.hostRepair}
await writeFile(root+'/host-repair.json',JSON.stringify(hostResult,null,2));console.log(JSON.stringify(hostResult))
if(results.some(r=>!r.passed)||!hostResult.passed)process.exitCode=1
