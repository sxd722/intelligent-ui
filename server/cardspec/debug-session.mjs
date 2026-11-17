import {terminalJourneyCoverage,TERMINAL_JOURNEY_GUIDANCE,needsTerminalJourneys} from './terminal-journeys.mjs'
import {taskBehaviorDiagnostics,taskBehaviorCoverage,createBehaviorLedger} from '../../shared/cardspec/task-behavior.mjs'
import {journeyCoverage} from './journey-coverage.mjs'
import {coverageDiagnostics} from '../../shared/cardspec/task-evidence.mjs'
import {sandboxOwnershipDiagnostics} from '../../shared/cardspec/sandbox-policy.mjs'
import {createConvergenceGuard} from './debug-convergence.mjs'
import {bindingPlanDiagnostics} from './binding-plan.mjs'
import {hasContentVisual,protectContentVisual} from '../../shared/cardspec/visual-intent.mjs'
import {createHash,randomUUID} from 'node:crypto'
import {saveDebugArtifact} from './debug-artifacts.mjs'
import {resolve} from 'node:path'
import {compileCard} from '../../shared/cardspec/compiler.mjs'
import {contentIntegrity} from '../../shared/cardspec/content-integrity.mjs'
import {validateRichContent} from './rich-validation.mjs'
import {runDebugBrowser} from './debug-browser.mjs'
import {repairCapabilities,lostRepairCapabilities} from './repair-capabilities.mjs'
import {contextualDiagnostics} from '../../shared/cardspec/diagnostic-context.mjs'
import {validateExpectation,JOURNEY_EXPECTATION_SCHEMA} from '../../shared/cardspec/debug-assertions.mjs'
import {behaviorFootprint,lostBehaviors} from './requirements.mjs'
import {createVisualEvidenceGuard} from './visual-evidence.mjs'
import {summarizeDebugFeedback} from './debug-feedback.mjs'
import {createTestOracle} from './test-oracle.mjs'
import {createProgressLedger,remainingTasks} from './debug-progress.mjs'

export const DEBUG_ROLES=['button','link','tab','checkbox','radio','switch','slider','textbox','combobox']
export const CARD_TEST_TOOL={type:'function',function:{
 name:'card_test',description:'在真实渲染器中调试完整CardSpec文档（包含card根，不能只提交JSX）。CLI离线重放已取快照，未取到时用mock；不新增网络调用；返回错误、控件和交互变化。expect.state检查原生状态；expect.terminal检查原生或沙箱持久化终局。异步动作可用waitMs等待后再断言。',
 parameters:{type:'object',additionalProperties:false,required:['source'],properties:{
  source:{type:'string',maxLength:24000},
  steps:{type:'array',maxItems:64,items:{type:'object',additionalProperties:false,required:['op'],properties:{
   op:{type:'string',enum:['click','fill','select','reload','check']},name:{type:'string',maxLength:100,description:'控件实际可访问名称，不是步骤说明；click 不把目标写在 value'},
   path:{type:'string',enum:['win','loss','restore'],description:'Independent path from initial state'},repeat:{type:'integer',minimum:1,maximum:30,description:'Repeat click; expect only after final repetition'},
   requirement:{type:'string',pattern:'^R[0-9]+$'},waitMs:{type:'integer',minimum:0,maximum:3000},expect:{type:'object',additionalProperties:false,properties:{...JOURNEY_EXPECTATION_SCHEMA,text:{type:'string'},state:{type:'object'},changed:{type:'boolean'},visual:{type:'boolean'},changedKeys:{type:'array',items:{type:'string'}},tool:{type:'string'},changedResults:{type:'array',items:{type:'string'},description:'组件ID，验证结果内容变化，不计输入回显'},derived:{type:'object',description:'原生derived结果的精确期望值'},sandboxChanged:{type:'string',description:'sandbox id whose rendered output must change'}}},
   handle:{type:'string',maxLength:1200,description:'优先使用反馈中的控件 handle，不猜选择器'},scenario:{type:'string',enum:['normal','empty','failure']},
   role:{type:'string',enum:DEBUG_ROLES},index:{type:'integer',minimum:0,maximum:20,description:'同名控件序号，默认第一个'},value:{type:'string',maxLength:200}
  }}}
 }}
}}
export const CARD_COMMIT_TOOL={type:'function',function:{name:'card_commit',description:'提交已测试候选的 version，直接使用原源码，不再重写。须单独调用；partial 仅表示检查不完整，不代表全部通过。',parameters:{type:'object',additionalProperties:false,required:['version'],properties:{version:{type:'string',pattern:'^[a-f0-9]{20}$'}}}}}
export const CARD_RETEST_TOOL={type:'function',function:{name:'card_retest',description:'源码不变时复测或补测：只发已保存version和steps，不重复输出代码。每条路径从初始状态开始，包含前置操作；保留原路径与无冲突断言。',parameters:{type:'object',additionalProperties:false,required:['version','steps'],properties:{version:{type:'string',pattern:'^[a-f0-9]{20}$'},steps:CARD_TEST_TOOL.function.parameters.properties.steps}}}}
export const CARD_SOURCE_TOOL={type:'function',function:{name:'card_source',description:'仅在需要修改实现时读取已保存版本源码；补测无需读取。',parameters:{type:'object',additionalProperties:false,required:['version'],properties:{version:{type:'string',pattern:'^[a-f0-9]{20}$'}}}}}
export const DEBUG_INSTRUCTION='可先依据工具契约布局，用card_test(source,steps)在无网络快照/模拟中调试。steps用click/fill/select/reload和返回的handle或准确控件name，expect用具体text/state、结果changedKeys或实际tool调用验证业务，不能只用changed:true验证通知变化；优先expect.changedResults:[结果组件id]或expect.derived:{结果名:期望值}，修改条件后检查实际结果而非输入回显；宿主控件驱动沙箱时用expect.sandboxChanged指定沙箱id，外部派生值通过input传入并从App({data})读取，state只用于沙箱局部状态；默认只测normal；空/失败场景自动单独检查。测试稿可用后单独调用card_commit(version)提交原稿，不再抄写源码；交互任务先调用card_test并提供带requirement的关键路径结果断言；缺证据只算未验证候选，不能宣称CUJ通过。DEBUG_SAMPLE/DEBUG_MOCK不是事实，禁止写进源码；不要删除功能规避错误。repairLane=test时保持source不变，仅按证据修正测试并重跑原路径；behavior-review先核对需求与前置条件，不为迎合断言修改正确代码。'
export function validateDebugInput({source,steps=[]}={},maxSource=24000){
 if(typeof source!=='string'||!source.trim()||source.length>maxSource)throw Error(`card_test source must be 1–${maxSource} characters`)
 const deep=maxSource>24000,limit=64
 if(!Array.isArray(steps)||steps.length>limit)throw Error(`card_test allows at most ${limit} steps. Test-plan error only: keep the exact source, split checks into smaller independent paths; do not rewrite implementation.`)
 if(steps.reduce((n,s)=>n+(s?.repeat||1),0)>160)throw Error('card_test allows at most 160 expanded operations; retest independent paths separately, preserving source')
 steps=steps.map(s=>s&&['fill','select'].includes(s.op)&&typeof s.value==='number'&&Number.isFinite(s.value)?{...s,value:String(s.value)}:s)
 const fail=(index,field,reason)=>{throw Error(`invalid card_test step ${index+1}.${field}: ${reason}. Test-plan error only: keep source unchanged and fix this step using observed controls/handles.`)}
 steps.forEach((s,i)=>{
  if(!s||typeof s!=='object'||Array.isArray(s))fail(i,'step','expected object')
  const unknown=Object.keys(s).find(k=>!['op','name','handle','scenario','role','value','index','requirement','expect','waitMs','path','repeat'].includes(k))
  if(unknown)fail(i,unknown,'unsupported field')
  if(!['click','fill','select','reload','check'].includes(s.op))fail(i,'op','use click/fill/select/reload/check')
  if(!['reload','check'].includes(s.op)&&!s.handle&&(typeof s.name!=='string'||!s.name.trim()||s.name.length>100))fail(i,'name','use the observed accessible label (1–100 characters)')
  if(s.handle!==undefined&&(typeof s.handle!=='string'||!s.handle||s.handle.length>1200))fail(i,'handle','use a returned control handle')
  if(s.scenario!==undefined&&!['normal','empty','failure'].includes(s.scenario))fail(i,'scenario','use normal/empty/failure')
  if(s.path!==undefined&&!['win','loss','restore'].includes(s.path))fail(i,'path','use win/loss/restore')
  if(s.repeat!==undefined&&(s.op!=='click'||!Number.isInteger(s.repeat)||s.repeat<1||s.repeat>30))fail(i,'repeat','click only, integer 1–30')
  if(s.role!==undefined&&!DEBUG_ROLES.includes(s.role))fail(i,'role','use an observed role: '+DEBUG_ROLES.join('/'))
  if(s.index!==undefined&&(!Number.isInteger(s.index)||s.index<0||s.index>20))fail(i,'index','integer 0–20')
  if(['fill','select'].includes(s.op)&&(typeof s.value!=='string'||s.value.length>200))fail(i,'value','string up to 200 characters')
  if(s.requirement!==undefined&&!/^R\d+$/.test(s.requirement))fail(i,'requirement','use an immutable R id')
  if(s.waitMs!==undefined&&(!Number.isInteger(s.waitMs)||s.waitMs<0||s.waitMs>3000))fail(i,'waitMs','integer 0–3000 milliseconds')
  if(s.expect)try{validateExpectation(s.expect)}catch(e){fail(i,'expect',e.message)}
 })
 return {source,steps}
}
export function createDebugSession({context=()=>({}),bindingRecords=()=>[],catalog=[],complex=false,budget,runner=runDebugBrowser,emit=()=>{},onCandidate=()=>{},artifactRoot=resolve('artifacts/generation-debug'),cardId=randomUUID(),progressPatience=3}={}){
 const maxRepairs=budget?.policy.repairs??8,maxTests=context().extendedGeneration?Infinity:context().buildMode==='deep'?20:maxRepairs+2,results=[],cache=new Map(),candidates=new Map(),required=[],stepLedger=[]
 const mode=runner.runnerKind==='cloud-compile-only'?'compile-only':'mock-only'
 const visualGuard=createVisualEvidenceGuard(),convergence=createConvergenceGuard(),behaviorLedger=createBehaviorLedger(),oracle=createTestOracle(),verifiedPaths=new Map(),verifiedRuns=new Map()
 const progress=createProgressLedger({patience:progressPatience})
 const hostRepairs=new Set()
 let best,retained,progressContext
 const contextKey=()=>createHash('sha256').update(JSON.stringify(context())).digest('hex').slice(0,20)
 const progressStopped=()=>context().buildMode!=='deep'&&progressContext===contextKey()&&(progress.stopped()||!!retained)
 function observeProgress(record,source,contextHash){
  if(progressContext!==contextHash){best=undefined;retained=undefined;progressContext=contextHash}
  record.progress=progress.observe(record,contextHash)
  const errors=record.diagnostics.filter(d=>d.severity==='error')
  const prefixes=(record.browser?.runs||[]).map(r=>{
   const end=r.actions?.findIndex(a=>!a.ok||a.assertion?.passed===false||a.restored===false)??0
   return (r.actions||[]).slice(0,end<0?undefined:end)
  })
  const cleanRuntime=record.browser?.runs?.length&&record.browser.runs.every(r=>!r.initial?.errors?.length&&!r.final?.errors?.length&&!r.pageErrors?.length&&!r.actions?.some(a=>a.errors?.length||a.restored===false))
  const completePaths=cleanRuntime&&record.browser.runs.every(r=>r.actions?.every(a=>a.ok&&a.assertion?.passed!==false))
  // A locator/occlusion failure later in a path must not erase witnessed useful
  // behavior. Retain only clean candidates with an asserted interactive prefix
  // in every viewport; failed business assertions still block via errors above.
  const prefixOnly=cleanRuntime&&!completePaths&&prefixes.every(p=>p.some(a=>a.ok&&!['check','reload'].includes(a.step?.op))&&p.some(a=>a.assertion?.passed===true))
  const executed=completePaths||prefixOnly
  if(record.compiled&&record.browser?.status==='tested'&&executed&&!errors.length&&['passed','partial'].includes(record.status)){
   const coverage=record.cujCoverage?.items||[],score=(record.terminalCoverage?.checked?.length||0)*100+coverage.filter(r=>r.status==='checked').length*100+(record.behaviorCoverage?.items||[]).filter(r=>r.status==='checked').length*20+(record.testedPaths||[]).length+Math.min(10,...prefixes.map(p=>p.filter(a=>a.assertion?.passed).length))
   if(!best||score>best.score)best={version:record.version,source,contextHash,score,record,evidence:record.browser,selection:prefixOnly?'verified-prefix':'verified-path',prefixSteps:prefixes.map(p=>p.length)}
  }
 }
 function stopResult(reason){
  if(reason&&!['model_output_truncated','model_omitted_submission','time_budget'].includes(reason))throw Error('Unsupported retention reason')
  if(!progressStopped()&&!(convergence.stopped()&&progressContext===contextKey())&&!(reason&&best?.contextHash===contextKey()))return null
  if(retained)return retained
  const tasks=remainingTasks(best,results.at(-1),{pendingTests:oracle.pending()})
  if(reason)tasks.push({id:'T'+(tasks.length+1),lane:'host',target:'model-output',reason:(reason==='time_budget'?'剩余预算保留给验证与交付':reason==='model_output_truncated'?'模型输出截断':'模型只返回结束说明，未提交源码或版本')+'；保留此前已验证源码，继续前检查输出协议与上下文，不重写业务代码。',status:'pending',baseVersion:best?.version})
  retained={status:'partial',reason:reason||(results.at(-1)?.convergence?.cycle?'repair_cycle':'no_effective_progress'),version:best?.version,source:best?.source,selection:best?.selection,prefixSteps:best?.prefixSteps,remainingTasks:tasks,progress:progress.snapshot(),scope:'Best usable candidate retained; outstanding tasks are not passed and do not run automatically.'}
  emit({type:'debug_stopped',status:'partial',version:retained.version,reason:retained.reason,remainingTasks:tasks})
  return retained
 }
 const checkedFeedback=(feedback,evidence,contextHash)=>{
  const issues=visualGuard.compare(evidence,contextHash)
  return issues.length?{...feedback,status:'failed',diagnostics:[...issues,...feedback.diagnostics]}:feedback
 }
 let visualIntent=false
 let committed,behaviorBaseline=[],lastEvidence
 let calls=0,repairUsed=0,reserved=false,lastVersion,lastFailed=false
 const repair=()=>{if(progressStopped()||convergence.stopped())throw Error('Debug stopped: repeated failure without progress; candidate retained for inspection');if(repairUsed>=maxRepairs)throw Error('调试修复次数已用完');budget?.repair();repairUsed++;reserved=true}
 const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,20)
 async function test(input,{signal,final=false}={}){
  const {source,steps}=validateDebugInput(input,context().extendedGeneration||context().renderMode==='web'?120000:context().buildMode==='deep'?48000:24000),version=hash(source),contextHash=hash(JSON.stringify(context())),key=version+contextHash+JSON.stringify(behaviorLedger.paths())+JSON.stringify(final?stepLedger:steps)+(final?':final':'')
  signal?.throwIfAborted()
  if(progressStopped()||retained?.reason==='time_budget'){
   const stopped=stopResult()
   if(final&&best?.version===version){lastEvidence=best.evidence;return {...best.record.feedback,status:'partial',progress:stopped.progress,remainingTasks:stopped.remainingTasks,retained:true}}
   return {status:'budget_exhausted',version,reason:stopped.reason,remainingTasks:stopped.remainingTasks}
  }
  if(cache.has(key)){
   const hit=cache.get(key)
   if(!final)await onCandidate({source,version,spec:hit.spec,diagnostics:hit.feedback.diagnostics})
   lastEvidence=hit.evidence
   // A cached failure saves a browser run, not a no-progress attempt. Otherwise
   // repeating the identical wrong test bypasses the convergence guard forever.
   if(!final||hit.record.status==='failed'){
    const replay={...hit.record,cached:true,reusedEvidence:true,elapsedMs:0}
    observeProgress(replay,source,contextHash)
    replay.convergence=convergence.observe(replay);replay.feedback={...hit.feedback,convergence:replay.convergence,cached:true}
    replay.feedback.progress=replay.progress
    results.push(replay)
    try{await saveDebugArtifact(resolve(artifactRoot,cardId,version),source,replay,results.length)}catch(e){replay.artifactError=e.message}
    emit({type:'debug',...replay.feedback});return checkedFeedback(replay.feedback,lastEvidence,contextHash)
   }
   return {...checkedFeedback(hit.feedback,lastEvidence,contextHash),cached:true}
  }
  // Only reuse an exact candidate and context. Never rerender a committed
  // candidate merely because the model has finished its tool turn.
  const saved=candidates.get(version)
  if(final&&saved?.contextHash===contextHash&&saved.feedback.status!=='failed'&&!oracle.pending().length&&(!stepLedger.length||saved.testedPaths?.some(p=>JSON.stringify(p)===JSON.stringify(stepLedger)))&&!behaviorLedger.missing(saved.testedPaths||[]).length){lastEvidence=saved.evidence;return {...checkedFeedback(saved.feedback,lastEvidence,contextHash),cached:true}}
  if(!final&&(calls>=maxTests||convergence.stopped()))return {status:'budget_exhausted',version,instruction:'停止重复重写；保留最佳候选，明确未通过的验证，不得声称已通过。'}
  // Final output was already paid for by the current model turn. Validate it
  // even if earlier card_test attempts used the repair budget; do not charge a
  // second repair before knowing whether this final source is usable.
  if(version!==lastVersion){if(lastFailed&&!reserved&&!final)repair();reserved=false}
  calls++
  const started=Date.now(),directory=resolve(artifactRoot,cardId,version),result=compileCard(source,{final:true,cardId,context:context()})
  await validateRichContent(result)
  // Full DSL submission, before browser tests. Valid compiled modules can be
  // shown immediately, but this is a draft: no automatic tools or commit.
  await onCandidate({source,version,spec:result.complete?result.spec:null,diagnostics:result.diagnostics})
  const current=repairCapabilities(result.spec,catalog.map(t=>t.id))
  for(const cap of current)if(!required.some(r=>r.tool===cap.tool&&r.kind===cap.kind))required.push(cap)
  const diagnostics=[...result.diagnostics,...(result.spec?sandboxOwnershipDiagnostics(result.spec):[]),...bindingPlanDiagnostics(result.spec,context().bindingPlan||[],bindingRecords()),...contentIntegrity(result.spec),...coverageDiagnostics(result.spec,bindingRecords()),...taskBehaviorDiagnostics(result.spec),...lostRepairCapabilities(required,current),...lostBehaviors(behaviorBaseline,result.spec),...protectContentVisual(visualIntent,result.spec)]
  if(result.complete&&hasContentVisual(result.spec))visualIntent=true
  const hasSandbox=nodes=>(nodes||[]).some(n=>n.type==='sandbox'||hasSandbox(n.children))
  if(hasSandbox(result.spec?.children))diagnostics.push({severity:'warning',code:'debug_partial',message:context().renderMode==='web'?'Web 应用已预编译；仅覆盖实际浏览器步骤，可加载公开CDN，业务网络/API调用仍未验证。':'React 已预编译并隔离试运行；浏览器自动操作的覆盖范围以实际记录为准'})
  if(/DEBUG_(SAMPLE|MOCK)/.test(source))diagnostics.push({severity:'error',code:'debug_data_leak',message:'Remove mock fixture literals from production source'})
  let browser,testedPaths=[],oracleIssues=[]
  if(result.complete&&!diagnostics.some(d=>d.severity==='error')){
   emit({type:'debug',status:'running',version})
   try{browser=await runner(result.spec,{snapshots:bindingRecords(),...(!Object.keys(result.spec?.bindings||{}).length?{scenarios:[...new Set(['normal',...steps.map(s=>s.scenario).filter(Boolean)])]}:{}),steps:final?stepLedger:steps,width:context().viewport?.width||432,size:context().cardSize||'square',signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(Math.max(1,Math.min(budget?.remaining?.()??Infinity,steps.some(s=>s.path||s.repeat)?240000:context().extendedGeneration||context().renderMode==='web'?120000:context().buildMode==='deep'?45000:25000)))]),artifactDir:directory})}
   catch(e){signal?.throwIfAborted();browser={status:'unverified',reason:e.message,runs:[]}}
   testedPaths=[structuredClone(final?stepLedger:steps)]
   if(final&&browser.status==='tested')for(const [i,path]of behaviorLedger.missing(testedPaths).entries()){
    try{
     const extra=await runner(result.spec,{snapshots:bindingRecords(),steps:path,width:context().viewport?.width||432,size:context().cardSize||'square',scenarios:['normal'],signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(25000)]),artifactDir:resolve(directory,'retained-'+i)})
     browser.runs.push(...(extra.runs||[]));testedPaths.push(path)
     if(extra.status!=='tested'){browser.status='partial';browser.reason='Retained behavior path unverified: '+(extra.reason||extra.status)}
    }catch(e){signal?.throwIfAborted();browser.status='partial';browser.reason='Retained behavior path unverified: '+e.message}
   }
   if(browser.status==='unverified'){diagnostics.push({severity:'warning',code:'debug_unverified',message:`${browser.classification||'host_unverified'} / ${browser.phase||'runner'}: ${browser.reason}. 未验证不等于代码错误；不要凭超时重写整卡。`});for(const message of browser.observation?.errors||[])diagnostics.push({severity:'error',code:'debug_runtime',message})}
   if(browser.status==='partial')diagnostics.push({severity:'warning',code:'debug_partial',message:browser.reason})
   oracleIssues=context().buildMode==='deep'?[]:oracle.inspect(result.spec,browser,{version,contextHash})
   for(const run of browser.runs){
    for(const snapshot of [run.initial,...run.actions,run.final])for(const visual of snapshot?.visuals||[])for(const issue of visual.issues||[]){
     const id=visual.owner?.split('/').reverse().find(id=>Object.hasOwn(result.locations||{},id))
     diagnostics.push({severity:'error',code:'debug_visual_zero_size',message:`${run.width||432}px ${run.scenario}: ${issue.message}`,...(id?{node:id,offset:result.locations[id]}:{})})
    }
    if(run.initial.empty||run.final.empty)diagnostics.push({severity:'error',code:'debug_empty',message:run.scenario+': card body has no readable content or visual/interactive surface'})
    const errorDetails=[...(run.initial.errorDetails||[]),...(run.final.errorDetails||[]),...run.actions.flatMap(a=>a.errorDetails||[])]
    for(const message of [...run.initial.errors,...run.final.errors,...run.pageErrors,...run.actions.flatMap(a=>a.errors||[])]){
     const detail=errorDetails.find(e=>e.message===message&&e.node)
     const id=detail?.node.split('/').reverse().find(id=>Object.hasOwn(result.locations||{},id))
     diagnostics.push({severity:'error',code:'debug_runtime',message:`${run.scenario}: ${message}`,...(id?{offset:result.locations[id],node:id}:{})})
    }
    for(const action of run.actions){if(!action.ok||action.restored===false)diagnostics.push({severity:action.restored===false?'error':'warning',code:action.restored===false?'debug_interaction':'debug_test_step',message:`${run.scenario} ${action.step.op} ${action.step.name||action.step.handle||''}: ${action.error||('state not restored'+(action.restoreComparison?.differences?.length?': saved checkpoint differences '+JSON.stringify(action.restoreComparison.differences).slice(0,1200):''))}`});if(action.assertion?.passed===false)diagnostics.push({severity:'error',code:action.classification==='test_plan'?'debug_test_revision_required':action.classification==='test_oracle_conflict'?'debug_test_oracle_conflict':'requirement_assertion',message:action.classification==='test_oracle_conflict'?`Test-only revision: keep source ${version} unchanged and rerun the same operations. ${action.oracle.anchor?.kind==='host-contract'?'Host restoration contract':'Earlier passing evidence'} conflicts with this expectation; use expect=${JSON.stringify(action.oracle.expected)}. Original failures remain recorded until the corrected test passes.`:JSON.stringify(action.assertion.failures)})}
    for(const action of run.actions)if(action.oracle?.unresolvedFailures?.length)diagnostics.push({severity:'error',code:'requirement_assertion',message:JSON.stringify(action.oracle.unresolvedFailures)})
    if(run.final.horizontalOverflow)diagnostics.push({severity:'warning',code:'debug_overflow',message:run.scenario+': horizontal overflow'})
    for(const issue of [...(run.initial.layout?.issues||[]),...(run.final.layout?.issues||[])].slice(0,3))diagnostics.push({severity:'warning',code:'debug_layout',message:`${run.width||432}px ${run.scenario}: ${issue.element} ${issue.code}, available=${issue.available??''}, demand=${issue.demand??''}`})
    if(run.final.coverage.length)diagnostics.push({severity:'warning',code:'debug_partial',message:'部分工具只有稀疏字段 mock 或不支持模拟；不代表这些能力已验证'})
    if(run.actions.some(a=>a.ok&&!['reload','check'].includes(a.step.op)&&!a.changed))diagnostics.push({severity:'warning',code:'debug_no_feedback',message:run.scenario+': 部分操作未观察到状态、内容或工具调用变化；不等于业务逻辑正确'})
   }
   if(hasSandbox(result.spec?.children)&&browser.runs.some(r=>r.initial?.controls?.some(c=>!c.sandbox&&c.role==='slider'))&&!browser.runs.some(r=>r.actions.some(a=>a.ok&&a.step?.expect?.sandboxChanged&&a.assertion?.passed)))diagnostics.push({severity:'warning',code:'debug_linkage_unverified',message:'Native slider and sandbox coexist, but no sandboxChanged assertion passed. State echo alone does not verify linked visual output.'})
   diagnostics.push(...visualGuard.compare(browser,contextHash))
  }
  // Evidence accumulates only for this exact source + context. A new path must
  // not make already witnessed requirements disappear from the model feedback.
  // Keep current failures in the union; previous success never waives a failure.
  const verifiedKey=version+contextHash
  const previousRuns=context().buildMode==='deep'?[]:verifiedRuns.get(verifiedKey)||[]
  const coverageBrowser=browser?{...browser,runs:[...(browser.runs||[]),...previousRuns],reusedRunCount:previousRuns.length,evidenceVersion:version}:browser
  const terminalCoverage=terminalJourneyCoverage(context().userGoal||'',browser?{...browser,runs:[...(browser.runs||[]),...(verifiedRuns.get(verifiedKey)||[])]}:browser)
  if(terminalCoverage.required&&terminalCoverage.status!=='checked')diagnostics.push({severity:'warning',code:'debug_terminal_unverified',message:'Initial-to-terminal coverage missing: '+terminalCoverage.remaining.join(', ')+'. Test independent paths on this version; success text and initial-state reload do not count. Keep usable candidate marked partial.'})
  const behaviorCoverage=taskBehaviorCoverage(result.spec,coverageBrowser)
  const cujCoverage=context().buildMode==='deep'?{status:'delegated',items:[],scope:'深度构建使用其规划阶段的不可变需求ID和requirementAudit，不重新编号。'}:journeyCoverage(context().userGoal||'',result.spec,coverageBrowser)
  if(browser?.status==='tested'&&['unverified','partial'].includes(cujCoverage.status))diagnostics.push({severity:'warning',code:'debug_cuj_unverified',message:'CUJ evidence is partial. Interaction IDs without evidence: '+(cujCoverage.items.filter(r=>r.kind==='interaction'&&r.status!=='checked'&&r.status!=='other-card').map(r=>r.id).join(', ')||'none')+'. Retain passed paths; annotate missing requirement IDs without rewriting code. Content/design remain for review, not extra automatic tests. Partial may be committed; do not invent or repeatedly expand tests merely to remove this warning.'})
  if(browser?.status==='tested'&&behaviorCoverage.status==='partial')diagnostics.push({severity:'warning',code:'debug_task_unverified',message:'Input-to-result assertions remain unverified for '+behaviorCoverage.items.filter(x=>x.status!=='checked').map(x=>x.states.join('/')).join(', ')+'. Input echoes and default clicks do not prove the requested behavior.'})
  if(!final&&context().buildMode!=='deep')oracle.record(steps,browser,{version,contextHash},oracleIssues,behaviorLedger)
  if(oracle.pending().length&&!oracleIssues.length)diagnostics.push({severity:'error',code:'debug_test_revision_required',message:'An earlier contradictory test is unresolved. Return to its unchanged source and rerun its same operations with the evidence-backed expectations; do not remove assertions or rewrite the implementation to satisfy a conflicting oracle.'})
  const unique=contextualDiagnostics(source,[...new Map(diagnostics.map(d=>[d.code+':'+d.message,d])).values()])
  // Preserve a complete executable flow, including repeated clicks. A guessed
  // locator that never ran is feedback, not an immutable product requirement.
  const normal=browser?.runs.find(r=>r.scenario==='normal'),normalSteps=steps.filter(s=>!s.scenario||s.scenario==='normal')
  if(!final&&context().buildMode!=='deep')behaviorLedger.observe(normalSteps,normal)
  if(!final&&!stepLedger.length&&normalSteps.length&&normal?.actions.length===normalSteps.length&&normal.actions.every(a=>a.ok&&a.assertion?.passed!==false))stepLedger.push(...structuredClone(steps))
  if(browser?.status==='tested'&&!unique.some(d=>d.severity==='error')){
   const all=[...(verifiedPaths.get(verifiedKey)||[]),...testedPaths];testedPaths=[...new Map(all.map(p=>[JSON.stringify(p),p])).values()];verifiedPaths.set(verifiedKey,structuredClone(testedPaths))
   const successful=(browser.runs||[]).filter(r=>r.actions?.length&&r.actions.every(a=>a.ok&&a.assertion?.passed!==false&&a.restored!==false)&&!r.pageErrors?.length&&!r.initial?.errors?.length&&!r.final?.errors?.length)
   const runs=[...(verifiedRuns.get(verifiedKey)||[]),...successful]
   verifiedRuns.set(verifiedKey,[...new Map(runs.map(r=>[JSON.stringify([r.width,r.scenario,r.actions.map(a=>a.step)]),r])).values()].slice(-32))
  }
  const record={version,compiled:result.complete,status:unique.some(d=>d.severity==='error')?'failed':browser?.status==='partial'?'partial':browser?.status==='tested'?(unique.some(d=>['debug_terminal_unverified','debug_partial','debug_test_step','debug_layout','debug_linkage_unverified','debug_task_unverified','debug_cuj_unverified'].includes(d.code))?'partial':'passed'):'unverified',diagnostics:unique,elapsedMs:Date.now()-started,browser,steps:final?stepLedger:steps,testedPaths,retainedPaths:behaviorLedger.paths(),testOracle:oracle.snapshot(),behaviorCoverage,cujCoverage,terminalCoverage,final,mode}
  observeProgress(record,source,contextHash)
  record.convergence=convergence.observe(record)
  lastVersion=version;lastFailed=unique.some(d=>d.severity==='error'&&!['requirement_assertion','debug_test_step','debug_test_oracle_conflict','debug_test_revision_required'].includes(d.code))
  results.push(record)
  if(result.complete&&record.status!=='failed'){
   behaviorBaseline=[...new Set([...behaviorBaseline,...behaviorFootprint(result.spec)])]
   visualGuard.observe(browser,contextHash)
  }
  const feedback=summarizeDebugFeedback(record)
  record.feedback=structuredClone(feedback)
  try{await saveDebugArtifact(directory,source,record,results.length)}catch(e){record.artifactError=e.message}
  // Small return envelope; complete diagnostics/screenshots stay in local trace.
  // The model receives feedback, not a second full trace. Preserve root errors
  // first; raw steps, screenshots and complete observations stay on disk.
  // Raw evidence is the current execution, not a union of unrelated paths.
  // Deep-build audits depend on that scope; cumulative coverage belongs only
  // in behaviorCoverage/cujCoverage and the verified-path ledger above.
  lastEvidence=browser;cache.set(key,{record,feedback:structuredClone(feedback),evidence:browser,spec:result.complete?result.spec:null});candidates.set(version,{source,contextHash,evidence:browser,feedback:structuredClone(feedback),testedSteps:structuredClone(final?stepLedger:steps),testedPaths:structuredClone(testedPaths)});emit({type:'debug',...feedback});return feedback
 }
 function commit(input){
  if(!input||Object.keys(input).some(k=>k!=='version')||!/^[a-f0-9]{20}$/.test(input.version))throw Error('card_commit requires only a tested version')
  const saved=candidates.get(input.version)
  if(!saved||!['passed','partial'].includes(saved.feedback.status))throw Error('candidate is unknown, failed or unverified; test a usable candidate first')
  if(oracle.pending().length)throw Error('Test oracle conflict unresolved: rerun the evidence-backed test-only revision before commit')
  if(behaviorLedger.missing(saved.testedPaths||[]).length)throw Error('Earlier executable result assertions remain unverified. Re-test those paths on this source before commit; do not drop tests to obtain a pass.')
  if(saved.contextHash!==hash(JSON.stringify(context())))throw Error('candidate context changed; test again before committing')
  const spec=compileCard(saved.source,{final:true,context:context()}).spec
  const lost=[...lostRepairCapabilities(required,repairCapabilities(spec,catalog.map(t=>t.id))),...lostBehaviors(behaviorBaseline,spec),...visualGuard.compare(saved.evidence,saved.contextHash)]
  if(lost.length)throw Error(JSON.stringify(lost))
  committed={version:input.version,status:saved.feedback.status};emit({type:'debug_commit',...committed})
  return {source:saved.source,...committed}
 }
 async function retest(input,options){
  if(!input||Object.keys(input).some(k=>!['version','steps'].includes(k))||!/^[a-f0-9]{20}$/.test(input.version)||!Array.isArray(input.steps))throw Error('card_retest accepts only a saved version and steps; source cannot be modified')
  const saved=candidates.get(input.version)
  if(!saved)throw Error('Unknown test version in this session')
  if(saved.contextHash!==hash(JSON.stringify(context())))throw Error('Test context changed; submit a new card_test instead')
  return test({source:saved.source,steps:input.steps},options)
 }
 async function hostRepair(options){
  const last=results.at(-1),pending=oracle.pending()
  const conflicts=last?.browser?.runs?.flatMap(r=>r.actions.filter(a=>a.classification==='test_oracle_conflict'))||[]
  if(progressStopped()||pending.length!==1||!conflicts.length||conflicts.some(a=>a.oracle?.anchor?.kind!=='host-contract'||a.oracle?.unresolvedFailures?.length))return null
  const p=pending[0],id=p.version+JSON.stringify(p.corrected)
  if(hostRepairs.has(id))return null
  hostRepairs.add(id)
  const fixed=await retest({version:p.version,steps:p.corrected},options)
  const audit={type:'reload-expectation',version:p.version,sourceChanged:false,originalSteps:p.original,correctedSteps:p.corrected,verified:!oracle.pending().length&&fixed.status!=='failed'}
  emit({type:'debug_host_repair',...audit})
  return {...fixed,hostRepair:audit}
 }
 async function rejectRequest(message){
  const source=candidates.get(lastVersion)?.source||'',contextHash=contextKey()
  const record={version:lastVersion||'unsubmitted',status:'unverified',compiled:false,diagnostics:[{severity:'warning',code:'debug_request',message:String(message).slice(0,650)}],elapsedMs:0,steps:[],mode}
  observeProgress(record,source,contextHash);record.feedback=summarizeDebugFeedback(record);results.push(record)
  try{await saveDebugArtifact(resolve(artifactRoot,cardId,record.version),source,record,results.length)}catch{}
  return record.feedback
 }
 function readSource({version}={}){
  const saved=candidates.get(version)
  if(!saved||saved.contextHash!==contextKey())throw Error('Unknown or stale candidate version')
  return {version,source:saved.source,status:saved.feedback.status}
 }
 return {terminalInstruction:needsTerminalJourneys(context().userGoal)?TERMINAL_JOURNEY_GUIDANCE:'',testTool:context().extendedGeneration||context().renderMode==='web'?{...CARD_TEST_TOOL,function:{...CARD_TEST_TOOL.function,parameters:{...CARD_TEST_TOOL.function.parameters,properties:{...CARD_TEST_TOOL.function.parameters.properties,source:{type:'string',maxLength:120000},steps:{...CARD_TEST_TOOL.function.parameters.properties.steps,maxItems:64,description:"64 compact steps, 160 expanded actions; path groups start independently from initial state."}}}}}:CARD_TEST_TOOL,retestTool:()=>candidates.size?{...CARD_RETEST_TOOL,function:{...CARD_RETEST_TOOL.function,parameters:{...CARD_RETEST_TOOL.function.parameters,properties:{...CARD_RETEST_TOOL.function.parameters.properties,steps:{...CARD_RETEST_TOOL.function.parameters.properties.steps,maxItems:64,description:'Independent paths start from initial state; up to 160 expanded actions.'}}}}}:null,sourceTool:()=>candidates.size?CARD_SOURCE_TOOL:null,readSource,rejectRequest,hostRepair,stopResult,contextSnapshot:()=>({sourceRetrieval:true,candidateVersion:lastVersion,source:candidates.get(lastVersion)?.source,progress:{...progress.snapshot(),history:undefined},bestVersion:best?.version,feedback:results.at(-1)?.feedback}),retest,test,commit,evidence:()=>lastEvidence,canCommit:()=>[...candidates.values()].some(c=>c.contextHash===hash(JSON.stringify(context()))&&!behaviorLedger.missing(c.testedPaths||[]).length&&['passed','partial'].includes(checkedFeedback(c.feedback,c.evidence,c.contextHash).status)),maxRepairs,latestCandidate:()=>[...candidates.values()].reverse().find(c=>/<card(?:\s|>)/.test(c.source))?.source,canTest:()=>calls<maxTests&&!convergence.stopped()&&!progressStopped(),repair,snapshot:()=>({mode,committed,progress:progress.snapshot(),...(retained?{retained:{...retained,source:undefined}}:{}),runner:runner.runnerKind||(runner===runDebugBrowser?'isolated-chrome':'test-double'),tests:results.map(({browser,...r})=>r),repairs:repairUsed,...(mode==='compile-only'?{artifacts:'diagnostics embedded in card metadata'}:{artifactPath:`artifacts/generation-debug/${cardId}`})})}
}
