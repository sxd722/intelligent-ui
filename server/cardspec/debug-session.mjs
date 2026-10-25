import {createHash,randomUUID} from 'node:crypto'
import {saveDebugArtifact} from './debug-artifacts.mjs'
import {resolve} from 'node:path'
import {compileCard} from '../../shared/cardspec/compiler.mjs'
import {validateRichContent} from './rich-validation.mjs'
import {runDebugBrowser} from './debug-browser.mjs'
import {repairCapabilities,lostRepairCapabilities} from './repair-capabilities.mjs'
import {contextualDiagnostics} from '../../shared/cardspec/diagnostic-context.mjs'

export const CARD_TEST_TOOL={type:'function',function:{
 name:'card_test',description:'在无网络的真实渲染器中调试完整候选。CLI仅mock，不产生真实证据；返回错误、控件和交互变化。',
 parameters:{type:'object',additionalProperties:false,required:['source'],properties:{
  source:{type:'string',maxLength:24000},
  steps:{type:'array',maxItems:8,items:{type:'object',additionalProperties:false,required:['op'],properties:{
   op:{type:'string',enum:['click','fill','select','reload']},name:{type:'string',maxLength:100},
   handle:{type:'string',maxLength:1200,description:'优先使用反馈中的控件 handle，不猜选择器'},scenario:{type:'string',enum:['normal','empty','failure']},
   role:{type:'string',enum:['button','tab','checkbox','radio','switch']},index:{type:'integer',minimum:0,maximum:20,description:'同名控件序号，默认第一个'},value:{type:'string',maxLength:200}
  }}}
 }}
}}
export const CARD_COMMIT_TOOL={type:'function',function:{name:'card_commit',description:'提交已测试候选的 version，直接使用原源码，不再重写。须单独调用；partial 仅表示检查不完整，不代表全部通过。',parameters:{type:'object',additionalProperties:false,required:['version'],properties:{version:{type:'string',pattern:'^[a-f0-9]{20}$'}}}}}
export const DEBUG_INSTRUCTION='可先依据工具契约布局，用card_test(source,steps)在无网络mock中调试。steps用click/fill/select/reload和返回的handle或准确控件name，默认只测normal；空/失败场景自动单独检查。测试稿可用后单独调用card_commit(version)提交原稿，不再抄写源码；未测试时仍可直接输出完整CardSpec。DEBUG_SAMPLE/DEBUG_MOCK不是事实，禁止写进源码；不要删除功能规避错误。'
export function validateDebugInput({source,steps=[]}={}){
 if(typeof source!=='string'||!source.trim()||source.length>24000)throw Error('card_test source must be 1–24000 characters')
 if(!Array.isArray(steps)||steps.length>8)throw Error('card_test allows at most 8 steps')
 for(const s of steps)if(!s||Object.keys(s).some(k=>!['op','name','handle','scenario','role','value','index'].includes(k))||!['click','fill','select','reload'].includes(s.op)||s.op!=='reload'&&!s.handle&&(typeof s.name!=='string'||!s.name.trim()||s.name.length>100)||s.handle!==undefined&&(typeof s.handle!=='string'||!s.handle||s.handle.length>1200)||s.scenario!==undefined&&!['normal','empty','failure'].includes(s.scenario)||s.role&&!['button','tab','checkbox','radio','switch'].includes(s.role)||s.index!==undefined&&(!Number.isInteger(s.index)||s.index<0||s.index>20)||['fill','select'].includes(s.op)&&(typeof s.value!=='string'||s.value.length>200))throw Error('invalid card_test step')
 return {source,steps}
}
export function createDebugSession({context=()=>({}),catalog=[],complex=false,budget,runner=runDebugBrowser,emit=()=>{},artifactRoot=resolve('artifacts/generation-debug'),cardId=randomUUID()}={}){
 const maxRepairs=budget?.policy.repairs??8,maxTests=maxRepairs+2,results=[],cache=new Map(),candidates=new Map(),required=[],stepLedger=[]
 const mode=runner.runnerKind==='cloud-compile-only'?'compile-only':'mock-only'
 let committed
 let calls=0,repairUsed=0,reserved=false,lastVersion,lastFailed=false
 const repair=()=>{if(repairUsed>=maxRepairs)throw Error('调试修复次数已用完');budget?.repair();repairUsed++;reserved=true}
 const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,20)
 async function test(input,{signal,final=false}={}){
  const {source,steps}=validateDebugInput(input),version=hash(source),contextHash=hash(JSON.stringify(context())),key=version+contextHash+JSON.stringify(final?stepLedger:steps)+(final?':final':'')
  signal?.throwIfAborted()
  if(cache.has(key))return {...cache.get(key),cached:true}
  // Only reuse an exact candidate and context. Never rerender a committed
  // candidate merely because the model has finished its tool turn.
  const saved=candidates.get(version)
  if(final&&saved?.contextHash===contextHash&&saved.feedback.status!=='failed'&&(!stepLedger.length||JSON.stringify(saved.testedSteps)===JSON.stringify(stepLedger)))return {...saved.feedback,cached:true}
  if(!final&&calls>=maxTests)return {status:'budget_exhausted',version,instruction:'结束调试并输出完整最终稿'}
  // Final output was already paid for by the current model turn. Validate it
  // even if earlier card_test attempts used the repair budget; do not charge a
  // second repair before knowing whether this final source is usable.
  if(version!==lastVersion){if(lastFailed&&!reserved&&!final)repair();reserved=false}
  calls++
  const started=Date.now(),directory=resolve(artifactRoot,cardId,version),result=compileCard(source,{final:true,cardId,context:context()})
  await validateRichContent(result)
  const current=repairCapabilities(result.spec,catalog.map(t=>t.id))
  for(const cap of current)if(!required.some(r=>r.tool===cap.tool&&r.kind===cap.kind))required.push(cap)
  const diagnostics=[...result.diagnostics,...lostRepairCapabilities(required,current)]
  const hasSandbox=nodes=>(nodes||[]).some(n=>n.type==='sandbox'||hasSandbox(n.children))
  if(hasSandbox(result.spec?.children))diagnostics.push({severity:'warning',code:'debug_partial',message:'React 已预编译并隔离试运行；浏览器自动操作的覆盖范围以实际记录为准'})
  if(/DEBUG_(SAMPLE|MOCK)/.test(source))diagnostics.push({severity:'error',code:'debug_data_leak',message:'Remove mock fixture literals from production source'})
  let browser
  if(result.complete&&!diagnostics.some(d=>d.severity==='error')){
   emit({type:'debug',status:'running',version})
   try{browser=await runner(result.spec,{steps:final?stepLedger:steps,width:context().viewport?.width||432,size:context().cardSize||'square',signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(25000)]),artifactDir:directory})}
   catch(e){signal?.throwIfAborted();browser={status:'unverified',reason:e.message,runs:[]}}
   if(browser.status==='unverified')diagnostics.push({severity:'warning',code:'debug_unverified',message:browser.reason})
   if(browser.status==='partial')diagnostics.push({severity:'warning',code:'debug_partial',message:browser.reason})
   for(const run of browser.runs){
    if(run.initial.empty||run.final.empty)diagnostics.push({severity:'error',code:'debug_empty',message:run.scenario+': card body has no readable content or visual/interactive surface'})
    for(const message of [...run.initial.errors,...run.final.errors,...run.pageErrors,...run.actions.flatMap(a=>a.errors||[])])diagnostics.push({severity:'error',code:'debug_runtime',message:`${run.scenario}: ${message}`})
    for(const action of run.actions)if(!action.ok||action.restored===false)diagnostics.push({severity:action.restored===false?'error':'warning',code:action.restored===false?'debug_interaction':'debug_test_step',message:`${run.scenario} ${action.step.op} ${action.step.name||action.step.handle||''}: ${action.error||'state not restored'}`})
    if(run.final.horizontalOverflow)diagnostics.push({severity:'warning',code:'debug_overflow',message:run.scenario+': horizontal overflow'})
    for(const issue of [...(run.initial.layout?.issues||[]),...(run.final.layout?.issues||[])].slice(0,3))diagnostics.push({severity:'warning',code:'debug_layout',message:`${run.width||432}px ${run.scenario}: ${issue.element} ${issue.code}, available=${issue.available??''}, demand=${issue.demand??''}`})
    if(run.final.coverage.length)diagnostics.push({severity:'warning',code:'debug_partial',message:'部分工具只有稀疏字段 mock 或不支持模拟；不代表这些能力已验证'})
    if(run.actions.some(a=>a.ok&&a.step.op!=='reload'&&!a.changed))diagnostics.push({severity:'warning',code:'debug_no_feedback',message:run.scenario+': 部分操作未观察到状态、内容或工具调用变化；不等于业务逻辑正确'})
   }
  }
  const unique=contextualDiagnostics(source,[...new Map(diagnostics.map(d=>[d.code+':'+d.message,d])).values()])
  // Preserve a complete executable flow, including repeated clicks. A guessed
  // locator that never ran is feedback, not an immutable product requirement.
  const normal=browser?.runs.find(r=>r.scenario==='normal'),normalSteps=steps.filter(s=>!s.scenario||s.scenario==='normal')
  if(!final&&!stepLedger.length&&normalSteps.length&&normal?.actions.length===normalSteps.length&&normal.actions.every(a=>a.ok))stepLedger.push(...structuredClone(steps))
  const record={version,status:unique.some(d=>d.severity==='error')?'failed':browser?.status==='partial'?'partial':browser?.status==='tested'?(unique.some(d=>['debug_partial','debug_test_step','debug_layout'].includes(d.code))?'partial':'passed'):'unverified',diagnostics:unique,elapsedMs:Date.now()-started,browser,steps:final?stepLedger:steps,final,mode}
  lastVersion=version;lastFailed=record.status==='failed'
  results.push(record)
  try{await saveDebugArtifact(directory,source,record,results.length)}catch(e){record.artifactError=e.message}
  // Small return envelope; complete diagnostics/screenshots stay in local trace.
  const feedback={version,status:record.status,mode,diagnostics:unique.sort((a,b)=>Number(b.severity==='error')-Number(a.severity==='error')).slice(0,6).map(d=>({...d,message:d.message.slice(0,450)})),controls:browser?.runs[0]?.final.controls.slice(0,12).map(c=>({...c,name:c.name.slice(0,100)})),actions:browser?.runs[0]?.actions.map(a=>({...a,errors:a.errors?.slice(0,2).map(e=>e.slice(0,200))})),coverage:browser?.runs[0]?.final.coverage.slice(0,4),elapsedMs:record.elapsedMs}
  // The model receives feedback, not a second full trace. Preserve root errors
  // first; raw steps, screenshots and complete observations stay on disk.
  for(const field of ['controls','actions','coverage','diagnostics'])while(JSON.stringify(feedback).length>6000&&feedback[field]?.length>(field==='diagnostics'?1:0)){feedback[field].pop();feedback.truncated=true}
  cache.set(key,feedback);candidates.set(version,{source,contextHash,feedback:structuredClone(feedback),testedSteps:structuredClone(final?stepLedger:steps)});emit({type:'debug',...feedback});return feedback
 }
 function commit(input){
  if(!input||Object.keys(input).some(k=>k!=='version')||!/^[a-f0-9]{20}$/.test(input.version))throw Error('card_commit requires only a tested version')
  const saved=candidates.get(input.version)
  if(!saved||!['passed','partial'].includes(saved.feedback.status))throw Error('candidate is unknown, failed or unverified; test a usable candidate first')
  if(saved.contextHash!==hash(JSON.stringify(context())))throw Error('candidate context changed; test again before committing')
  const lost=lostRepairCapabilities(required,repairCapabilities(compileCard(saved.source,{final:true,context:context()}).spec,catalog.map(t=>t.id)))
  if(lost.length)throw Error(JSON.stringify(lost))
  committed={version:input.version,status:saved.feedback.status};emit({type:'debug_commit',...committed})
  return {source:saved.source,...committed}
 }
 return {test,commit,canCommit:()=>[...candidates.values()].some(c=>['passed','partial'].includes(c.feedback.status)),maxRepairs,canTest:()=>calls<maxTests,repair,snapshot:()=>({mode,committed,runner:runner.runnerKind||(runner===runDebugBrowser?'isolated-chrome':'test-double'),tests:results.map(({browser,...r})=>r),repairs:repairUsed,...(mode==='compile-only'?{artifacts:'diagnostics embedded in card metadata'}:{artifactPath:`artifacts/generation-debug/${cardId}`})})}
}
