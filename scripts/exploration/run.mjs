import {createRepairLimit} from './repair-limit.mjs'
import fs from 'node:fs/promises'
import {mkdirSync,writeFileSync} from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {generateCard} from '../../server/cardspec/generation.mjs'
import {createModelClient} from '../../server/research/model-client.mjs'
import {createResearchSession} from '../../server/research/session.mjs'
import {createGenerationTools} from '../../server/cardspec/generation-tools.mjs'
import {createGenerationBudget} from '../../server/cardspec/budget.mjs'
import {runDebugBrowser} from '../../server/cardspec/debug-browser.mjs'
import {loadApiKey} from '../../server/env.mjs'
import {createRsiJournal,redact} from '../../server/rsi-journal.mjs'
import {matchRecordedSnapshot,replayMiss,RECORDED_REPLAY_MODE} from '../../shared/cardspec/recorded-replay.mjs'
import {componentSelection} from '../../shared/cardspec/component-selection.mjs'
import {modelCost} from '../../shared/model-cost.mjs'
const ROOT=path.resolve('experiments/round1-20261117'),hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex')
const save=async(p,v)=>{await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,JSON.stringify(redact(v),null,2))}
const tasksetArg=process.argv.find(a=>a.startsWith('--taskset='))?.slice(10)
const tasks=(JSON.parse(await fs.readFile(tasksetArg||ROOT+'/tasks/screen.json','utf8'))).tasks
const baseCatalog=(JSON.parse(await fs.readFile(ROOT+'/catalog.json','utf8'))).tools
const snapshotArg=process.argv.find(a=>a.startsWith('--snapshot='))?.slice(11)
const live=JSON.parse(await fs.readFile(snapshotArg||ROOT+'/data/snapshot.json','utf8'))
const health=JSON.parse(await fs.readFile(ROOT+'/health.json','utf8'))
const key=loadApiKey(),MODEL='volcengine/deepseek-v4.1-flash'
const policy={profile:'adaptive-v1',timeoutMs:240000,modelCalls:8,repairs:2,reads:12,complex:true,debugGeneration:true,plan:false,validationReserveMs:20000}
const axes={B1:{},S1:{disclosure:'on-demand-v1'},S2:{mechanisms:'executable-v1'},C1:{behaviors:'inspect-return-v1'},H1:{layout:'subject-first-v1'},H2:{logicSnapshots:'readonly-v1'},V1:{},H1S1:{disclosure:'on-demand-v1',layout:'subject-first-v2'}}
const args=Object.fromEntries(process.argv.slice(2).map(x=>x.replace(/^--/,'').split('=')))
if(['r3','r4'].includes(args.revision))axes.H1.layout='subject-first-v2'
const replayMode=args.replay===RECORDED_REPLAY_MODE?RECORDED_REPLAY_MODE:undefined
if(args.replay&&!replayMode)throw Error('Unknown replay mode')
const loadedCodeVersion=JSON.parse(await fs.readFile(ROOT+'/code-version.json','utf8'))
const loadedRunnerHash=hash(await fs.readFile(new URL(import.meta.url),'utf8'))
const selectedTasks=args.tasks?tasks.filter(t=>args.tasks.split(',').includes(t.id)):tasks
const selectedConditions=args.conditions?args.conditions.split(','):Object.keys(axes)
const applicability=(t,c)=>c==='H2'&&t.id!=='screen-03-water-transfer'?'requires logic-owned time-varying graphics':c==='C1'&&!['screen-01-recording-kit','screen-04-luminous-library'].includes(t.id)?'inspect-return not the isolated behavior under test':null
let progress;try{progress=JSON.parse(await fs.readFile(ROOT+'/progress.json','utf8'))}catch{progress={study:'round1-20261117',runs:[],mainRuns:0,infrastructureReruns:0,engineeringStartedAt:'2026-11-17T06:45:19.989Z'}}
async function progressSave(){progress.updatedAt=new Date().toISOString();await save(ROOT+'/progress.json',progress)}
async function run(t,c){
 const revision=args.revision||(['C1','V1'].includes(c)?'r2':'r1')
 const id=t.id+'-'+c+'-'+revision+(args.repeat?'-rep'+args.repeat:''),dir=ROOT+'/runs/'+id
 if(progress.runs.some(r=>r.id===id&&r.status!=='running'))return
 let reason=applicability(t,c),baseline,prefix=[]
 if(c==='V1'){
  try{baseline=JSON.parse(await fs.readFile(ROOT+'/runs/'+t.id+'-B1-r1/branch-point.json','utf8'));prefix=JSON.parse(await fs.readFile(ROOT+'/runs/'+t.id+'-B1-r1/rounds.json','utf8')).slice(0,baseline.rounds)
   if(baseline.elapsedAtBranchMs==null){const es=(await fs.readFile(ROOT+'/runs/'+t.id+'-B1-r1/trace.redacted.jsonl','utf8')).trim().split('\n').map(JSON.parse);baseline.elapsedAtBranchMs=es.find(e=>e.type==='debug_feedback')?.atMs??null}
   if(baseline.elapsedAtBranchMs==null)reason='shared draft elapsed time unavailable'
   if(!baseline.needsRepair)reason='same B1 draft did not trigger a repair needing screenshot feedback'
   if(!baseline.screenshot)reason='no corresponding first-draft screenshot'
  }catch{reason='B1 did not produce a valid screenshot repair branch point'}
 }
 if(reason){progress.runs.push({id,task:t.id,condition:c,status:'not_applicable',reason,counted:false});await progressSave();console.log(JSON.stringify(progress.runs.at(-1)));return}
 if(progress.mainRuns>=280)throw Error('main run budget exhausted')
 await fs.mkdir(dir+'/source-versions',{recursive:true})
 const index=progress.runs.findIndex(r=>r.id===id)
 if(index>=0){progress.runs[index].status='interrupted';throw Error('Interrupted run retained; explicit infrastructure decision required, not automatic rerun')}
 const record={id,task:t.id,condition:c,status:'running',startedAt:new Date().toISOString(),counted:true};progress.runs.push(record);progress.mainRuns++;await progressSave()
 const sharedElapsedMs=c==='V1'?baseline.elapsedAtBranchMs:0,runPolicy={...policy,timeoutMs:Math.max(1,policy.timeoutMs-sharedElapsedMs)}
 const start=Date.now(),controller=new AbortController(),deadline=setTimeout(()=>controller.abort(Object.assign(Error('240s experiment deadline'),{code:'GENERATION_TIMEOUT'})),runPolicy.timeoutMs)
 const budget=createGenerationBudget(runPolicy),rounds=[],wire=[],pending=[],events=[],toolCalls=[],candidates=[],browsers=[]
 let response,lastCandidate,firstDraft,firstFeedback,branchPoint,sourceRepairs=0
 const repairLimit=createRepairLimit(2),rawCandidateHashes=new Set()
 let prefixAt=0,screenshotAttached=false,error
 const cardId=hash(t.id).slice(0,8)+'-1111-4111-8111-'+hash(t.id).slice(8,20)
 const catalog=t.dataMode==='recorded-live'?baseCatalog.map(x=>({...x,available:x.available&&['opencli.wikipedia.search','opencli.wikipedia.page','opencli.wikipedia.summary'].includes(x.id)})):[]
 const snapshots=t.dataMode==='recorded-live'?live.records.map((r,i)=>({id:'D'+(i+1),tool:r.tool,input:r.input,value:r.result.value,updatedAt:r.at,...(r.metadata?{metadata:r.metadata}:{})})):[]
 const experiment={study:'round1-20261117',condition:c==='V1'?'B1':c,revision:c==='V1'?'r1':revision,frozenAt:'2026-11-17T06:45:19.989Z',...axes[c]}
 const view={renderMode:'hybrid',modelProfile:'deepseek-flash',expressionDialect:'js-v1',cardSize:'square',generationMode:'direct',generationProfile:'adaptive-v1',buildMode:'quick',debugGeneration:true,contentRelations:'on',experiment}
 const emit=e=>{events.push({atMs:Date.now()-start,...redact(e)});journalResponse.write('data: '+JSON.stringify(redact(e))+'\n\n')}
 const fetchImpl=async(url,options)=>{
  const actual=JSON.parse(options.body),entry={index:wire.length+1,atMs:Date.now()-start,request:redact(actual),promptHash:hash(actual.messages),parameters:Object.fromEntries(Object.entries(actual).filter(([k])=>!['messages','tools'].includes(k))),tools:actual.tools?.map(t=>t.function.name)||[]};wire.push(entry)
  await save(dir+'/actual-requests.json',wire)
  const res=await fetch(url,options);entry.httpStatus=res.status
  const p=res.clone().text().then(text=>{for(const line of text.split('\n'))if(line.startsWith('data:'))try{const j=JSON.parse(line.slice(5));if(j.model)entry.resolvedModel=j.model;if(j.usage)entry.usage=j.usage}catch{}entry.completedAtMs=Date.now()-start}).catch(e=>entry.transportError=e.message);pending.push(p)
  return res
 }
 const raw=createModelClient({base:health.upstream,key:key.value,model:MODEL,fetchImpl})
 const journal=createRsiJournal({root:dir+'/rsi',round:raw,autoAnalyze:false})
 const journalRequest={headers:{'x-rsi-record-id':t.id+'-paired'},destroyed:false}
 const headers={},journalResponse={statusCode:200,destroyed:false,writableEnded:false,setHeader:(k,v)=>headers[k]=v,getHeader:k=>headers[k],write:()=>true,end(){this.writableEnded=true}}
 journalResponse.setHeader('Content-Type','text/event-stream')
 const round=async(messages,options)=>{
  controller.signal.throwIfAborted()
  if(!repairLimit.canRequest())throw Object.assign(Error('2 unique CardSpec repair versions completed; no further model request'),{code:'GENERATION_BUDGET'})
  if(c==='V1'&&prefixAt<prefix.length){const old=prefix[prefixAt++];rounds.push({...old,sharedFrom:t.id+'-B1-r1',charged:false,replayRequestHash:hash(messages)});return structuredClone(old.response)}
  if(wire.length>=8-prefix.length)throw Object.assign(Error('8 total model requests including shared draft exhausted'),{code:'GENERATION_BUDGET'})
  let submitted=messages
  if(c==='V1'&&firstFeedback&&!screenshotAttached){
   const image=await fs.readFile(baseline.screenshot)
   const savedRounds=JSON.parse(await fs.readFile(ROOT+'/runs/'+t.id+'-B1-r1/rounds.json','utf8'))
   submitted=[...(savedRounds[baseline.rounds]?.messages||messages),{role:'user',content:[{type:'text',text:'与数值/行为反馈对应的同一初稿关键状态截图。只修复已报告问题，保留功能。'},{type:'image_url',image_url:{url:'data:image/png;base64,'+image.toString('base64')}}]}]
   screenshotAttached=true
  }
  const entry={index:rounds.length+1,messages:redact(submitted),requestedParameters:{maxTokens:options.maxTokens,temperature:options.temperature,reasoningEffort:options.reasoningEffort},charged:true,startedAtMs:Date.now()-start};rounds.push(entry)
  try{entry.response=await journal.model(raw,submitted,options);return entry.response}catch(e){entry.error={message:e.message,code:e.code,usage:e.usage};throw e}finally{entry.elapsedMs=Date.now()-start-entry.startedAtMs;await save(dir+'/rounds.json',rounds)}
 }
 const invoke=async(payload)=>{const call={tool:payload.tool,input:payload.input,mode:'recorded-live',atMs:Date.now()-start};toolCalls.push(call);const match=matchRecordedSnapshot(snapshots,payload,{allowPrefix:replayMode===RECORDED_REPLAY_MODE});if(!match){const error=replayMiss(payload.tool);call.error=error.message;call.code=error.code;throw error}call.snapshotHash=hash(match.record.value);call.resultHash=hash(match.value);call.result=match.value;call.match=match.match;if(match.snapshotCoverage)call.snapshotCoverage=match.snapshotCoverage;return {kind:'json',value:match.value,...(match.snapshotCoverage?{snapshotCoverage:match.snapshotCoverage}:{})}}
 const extensions=createGenerationTools({catalog,invoke,budget,experiment,initialRecords:snapshots,renderMode:'hybrid',enabled:!!catalog.length,allowDeck:false,goal:t.prompt,allowPlanning:false})
 
 const streamUpstream=async(messages,options)=>options.research?options.research.run(round,messages,options):(budget.model(options.stage||'generate'),(await round(messages,options)).message.content)
 const runner=async(spec,options)=>{
  const out=dir+'/screenshots/test-'+(browsers.length+1)
  if(c==='V1'&&!browsers.length){
   const prior=JSON.parse(await fs.readFile(ROOT+'/runs/'+t.id+'-B1-r1/browser-1.json','utf8'))
   if(hash(spec.context)!==prior.contextHash||hash(options.steps)!==hash(prior.options.steps)||hash(lastCandidate?.source)!==prior.sourceHash)throw Object.assign(Error('Paired source/context/test mismatch'),{code:'PAIR_INVALID'})
   const replay={...prior,sharedFrom:t.id+'-B1-r1',charged:false};browsers.push(replay);await save(dir+'/browser-1.json',replay);return structuredClone(prior.result)
  }
  const r=await runDebugBrowser(spec,{...options,...(replayMode?{replayMode}:{}),artifactDir:out,captureSteps:true,seed:73129})
  browsers.push({sourceHash:lastCandidate?.source?hash(lastCandidate.source):null,contextHash:hash(spec.context),spec,options:{steps:options.steps,scenarios:options.scenarios},artifactDir:out,result:r})
  await save(dir+'/browser-'+browsers.length+'.json',browsers.at(-1))
  return r
 }
 const candidate=x=>{
  if(typeof x.source!=='string')return
  const sourceHash=hash(x.source)
  if(!rawCandidateHashes.has(sourceHash)){rawCandidateHashes.add(sourceHash);writeFileSync(dir+`/source-versions/attempt-${String(rawCandidateHashes.size).padStart(2,'0')}.txt`,x.source)}
  const observation=repairLimit.observe(x.source)
  if(observation.kind==='not-card-source'){events.push({type:'candidate_rejected',atMs:Date.now()-start,reason:'not-card-source',sourceHash});return}
  if(observation.kind!=='duplicate'){
   if(observation.kind==='limit'){const e=Object.assign(Error('2 unique CardSpec repair versions exhausted; rejected proposal retained'),{code:'GENERATION_BUDGET'});events.push({type:'candidate_rejected',atMs:Date.now()-start,reason:'unique-repair-limit',sourceHash});controller.abort(e);throw e}
   sourceRepairs=repairLimit.repairs;candidates.push(x);const n=candidates.length;writeFileSync(dir+`/source-versions/${String(n).padStart(2,'0')}.cardspec`,x.source);writeFileSync(dir+`/source-versions/${String(n).padStart(2,'0')}.json`,JSON.stringify(redact(x),null,2))
  }
  lastCandidate=x
  if(!firstDraft)firstDraft={source:x.source,sourceHash,rounds:rounds.length}
 }
 const traceEmit=e=>{emit(e);if(e.type==='debug_feedback'&&!firstFeedback){firstFeedback=e;const b=browsers[0];branchPoint={elapsedAtBranchMs:Date.now()-start,rounds:firstDraft?.rounds||rounds.length,sourceHash:firstDraft?.sourceHash,source:firstDraft?.source,contextHash:b?.contextHash,steps:b?.options.steps,feedback:e,needsRepair:e.status==='failed'||e.diagnostics?.some(d=>d.severity==='error'),screenshot:b?.result.runs?.[0]?.screenshot?path.join(b.artifactDir,b.result.runs[0].screenshot):null};writeFileSync(dir+'/branch-point.json',JSON.stringify(redact(branchPoint),null,2))}}
 // Research events and direct generation share the same recorder; feedback must
 // be observed before the next model turn, without modifying the debug contract.
 // One research session; no second execution path.
 let sink=traceEmit
 // Recreate only the session envelope, preserving the same extension/records.
 const activeResearch=createResearchSession({providers:null,onEvent:e=>sink(e),maxRounds:12,maxCalls:12,maxContextChars:18000,timeoutMs:240000,budget,extensions})
 await save(dir+'/request.json',{task:{id:t.id,hash:t.promptHash,family:t.family,prompt:t.prompt},view,policy,runPolicy,sharedElapsedMs,replayMode})
 await save(dir+'/snapshots.json',snapshots)
 await save(dir+'/effective-config.json',{model:{requested:MODEL,resolved:'unknown'},condition:{requested:c,effective:experiment},view,policy,runPolicy,sharedElapsedMs,replayMode,componentSelection:componentSelection(t.prompt,{renderMode:'hybrid',toolsEnabled:!!catalog.length}),capabilityHash:hash(catalog),data:{mode:t.dataMode,snapshotHash:hash(snapshots.length?snapshots:t.data)},runtime:{backend:'same built CardRenderer',viewport:{width:432,height:900,cardSize:'square'},seed:73129,modelSeed:null},resourcePolicy:'No external image acquisition during comparison; no image-first; fixed replay for tools',evaluationModelCalls:0})
 try{await journal.capture(journalRequest,journalResponse,{kind:'experiment',condition:c},async()=>{await journal.describe({messages:[{role:'user',content:t.prompt}],...view});response=await generateCard({streamUpstream,research:activeResearch,budget,catalog,input:{prompt:t.prompt},view,cardId,signal:controller.signal,photo:null,emit:traceEmit,onDebugCandidate:candidate,debugRunner:runner});journalResponse.write('data: '+JSON.stringify({type:'result',result:response})+'\n\n')})}catch(e){error={message:e.message,code:e.code||null};emit({type:'run_error',...error})}finally{clearTimeout(deadline);await Promise.allSettled(pending)}
 if(c==='V1'&&firstDraft?.sourceHash!==baseline.sourceHash)error={message:'Paired draft hash mismatch',code:'PAIR_INVALID'}
 if(!response&&lastCandidate?.spec){
  const ranked=candidates.filter(x=>x.spec).map(x=>{const b=browsers.filter(b=>b.sourceHash===hash(x.source)).at(-1);const runs=b?.result?.runs||[];const passed=runs.flatMap(r=>r.actions||[]).filter(a=>a.ok&&!a.skipped&&a.assertion?.passed!==false&&a.restored!==false).length;const failed=runs.flatMap(r=>r.actions||[]).filter(a=>!a.ok||a.skipped||a.assertion?.passed===false||a.restored===false).length;return {x,b,passed,failed}}).sort((a,b)=>Number(!!b.b)-Number(!!a.b)||b.passed-a.passed||a.failed-b.failed)
  const best=ranked[0]||{x:lastCandidate,passed:0,failed:0};response={source:best.x.source,spec:best.x.spec,resources:{},unverifiedPreview:true,retention:{basis:'most observed successful actions, then fewer failed actions; task correctness remains independently unverified',passedActions:best.passed,failedActions:best.failed,sourceHash:hash(best.x.source)}}
 }
 await save(dir+'/result.json',response||{source:lastCandidate?.source||'',spec:null,error})
 await save(dir+'/rounds.json',rounds);await save(dir+'/actual-requests.json',wire)
 await fs.writeFile(dir+'/trace.redacted.jsonl',events.map(e=>JSON.stringify(e)).join('\n')+'\n')
 const usages=wire.map(w=>w.usage).filter(Boolean),tokens=usages.length===wire.length?usages.reduce((a,u)=>({input:a.input+(u.prompt_tokens||0),output:a.output+(u.completion_tokens||0),total:a.total+(u.total_tokens||0)}),{input:0,output:0,total:0}):null
 Object.assign(record,{status:error?'failed':'generated',revision,elapsedMs:Date.now()-start+sharedElapsedMs,incrementalElapsedMs:Date.now()-start,sharedElapsedMs,error,sourceHash:response?.source?hash(response.source):null,verification:response?.spec?.verificationStatus||'unverified',modelCalls:wire.length,sharedDraftCalls:prefix.length,repairs:sourceRepairs,usage:tokens,costUSD:null,costReason:'No verified provider price for this gateway profile',artifact:dir.replaceAll('\\','/'),dataMode:t.dataMode})
 await save(dir+'/run.json',{runId:id,task:{id:t.id,hash:t.promptHash,family:t.family,split:t.split||'screen'},code:{...loadedCodeVersion,runnerHash:loadedRunnerHash},condition:{requested:c,effective:experiment,revision},model:{requested:MODEL,resolved:[...new Set(wire.map(w=>w.resolvedModel).filter(Boolean))],actualParameters:wire.map(w=>w.parameters)},context:{promptHashes:wire.map(w=>w.promptHash),capabilityHash:hash(catalog)},runtime:{renderMode:'hybrid',viewport:{width:432,height:900},gpuStatus:'webgl-probed; no 3D task claim'},data:{mode:t.dataMode,snapshotHash:hash(snapshots.length?snapshots:t.data)},sources:toolCalls,requirements:t.promptHash,usage:{modelCalls:wire.length,sharedDraftCalls:prefix.length,toolCalls:toolCalls.length,repairs:sourceRepairs,tokens,elapsedMs:record.elapsedMs,incrementalElapsedMs:record.incrementalElapsedMs,sharedElapsedMs,costUSD:null},result:{taskStatus:'unverified',generationStatus:record.status,error,verification:record.verification},manualIntervention:null,humanPreference:null,evidence:{sourceHash:record.sourceHash,contextHash:hash(response?.spec?.context||{}),browsers:browsers.length,sourceVersions:candidates.length},paired:c==='V1'?{baseline:t.id+'-B1-r1',sameDraft:baseline.sourceHash===firstDraft?.sourceHash,screenshotAttached}:null})
 await progressSave();console.log(JSON.stringify(record))
}
// Fixed interleaving within task; V1 follows its common B1 draft by necessity.
for(let i=0;i<selectedTasks.length;i++){
 const scheduleKey=selectedTasks[i].id+(args.repeat||'')
 const rotated=selectedConditions.filter(c=>c!=='V1').sort((a,b)=>hash(scheduleKey+a).localeCompare(hash(scheduleKey+b)))
 for(const c of [...rotated,...(selectedConditions.includes('V1')?['V1']:[])])await run(selectedTasks[i],c)
}
await progressSave()
