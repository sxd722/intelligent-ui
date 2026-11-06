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
import {validateExpectation} from '../../shared/cardspec/debug-assertions.mjs'
import {behaviorFootprint,lostBehaviors} from './requirements.mjs'
import {createVisualEvidenceGuard} from './visual-evidence.mjs'
import {summarizeDebugFeedback} from './debug-feedback.mjs'

export const DEBUG_ROLES=['button','tab','checkbox','radio','switch','slider','textbox','combobox']
export const CARD_TEST_TOOL={type:'function',function:{
 name:'card_test',description:'在真实渲染器中调试完整CardSpec文档（包含card根，不能只提交JSX）。CLI仅mock，不产生真实证据；返回错误、控件和交互变化。expect.state只检查原生CardSpec state；React局部状态用可见text/changed检查。异步动作可用waitMs等待后再断言。',
 parameters:{type:'object',additionalProperties:false,required:['source'],properties:{
  source:{type:'string',maxLength:24000},
  steps:{type:'array',maxItems:8,items:{type:'object',additionalProperties:false,required:['op'],properties:{
   op:{type:'string',enum:['click','fill','select','reload','check']},name:{type:'string',maxLength:100,description:'控件实际可访问名称，不是步骤说明；click 不把目标写在 value'},
   requirement:{type:'string',pattern:'^R[0-9]+$'},waitMs:{type:'integer',minimum:0,maximum:3000},expect:{type:'object',properties:{text:{type:'string'},state:{type:'object'},changed:{type:'boolean'},visual:{type:'boolean'},changedKeys:{type:'array',items:{type:'string'}},tool:{type:'string'}}},
   handle:{type:'string',maxLength:1200,description:'优先使用反馈中的控件 handle，不猜选择器'},scenario:{type:'string',enum:['normal','empty','failure']},
   role:{type:'string',enum:DEBUG_ROLES},index:{type:'integer',minimum:0,maximum:20,description:'同名控件序号，默认第一个'},value:{type:'string',maxLength:200}
  }}}
 }}
}}
export const CARD_COMMIT_TOOL={type:'function',function:{name:'card_commit',description:'提交已测试候选的 version，直接使用原源码，不再重写。须单独调用；partial 仅表示检查不完整，不代表全部通过。',parameters:{type:'object',additionalProperties:false,required:['version'],properties:{version:{type:'string',pattern:'^[a-f0-9]{20}$'}}}}}
export const DEBUG_INSTRUCTION='可先依据工具契约布局，用card_test(source,steps)在无网络mock中调试。steps用click/fill/select/reload和返回的handle或准确控件name，expect用具体text/state、结果changedKeys或实际tool调用验证业务，不能只用changed:true验证通知变化；默认只测normal；空/失败场景自动单独检查。测试稿可用后单独调用card_commit(version)提交原稿，不再抄写源码；未测试时仍可直接输出完整CardSpec。DEBUG_SAMPLE/DEBUG_MOCK不是事实，禁止写进源码；不要删除功能规避错误。'
export function validateDebugInput({source,steps=[]}={},maxSource=24000){
 if(typeof source!=='string'||!source.trim()||source.length>maxSource)throw Error(`card_test source must be 1–${maxSource} characters`)
 const deep=maxSource>24000,limit=deep?32:8
 if(!Array.isArray(steps)||steps.length>limit)throw Error(`card_test allows at most ${limit} steps. Test-plan error only: keep the exact source, split checks into smaller independent paths; do not rewrite implementation.`)
 if(deep&&steps.filter(s=>s?.op!=='check').length>16)throw Error('card_test allows at most 16 interaction/reload operations; attach read-only checks to observe their results')
 steps=steps.map(s=>s&&['fill','select'].includes(s.op)&&typeof s.value==='number'&&Number.isFinite(s.value)?{...s,value:String(s.value)}:s)
 const fail=(index,field,reason)=>{throw Error(`invalid card_test step ${index+1}.${field}: ${reason}. Test-plan error only: keep source unchanged and fix this step using observed controls/handles.`)}
 steps.forEach((s,i)=>{
  if(!s||typeof s!=='object'||Array.isArray(s))fail(i,'step','expected object')
  const unknown=Object.keys(s).find(k=>!['op','name','handle','scenario','role','value','index','requirement','expect','waitMs'].includes(k))
  if(unknown)fail(i,unknown,'unsupported field')
  if(!['click','fill','select','reload','check'].includes(s.op))fail(i,'op','use click/fill/select/reload/check')
  if(!['reload','check'].includes(s.op)&&!s.handle&&(typeof s.name!=='string'||!s.name.trim()||s.name.length>100))fail(i,'name','use the observed accessible label (1–100 characters)')
  if(s.handle!==undefined&&(typeof s.handle!=='string'||!s.handle||s.handle.length>1200))fail(i,'handle','use a returned control handle')
  if(s.scenario!==undefined&&!['normal','empty','failure'].includes(s.scenario))fail(i,'scenario','use normal/empty/failure')
  if(s.role!==undefined&&!DEBUG_ROLES.includes(s.role))fail(i,'role','use an observed role: '+DEBUG_ROLES.join('/'))
  if(s.index!==undefined&&(!Number.isInteger(s.index)||s.index<0||s.index>20))fail(i,'index','integer 0–20')
  if(['fill','select'].includes(s.op)&&(typeof s.value!=='string'||s.value.length>200))fail(i,'value','string up to 200 characters')
  if(s.requirement!==undefined&&!/^R\d+$/.test(s.requirement))fail(i,'requirement','use an immutable R id')
  if(s.waitMs!==undefined&&(!Number.isInteger(s.waitMs)||s.waitMs<0||s.waitMs>3000))fail(i,'waitMs','integer 0–3000 milliseconds')
  if(s.expect)try{validateExpectation(s.expect)}catch(e){fail(i,'expect',e.message)}
 })
 return {source,steps}
}
export function createDebugSession({context=()=>({}),bindingRecords=()=>[],catalog=[],complex=false,budget,runner=runDebugBrowser,emit=()=>{},onCandidate=()=>{},artifactRoot=resolve('artifacts/generation-debug'),cardId=randomUUID()}={}){
 const maxRepairs=budget?.policy.repairs??8,maxTests=context().extendedGeneration?Infinity:context().buildMode==='deep'?20:maxRepairs+2,results=[],cache=new Map(),candidates=new Map(),required=[],stepLedger=[]
 const mode=runner.runnerKind==='cloud-compile-only'?'compile-only':'mock-only'
 const visualGuard=createVisualEvidenceGuard()
 const checkedFeedback=(feedback,evidence,contextHash)=>{
  const issues=visualGuard.compare(evidence,contextHash)
  return issues.length?{...feedback,status:'failed',diagnostics:[...issues,...feedback.diagnostics]}:feedback
 }
 let visualIntent=false
 let committed,behaviorBaseline=[],lastEvidence
 let calls=0,repairUsed=0,reserved=false,lastVersion,lastFailed=false
 const repair=()=>{if(repairUsed>=maxRepairs)throw Error('调试修复次数已用完');budget?.repair();repairUsed++;reserved=true}
 const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,20)
 async function test(input,{signal,final=false}={}){
  const {source,steps}=validateDebugInput(input,context().extendedGeneration||context().renderMode==='web'?120000:context().buildMode==='deep'?48000:24000),version=hash(source),contextHash=hash(JSON.stringify(context())),key=version+contextHash+JSON.stringify(final?stepLedger:steps)+(final?':final':'')
  signal?.throwIfAborted()
  if(cache.has(key)){const hit=cache.get(key);if(!final)await onCandidate({source,version,spec:hit.spec,diagnostics:hit.feedback.diagnostics});lastEvidence=hit.evidence;return {...checkedFeedback(hit.feedback,lastEvidence,contextHash),cached:true}}
  // Only reuse an exact candidate and context. Never rerender a committed
  // candidate merely because the model has finished its tool turn.
  const saved=candidates.get(version)
  if(final&&saved?.contextHash===contextHash&&saved.feedback.status!=='failed'&&(!stepLedger.length||JSON.stringify(saved.testedSteps)===JSON.stringify(stepLedger))){lastEvidence=saved.evidence;return {...checkedFeedback(saved.feedback,lastEvidence,contextHash),cached:true}}
  if(!final&&calls>=maxTests)return {status:'budget_exhausted',version,instruction:'结束调试并输出完整最终稿'}
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
  const diagnostics=[...result.diagnostics,...bindingPlanDiagnostics(result.spec,context().bindingPlan||[],bindingRecords()),...contentIntegrity(result.spec),...lostRepairCapabilities(required,current),...lostBehaviors(behaviorBaseline,result.spec),...protectContentVisual(visualIntent,result.spec)]
  if(result.complete&&hasContentVisual(result.spec))visualIntent=true
  const hasSandbox=nodes=>(nodes||[]).some(n=>n.type==='sandbox'||hasSandbox(n.children))
  if(hasSandbox(result.spec?.children))diagnostics.push({severity:'warning',code:'debug_partial',message:context().renderMode==='web'?'Web 应用已预编译；仅覆盖实际浏览器步骤，可加载公开CDN，业务网络/API调用仍未验证。':'React 已预编译并隔离试运行；浏览器自动操作的覆盖范围以实际记录为准'})
  if(/DEBUG_(SAMPLE|MOCK)/.test(source))diagnostics.push({severity:'error',code:'debug_data_leak',message:'Remove mock fixture literals from production source'})
  let browser
  if(result.complete&&!diagnostics.some(d=>d.severity==='error')){
   emit({type:'debug',status:'running',version})
   try{browser=await runner(result.spec,{...(context().buildMode==='deep'&&!Object.keys(result.spec?.bindings||{}).length?{scenarios:['normal']}:{}),steps:final?stepLedger:steps,width:context().viewport?.width||432,size:context().cardSize||'square',signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(context().extendedGeneration||context().renderMode==='web'?120000:context().buildMode==='deep'?45000:25000)]),artifactDir:directory})}
   catch(e){signal?.throwIfAborted();browser={status:'unverified',reason:e.message,runs:[]}}
   if(browser.status==='unverified')diagnostics.push({severity:'warning',code:'debug_unverified',message:browser.reason})
   if(browser.status==='partial')diagnostics.push({severity:'warning',code:'debug_partial',message:browser.reason})
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
    for(const action of run.actions){if(!action.ok||action.restored===false)diagnostics.push({severity:action.restored===false?'error':'warning',code:action.restored===false?'debug_interaction':'debug_test_step',message:`${run.scenario} ${action.step.op} ${action.step.name||action.step.handle||''}: ${action.error||'state not restored'}`});if(action.assertion?.passed===false)diagnostics.push({severity:'error',code:'requirement_assertion',message:JSON.stringify(action.assertion.failures)})}
    if(run.final.horizontalOverflow)diagnostics.push({severity:'warning',code:'debug_overflow',message:run.scenario+': horizontal overflow'})
    for(const issue of [...(run.initial.layout?.issues||[]),...(run.final.layout?.issues||[])].slice(0,3))diagnostics.push({severity:'warning',code:'debug_layout',message:`${run.width||432}px ${run.scenario}: ${issue.element} ${issue.code}, available=${issue.available??''}, demand=${issue.demand??''}`})
    if(run.final.coverage.length)diagnostics.push({severity:'warning',code:'debug_partial',message:'部分工具只有稀疏字段 mock 或不支持模拟；不代表这些能力已验证'})
    if(run.actions.some(a=>a.ok&&!['reload','check'].includes(a.step.op)&&!a.changed))diagnostics.push({severity:'warning',code:'debug_no_feedback',message:run.scenario+': 部分操作未观察到状态、内容或工具调用变化；不等于业务逻辑正确'})
   }
   diagnostics.push(...visualGuard.compare(browser,contextHash))
  }
  const unique=contextualDiagnostics(source,[...new Map(diagnostics.map(d=>[d.code+':'+d.message,d])).values()])
  // Preserve a complete executable flow, including repeated clicks. A guessed
  // locator that never ran is feedback, not an immutable product requirement.
  const normal=browser?.runs.find(r=>r.scenario==='normal'),normalSteps=steps.filter(s=>!s.scenario||s.scenario==='normal')
  if(!final&&!stepLedger.length&&normalSteps.length&&normal?.actions.length===normalSteps.length&&normal.actions.every(a=>a.ok&&a.assertion?.passed!==false))stepLedger.push(...structuredClone(steps))
  const record={version,status:unique.some(d=>d.severity==='error')?'failed':browser?.status==='partial'?'partial':browser?.status==='tested'?(unique.some(d=>['debug_partial','debug_test_step','debug_layout'].includes(d.code))?'partial':'passed'):'unverified',diagnostics:unique,elapsedMs:Date.now()-started,browser,steps:final?stepLedger:steps,final,mode}
  lastVersion=version;lastFailed=unique.some(d=>d.severity==='error'&&!['requirement_assertion','debug_test_step'].includes(d.code))
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
  lastEvidence=browser;cache.set(key,{feedback:structuredClone(feedback),evidence:browser,spec:result.complete?result.spec:null});candidates.set(version,{source,contextHash,evidence:browser,feedback:structuredClone(feedback),testedSteps:structuredClone(final?stepLedger:steps)});emit({type:'debug',...feedback});return feedback
 }
 function commit(input){
  if(!input||Object.keys(input).some(k=>k!=='version')||!/^[a-f0-9]{20}$/.test(input.version))throw Error('card_commit requires only a tested version')
  const saved=candidates.get(input.version)
  if(!saved||!['passed','partial'].includes(saved.feedback.status))throw Error('candidate is unknown, failed or unverified; test a usable candidate first')
  if(saved.contextHash!==hash(JSON.stringify(context())))throw Error('candidate context changed; test again before committing')
  const spec=compileCard(saved.source,{final:true,context:context()}).spec
  const lost=[...lostRepairCapabilities(required,repairCapabilities(spec,catalog.map(t=>t.id))),...lostBehaviors(behaviorBaseline,spec),...visualGuard.compare(saved.evidence,saved.contextHash)]
  if(lost.length)throw Error(JSON.stringify(lost))
  committed={version:input.version,status:saved.feedback.status};emit({type:'debug_commit',...committed})
  return {source:saved.source,...committed}
 }
 return {testTool:context().extendedGeneration||context().renderMode==='web'?{...CARD_TEST_TOOL,function:{...CARD_TEST_TOOL.function,parameters:{...CARD_TEST_TOOL.function.parameters,properties:{...CARD_TEST_TOOL.function.parameters.properties,source:{type:'string',maxLength:120000},steps:{...CARD_TEST_TOOL.function.parameters.properties.steps,maxItems:32}}}}}:CARD_TEST_TOOL,test,commit,evidence:()=>lastEvidence,canCommit:()=>[...candidates.values()].some(c=>c.contextHash===hash(JSON.stringify(context()))&&['passed','partial'].includes(checkedFeedback(c.feedback,c.evidence,c.contextHash).status)),maxRepairs,canTest:()=>calls<maxTests,repair,snapshot:()=>({mode,committed,runner:runner.runnerKind||(runner===runDebugBrowser?'isolated-chrome':'test-double'),tests:results.map(({browser,...r})=>r),repairs:repairUsed,...(mode==='compile-only'?{artifacts:'diagnostics embedded in card metadata'}:{artifactPath:`artifacts/generation-debug/${cardId}`})})}
}
