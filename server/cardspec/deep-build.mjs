import {moduleContract} from "./module-contract.mjs"
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createBuildWorkspace,normalizeBuildOperation} from './build-workspace.mjs'
import {requirementAudit} from './requirements.mjs'
import {requirementSeeds,inspectRequirementPlan,mergeRequirementPatch,REQUIREMENT_PATCH_PROMPT} from './requirement-plan.mjs'
import {registryReference,REGISTRY} from '../../shared/cardspec/registry.mjs'
import {CARD_JS_LANGUAGE_CORE,CARD_LANGUAGE_CORE} from './language-core.mjs'
import {WEB_PROMPT,WEB_RUNTIME_PROMPT} from '../../shared/cardspec/web-policy.mjs'
import {NATIVE_CAPABILITY} from '../../shared/cardspec/sandbox-policy.mjs'
import {REACT_SURFACE_PROMPT} from '../../shared/cardspec/react-surface-prompt.mjs'
import {generationLayout} from '../../shared/cardspec/generation-layout.mjs'
import {extractPlanJson} from './plan-json.mjs'
import {validateDebugInput} from './debug-session.mjs'
import {buildFeedback,buildInterface,TEST_BUILD_PROTOCOL} from './build-feedback.mjs'
import {buildDataflowDiagnostics} from './build-dataflow.mjs'
import {INTERACTION_PURPOSE} from '../../shared/cardspec/experience-prompt.mjs'
import {buildUnits,nextBuildUnit,assertUnitRetention} from './build-units.mjs'
import {plannedDataNeeds,resolveBuildDataNeeds} from './data-enrichment.mjs'
import {TOOLS,validateToolInput} from '../../shared/cardspec/tools.mjs'
import {compactBuildTestSteps} from './build-test-steps.mjs'
import {createBuildConvergence,createBuildEvidenceLedger} from './build-convergence.mjs'

function json(raw){
 const text=String(raw||'').trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'')
 return extractPlanJson(text,60000).value
}
export const DEEP_PLAN_PROMPT=`为小型交互应用建立简短、完整的需求与模块计划，只输出JSON。
{requirements:[{id:"R1",kind:"content|interaction|simulation|evidence",acceptance:"可观察的验收行为"}],modules:[{name:"main.cardspec",purpose:"整卡/状态/导航",components:["title","button"]},{name:"lesson.cardspec",purpose:"讲解"},{name:"stage.jsx",purpose:"可操纵动画"}],interfaces:"共享state字段、动作与模块依赖的简短约定"}。
requirements逐一使用宿主给出的所有ID，每项acceptance用一句可观察行为（通常60字以内），原始引文由宿主保存，不用抄写或重新拆分。interfaces在顶层写一次；每个模块purpose一句话，不重复共享状态。验收保留原请求中的数量、时长、输入序列与边界值。验收只细化用户已有需求，不添加倒计时、打卡等未要求功能，不承诺考试通过。不能把系统讲解、模拟等核心任务改成以后生成。事实来源未取得时标记待核实，不假造真题/实时数据。简单任务用1–2个模块；仅真正独立的讲解/模拟/练习才拆分，不为凑模块增加任务。模块最多6个，main.cardspec必需，其他只允许.cardspec片段或.jsx，不能.js；不要求必须有React。components只写组件名，不加说明。每个核心任务有实际视图与反馈，不能只做可点击目录、静态题库或装饰闪烁。普通控件留在原生card，分视图共享状态，不堆长列表。计划不写正文和代码。
每个module增加units:[{goal:"本次可提交的小功能",requirements:["R1"]}]，每模块通常1–3个，复杂模块可至8个、总共最多10个；单元数不是文件数，共享业务状态的逻辑留在同一文件，不能为满足单元数量拆出相互依赖的独立沙箱。一个单元只增加一小段合法代码（约2500字符）；如main先声明数据/状态与挂载、再补动作，列表先筛选控件、再候选展示，详情和比较分别提交。不要把“筛选+列表+详情+对比”作为一个单元。共用实际接口，不重新规划已提交代码。
数据需求用可选dataNeeds:[{dataset:"D1",fields:["真实字段名"],limit:3}]，只声明筛选或详情缺少且详情能力能补的字段。宿主会按真实ID补取，缺失继续标为未知；不用为每条详情再次规划。若用户要求筛选，验收必须观察候选ID集合变化；详情必须出现列表中没有的新字段，而非重复标题评分。` 

export const DEEP_WEB_PLAN_PROMPT=`为完整Web应用建立简短需求与模块计划，只输出JSON：
{requirements:[{id:"宿主给出的R编号",kind:"content|interaction|simulation|evidence",acceptance:"一句可观察行为"}],modules:[{name:"main.cardspec",purpose:"只挂载app.jsx",components:["sandbox"],units:[{goal:"挂载Web应用，不编写业务状态与按钮",requirements:[]}]},{name:"app.jsx",purpose:"全部应用UI与业务状态",units:[{goal:"一个可提交的小功能",requirements:["R1"]}]}],interfaces:"app.jsx持有JSON业务状态，main只挂载"}。
逐一覆盖宿主提供的所有需求ID，验收保留原请求的数量、时长、输入序列与边界值，不抄长段原文或增加功能。main只有挂载，不声明游戏/模拟的状态、动作、标题、开始/重开按钮；它们都由app.jsx负责，避免两个状态系统。一个JSX模块可用1–8个unit逐步完成（通常2–4个），不为拆单元增加运行模块。每个unit新增约2500字符；计划只写短目标，不写正文/代码。业务状态使用App的state/setState保存，内部按钮直接调用本地函数，不经过宿主bridge。计时器用useEffect清理，暂停/重开不遗留旧回调。事实按需取样，不编造数值。`;

const BUILD_PROTOCOL=`你是实现编写器，可先调用已提供的API工具（cli_describe/cli_read等），不要把工具名写成op；最终回答只输出JSON操作，不编写测试脚本。
{"op":"write","files":[{"name":"当前目标文件","version":"已有版本必填","content":"完整内容"}],"claims":[{"id":"R1","modules":["main.cardspec"]}]}。
已有模块优先局部修改：{"op":"patch","name":"目标文件","version":"当前版本","edits":[{"old":"精确且只出现一次的旧片段","new":"替换片段"}]}。每次至多8处替换，包含足够上下文使锚点唯一，不能用省略号；小修不要重写整份文件。
一次只修改目标模块。main.cardspec声明共享state和唯一页面导航，并通过<include module="lesson.cardspec"/>包含所有片段；片段写UI及其专属action/derive，声明置于片段顶层，宿主链接到card；共享ID全局唯一，不重复声明。JSX独立文件以export default function App({data,bridge})开始，main用<sandbox id="stage" brief="交互图形" input={{n:state.n}} source="@module:stage.jsx"/>引用。
应用页面用state.view+segmented+if，navigation不是页面容器，不可包含include或按钮。例：<segmented id="views" label="视图" options={[{value:"learn",label:"学习"},{value:"practice",label:"练习"}]} value={state.view} onChange="changeView"/><if test={state.view==="learn"}><include module="lesson.cardspec"/></if>；changeView动作set target="view" value={event.value}。主导航由main统一提供，详情/对比片段不要重复绘制相同跳转；有明确返回语义时保留一个返回入口。分页组件可用自己的内置导航。真实图片用<image assetRef={row.assetRef} mediaRole="thumbnail" alt={row.title}/>；query仅为示意图片检索词，不接受图片URL，不同时写两种来源。
每个视图的空间有限，采用分步或逐题呈现，不能删功能解决错误。共享状态保存在main，ID全卡唯一。只实现计划的模块，禁止DEBUG_MOCK。目标源文件由宿主自动提供，不用read读取自己；仅缺少接口时{"op":"read","names":["其他文件"]}，组件不明时{"op":"describe","names":["组件"]}。下一轮仅接收目标文件及一个依赖，不累计历史全文。actualInterface是已实现的共享状态/数据形状/动作与sandbox.input/actions，优先于计划中的暂定名字。bridge.call只能调用sandbox的actions映射所开放的名字，不是所有main动作；原生滑块留在外面，图形读取data响应。`

export async function buildDeepCard({streamUpstream,input,context,debug,research,budget,signal,emit=()=>{},cardId,resume,toolContract='',planningTools=[]}){
 const root=resolve('artifacts/deep-build',cardId),workspace=createBuildWorkspace({extendedGeneration:context.extendedGeneration===true||context.renderMode==='web'}),trace=[],rejected=new Map(),committedUnits=new Set(),started=Date.now()
 let plan,feedback=null,claims=[],steps=[],tested=null,focused=[],contract='',stalls=0,failedCalls=0,lastKey='',lastAudit,phase='implementation',testAttempts=0,extraFile,redirects=0,dataReadiness=[]
 const convergence=createBuildConvergence(),ledger=createBuildEvidenceLedger()
 let bestCandidate=null,lastObservation
 const inputText=JSON.stringify(context.input||{}),explicitInput=inputText.length<=6000?context.input:{truncated:true,originalCharacters:inputText.length,preview:inputText.slice(0,6000)}
 const record=async()=>{await mkdir(root,{recursive:true});await writeFile(resolve(root,'trace.json'),JSON.stringify({goal:input.prompt,context:{renderMode:context.renderMode,expressionDialect:context.expressionDialect,cardSize:context.cardSize,extendedGeneration:context.extendedGeneration},plan,claims,steps,trace,feedback,coverage:lastAudit,harness:{convergence:convergence.snapshot(),evidence:ledger.summary(),bestCandidate},committedUnits:[...committedUnits],workspace:workspace.snapshot(),pending:workspace.pending(),elapsedMs:Date.now()-started},null,2))}
 const finish=async()=>{const committed=debug.commit({version:tested.feedback.version});await record();return {...committed,feedback:tested.feedback,coverage:tested.audit,build:{mode:'deep',modules:workspace.manifest(),calls:trace.length,elapsedMs:Date.now()-started,inputCharacters:trace.map(t=>t.inputCharacters||0),artifactPath:'artifacts/deep-build/'+cardId}}}
 async function call(system,body,{planning=false,testing=false,unitFile,isolated=false}={}){
  signal?.throwIfAborted();budget?.check();let raw='',reasoningCharacters=0,usage;const at=Date.now(),buildPhase=planning?'plan':testing?'test':unitFile?'unit':'implementation'
  const messages=[{role:'system',content:system},{role:'user',content:JSON.stringify(body)}]
  try{const returned=await streamUpstream(messages,{budget,buildPhase,requireToolUse:false,...(!testing&&!unitFile&&!isolated?{research}:{}),stage:planning?'plan':'generate',temperature:planning?.65:.25,maxTokens:planning||testing?6144:10000,reasoningEffort:'low',thinking:{type:'disabled'},...(!unitFile?{responseFormat:{type:'json_object'}}:{}),signal,onUsage:u=>{if(u)usage=u},onPiece:p=>{if(p.content)raw+=p.content;if(p.reasoning)reasoningCharacters+=p.reasoning.length}});if(typeof returned==='string'&&returned.trim())raw=returned
   const content=raw.trim().replace(/^```[a-zA-Z]*\s*\n/,'').replace(/\n```\s*$/,'')
   if(unitFile&&!content)throw Error('unit returned no source; previous commits retained')
   const value=unitFile?{op:'write',files:[{...unitFile,content}]}:json(raw);trace.push({kind:planning?'plan':testing?'test-repair':'implementation',protocol:unitFile?'source-only':'operation',inputCharacters:JSON.stringify(messages).length,outputCharacters:raw.length,reasoningCharacters,usage,elapsedMs:Date.now()-at,op:value.op,raw});await record();return value
  }catch(e){if(!planning&&e.code?.startsWith('PLAN_'))e.message=e.message.replaceAll('规划',testing?'验收操作':'实现操作');trace.push({kind:planning?'plan':testing?'test-repair':'implementation',elapsedMs:Date.now()-at,error:e.message,code:e.code,outputCharacters:e.outputCharacters??raw.length,reasoningCharacters:e.reasoningCharacters??reasoningCharacters,usage:e.usage||usage,raw});throw e}
 }
 try{
  emit({type:'build_progress',stage:'requirements',message:'正在建立需求与验收清单'})
  let planError
  research?.lockPlan?.() // deep planner owns the plan; allow evidence reads without a second plan_cards turn
  const seeds=requirementSeeds(input.prompt)
  // A complete but imperfect plan is retained; later calls only fill holes.
  for(let attempt=0;attempt<2;attempt++){
   try{
    plan=resume?structuredClone(resume.plan):await call((context.renderMode==='web'?DEEP_WEB_PLAN_PROMPT:DEEP_PLAN_PROMPT)+(context.renderMode==='native'?"\n当前宿主纯原生：只允许.cardspec模块，禁止.jsx与sandbox；所有状态/计算用CardSpec原生声明与动作。":"")+"\n工具按需使用：仅依赖当前/真实数据时取少量样本；纯创作/本地模拟不需要工具。"+(context.renderMode==='web'?"完整Web的一个应用只规划一个JSX运行模块（逻辑可分多个unit逐步完成），业务状态/定时器/开始/重置均在其中，main只挂载；独立沙箱之间不能import或直接共享函数，不为内部操作拆宿主动作。":""),{request:input.prompt,requirements:seeds,availableComponents:Object.keys(REGISTRY),availableData:planningTools,renderMode:context.renderMode,...(planError?{error:planError,recovery:'上轮未获得完整JSON；简写验收与purpose，不抄需求，不写代码。'}:{})},{planning:true})
    planError=null;break
   }catch(e){signal?.throwIfAborted();planError=e.message}
  }
  if(planError)throw Error('需求规划失败：'+planError)
  let inspection=inspectRequirementPlan(input.prompt,plan,seeds,{renderMode:context.renderMode});plan=inspection.plan
  for(let attempt=0;inspection.issues.length&&attempt<2;attempt++){
   emit({type:'build_progress',stage:'requirements',message:'局部补全需求计划：'+inspection.issues.map(i=>i.ids?.join(',')||i.field).join('；')})
   const body={issues:inspection.issues,missing:inspection.missing,acceptedIds:plan.requirements.map(r=>r.id),modules:Array.isArray(plan.modules)?plan.modules.map(m=>({name:m.name,purpose:m.purpose,...(inspection.issues.some(i=>i.field==='modules')?{units:m.units}:{})})):[],interfaces:plan.interfaces,renderMode:context.renderMode}
   try{
    const patch=await call(REQUIREMENT_PATCH_PROMPT,body,{planning:true,isolated:true})
    plan=mergeRequirementPatch(plan,patch,inspection.issues)
    trace.push({kind:'plan-patch',ids:inspection.missing.map(r=>r.id),fields:inspection.issues.map(i=>i.field),inputCharacters:JSON.stringify(body).length})
   }catch(e){signal?.throwIfAborted();trace.push({kind:'plan-patch-error',error:e.message})}
   inspection=inspectRequirementPlan(input.prompt,plan,seeds,{renderMode:context.renderMode});plan=inspection.plan
  }
  if(inspection.issues.length)throw Error('需求规划未完成：'+inspection.issues.map(i=>i.field+': '+(i.ids?.join(',')||i.message)).join('; '))
  const units=buildUnits(plan)
  let needs=[]
  if(!resume&&research?.execute){
   const resolved=await resolveBuildDataNeeds(plan,{records:()=>research.records?.()||[],execute:research.execute,tools:TOOLS,validateInput:validateToolInput,signal})
   needs=resolved.needs;dataReadiness.push(...resolved.diagnostics)
   trace.push({kind:'data-resolution',...resolved})
  }else if(!resume)needs=plannedDataNeeds(plan,research?.records?.()||[])
  if(!resume&&needs.length){
   for(const need of needs){
    signal?.throwIfAborted()
    try{const result=await research?.execute('dataset_enrich',need,signal);trace.push({kind:'data-needs',need,result});dataReadiness.push({dataset:need.dataset,coverage:result?.enrichmentReport?.after||result?.fieldCoverage,outcomes:result?.enrichmentReport?.outcomes})}
    catch(e){signal?.throwIfAborted();trace.push({kind:'data-needs',need,error:e.message});dataReadiness.push({dataset:need.dataset,error:e.message})}
   }
   await record()
  }
  research?.lockPlan?.() // one immutable task plan; no duplicate plan_cards round
  // Host-only replay entry for regression/repair of an existing failed build.
  // Not accepted from the public HTTP payload; revalidate before reusing code.
  if(resume){
   if(resume.goal!==input.prompt)throw Error('resume goal must match the immutable request')
   workspace.write(Object.entries(resume.workspace||{}).map(([name,f])=>({name,content:f.content})))
   for(const unit of units)if(resume.workspace?.[unit.module]&&(resume.committedUnits?.includes(unit.id)||resume.trace?.some(t=>t.kind==='unit-commit'&&t.unit===unit.id)||!plan.modules.some(m=>m.units)))committedUnits.add(unit.id)
   claims=(resume.claims||[]).filter(c=>plan.requirements.some(r=>r.id===c.id)&&Array.isArray(c.modules)&&c.modules.every(n=>plan.modules.some(m=>m.name===n)))
   steps=resume.steps||[]
   try{
    const assembled=workspace.assemble(),issues=buildDataflowDiagnostics(assembled.source,{context:{...context,datasets:research?.datasets?.()||context.datasets},records:research?.records?.()||[]})
    if(issues.length){feedback={phase:'implementation',module:'main.cardspec',diagnostics:issues,error:'恢复候选尚有数据/事件契约缺陷；先修实现，不能冻结。'};phase='implementation'}
    else{const raw=await debug.test({source:assembled.source,steps:[{op:'check'}]},{signal});feedback=buildFeedback(raw,debug.evidence(),assembled);phase=feedback.phase;if(phase==='implementation')feedback.module=feedback.module||'main.cardspec'}
   }catch(e){signal?.throwIfAborted();feedback={error:e.message,module:e.module||'main.cardspec'}}
   // Host-owned independent review may expose a defect outside the model's
   // short replay. Never accepted from public HTTP or treated as a passed test.
   if(resume.reviewDiagnostics?.length){
    const issues=resume.reviewDiagnostics
    if(!Array.isArray(issues)||issues.length>4||issues.some(d=>!workspace.manifest().some(f=>f.name===d.module)||typeof d.message!=='string'||d.message.length>1600||typeof d.evidence!=='string'||!d.evidence.trim()))throw Error('invalid independent build review')
    feedback={...feedback,phase:'implementation',module:issues[0].module,diagnostics:issues.map(d=>({...d,severity:'error',code:'independent_review'})),error:'独立复验有具体失败证据，先修实现；这些证据不是验收通过。'}
    phase='implementation';trace.push({kind:'independent-review',issues})
   }
   trace.push({kind:'resume',files:workspace.manifest(),sourceId:resume.sourceId,scope:'saved source revalidated; no tool calls replayed'});await record()
  }
  const common=['title','caption','text','button','row','region','if','each','segmented','slider','stats','stat','progress','sandbox']
  const core=context.expressionDialect==='js-v1'?CARD_JS_LANGUAGE_CORE:CARD_LANGUAGE_CORE
   const base=`你正在增量构建一个完整交互卡应用，先覆盖全部需求，不把主要功能留给后续生成。只使用CardSpec v1。${BUILD_PROTOCOL}\n长文件可用{"op":"chunk","name":"目标文件","version":"已有版本","offset":0,"content":"本段代码","done":false}分段暂存，每段至多6000字符。后续offset使用pending.offset，最后done=true才校验提交；新文件省略version。不要输出截断JSON，不能以缩减需求代替分段。\n${core}\n${generationLayout(context.cardSize,'page',{extendedGeneration:context.extendedGeneration,webApplication:context.renderMode==='web'}).instruction}\n${INTERACTION_PURPOSE}\n${toolContract}\n真实数据使用已声明binding或context.datasets，不能只声明空数组/loaded=false而没有生产者。数据先进入派生筛选，再用于列表、详情、对比。\n尺寸是每个视图的限制，不是整个应用的内容上限。主题可用soft/editorial/precision/minimal，palette=a|b|c。不给未核实事实编造来源。`
  for(let turn=0;turn<(context.extendedGeneration?Infinity:20);turn++){
   // Editing a hash, locator, or error wording is not measurable progress.
   lastObservation=convergence.observe({units:committedUnits.size,audit:lastAudit,feedback:feedback||{}})
   if(lastObservation.stop){emit({type:'build_progress',stage:'paused',message:lastObservation.reason});throw Object.assign(Error(lastObservation.reason),{code:'BUILD_STALLED',artifactPath:root,bestCandidate})}
   const manifest=workspace.manifest(),missing=plan.modules.find(m=>!manifest.some(f=>f.name===m.name))
   const unit=phase==='implementation'?nextBuildUnit(units,committedUnits):null
   const repairModule=feedback?.module||feedback?.diagnostics?.find(d=>d.severity==='error'&&d.module)?.module
   const target=workspace.pending()[0]?.name||(repairModule&&manifest.some(f=>f.name===repairModule)?repairModule:unit?.module||missing?.name||'main.cardspec')
   const scaffold=missing?.name==='main.cardspec'&&target==='main.cardspec'&&plan.modules.length>1
   const task=phase==='test'?'只修复验收脚本；实现冻结。覆盖未验证需求，保留已通过的步骤。':unit&&target===unit.module?`${missing?.name===target?'创建 '+target+'。':''}本轮只提交一个小单元：${unit.goal}。首次write仅本单元的完整合法节点；后续patch增加本单元，保留已提交内容。无需此轮完成整个模块。新增代码约2500字符以内，其他单元由宿主调度。` :scaffold?'本轮只写main骨架和挂载，约3000字符。':`只修复 ${target}；保留其他模块、交互和需求。`
   focused=phase==='test'?[]:[...new Set([target,extraFile].filter(n=>manifest.some(f=>f.name===n)))].map(workspace.read)
   extraFile=undefined
   const fragment=target.endsWith('.cardspec')&&target!=='main.cardspec'
   const jsx=target.endsWith('.jsx'),localCore=jsx?'':moduleContract(core,{javascript:context.expressionDialect==='js-v1',fragment})
   const selected=[...new Set([...(plan.modules.find(m=>m.name===target)?.components||[]),...(fragment?['text','caption','button','row','if','each']:common)])].filter(n=>Object.hasOwn(REGISTRY,n)).slice(0,24)
   const componentContract=jsx?'':registryReference({compact:true,names:selected})
   const web=context.renderMode==='web'?(jsx?'\n'+WEB_RUNTIME_PROMPT:'\n模块化Web挂载层：main只写轻量card和sandbox。必须source="@module:'+plan.modules.find(m=>m.name.endsWith('.jsx'))?.name+'"；禁止内联JSX/重复实现，不在main声明业务state/action或开始/重置按钮。所有应用UI与状态归JSX文件；宿主负责加载该模块。'):context.renderMode==='hybrid'?(target.endsWith('.jsx')?'\n'+REACT_SURFACE_PROMPT:'\nJSX独立模块，input传入data；普通控件保留在main。'):'\n'+NATIVE_CAPABILITY
   emit({type:'build_progress',stage:phase==='test'?'test-repair':'modules',message:phase==='test'?'实现已冻结 · 编写/修复验收步骤':`实现模块 ${target} · 第 ${turn+1} 轮`})
   const body=phase==='test'?{request:input.prompt,task,requirements:plan.requirements,modules:plan.modules,interfaces:plan.interfaces,claims,steps,feedback,coverage:lastAudit,retainedEvidence:ledger.summary()}:{request:input.prompt,task,plan,context:{cardSize:context.cardSize,viewport:context.viewport,renderMode:context.renderMode,expressionDialect:context.expressionDialect,input:explicitInput,designPreference:context.designPreference,localDate:context.localDate},files:manifest,pending:workspace.pending(),focused,actualInterface:manifest.some(f=>f.name==='main.cardspec')?buildInterface(workspace.interfaceSource()):undefined,feedback:feedback?{...feedback,diagnostics:feedback.diagnostics?.filter(d=>!d.module||d.module===target),initial:undefined,actions:undefined}:null,coverage:lastAudit}
   // UI fragments need their interface and component contracts, not the whole
   // application's tool schemas and transaction tutorial on every round.
   const fragmentSystem=`实现一个CardSpec视图片段。${BUILD_PROTOCOL}\n只写本片段UI及专属动作，不写card；引用actualInterface已有共享状态/动作，不重复声明。不要重新设计其他模块。${core.split('【事务动作】')[0]}\n${generationLayout(context.cardSize,'page',{extendedGeneration:context.extendedGeneration,webApplication:context.renderMode==='web'}).instruction}`
   const requestBody=phase!=='test'&&unit?{...body,request:undefined,plan:{interfaces:plan.interfaces,modules:plan.modules.map(({name,purpose})=>({name,purpose}))},unit,requirements:plan.requirements.filter(r=>unit.requirements.includes(r.id)).map(({id,acceptance,quote})=>({id,acceptance,quote}))}:fragment&&phase!=='test'?{...body,request:undefined,plan:{modules:plan.modules,interfaces:plan.interfaces},requirements:plan.requirements.map(({id,acceptance,quote})=>({id,acceptance,quote}))}:body
   let action
   try{
    const sourceOnly=phase!=='test'&&unit?.module===target&&plan.modules.find(m=>m.name===target)?.units
    const unitSystem=jsx?`只输出当前JSX文件的完整合法源码，不输出JSON或CardSpec标签。默认导出App，保留已完成单元，本轮只完成unit.goal；新增约2500字符。其他模块仅是接口背景，不输出它们的源码。业务状态归属遵守interfaces，禁止发明尚未实现的跨模块函数。${web}${contract}`:`只输出当前文件的完整源码，不输出JSON操作、文件路径、说明或其他模块。宿主管理版本和原子提交。只完成当前unit.goal，在已有源码上保留已完成内容；后续单元不在本轮实现。新增代码约2500字符。main使用card根和共享声明，所有视图片段用include挂载；片段包含组件及顶层专属action/derive，由宿主链接；不要重复actualInterface已有声明。原生片段挂载必须写<include module="detail.cardspec"/>；JSX不能include，必须用<sandbox id="stage" brief="交互图形" input={{items:derived.rows}} actions={{pick:"pick"}} source="@module:stage.jsx"/>，只传实际存在的数据/动作。JSX是默认导出的App。若输入data列出了dataset，真实数据已经预取，直接<data id="rows" value={context.datasets.D1.items}/>引用实际dataset路径，不抄写items样本或创建loading状态。data没有tool/args属性，不能执行工具；刷新/后续读取只能使用binding和invoke。筛选必须用真实字段改变集合，不把不存在的字段替换成语义不同的字段。${localCore}\n${generationLayout(context.cardSize,'page',{extendedGeneration:context.extendedGeneration,webApplication:context.renderMode==='web'}).instruction}\n${componentContract}${web}${contract}`
    const unitBody={unit,file:rejected.has(target)?{name:target,content:rejected.get(target),uncommitted:true,instruction:'Fix this rejected draft; preserve completed units. It is not a committed version.'}:focused.find(f=>f.name===target)||{name:target},outputContract:jsx?'One complete JSX module with default App export. No CardSpec document.':fragment?'Only sibling component nodes and module-owned declarations. No card/intro/outro, no other files.':'One complete card document for this file only.',interfaces:requestBody.actualInterface||plan.interfaces,modules:plan.modules.map(m=>m.name),requirements:requestBody.requirements,data:research?.context?.({compact:true}),dataReadiness,context:body.context,feedback:body.feedback}
    const repairing=phase==='implementation'&&!unit
    const repairProtocol=context.renderMode==='web'?BUILD_PROTOCOL.split('一次只修改目标模块。')[0]+'一次只修改目标文件；main仅挂载JSX，全部业务状态和按钮归JSX。目标源码已提供，只有缺少依赖时read其他文件。':BUILD_PROTOCOL
    const repairSystem=`只修复当前文件的已观察错误，不重写应用规划，不删需求；优先最小patch。布局错误用分区/局部滚动/渐进披露解决，不能缩小字号、触控目标或裁掉内容来通过；合理大小的overflow:auto列表/日志允许滚动，根容器裁切仍是错误。${repairProtocol}\n${localCore}\n${componentContract}${web}${contract}`
    const repairBody={...requestBody,request:undefined,plan:undefined,requirements:plan.requirements.map(({id,acceptance,quote})=>({id,acceptance,quote})),data:research?.context?.({compact:true})}
    action=normalizeBuildOperation(await call(sourceOnly?unitSystem:phase==='test'?TEST_BUILD_PROTOCOL:repairing?repairSystem:(fragment?fragmentSystem:base)+'\n'+componentContract+web+contract,sourceOnly?unitBody:repairing?repairBody:requestBody,{testing:phase==='test',isolated:repairing,...(sourceOnly?{unitFile:{name:target,version:manifest.find(f=>f.name===target)?.version}}:{})}))
    if(sourceOnly)action.claims=unit.requirements.map(id=>({id,modules:[target]})) // claims still require observed assertions at the final gate
    if(sourceOnly&&target.endsWith('.cardspec')&&manifest.some(f=>f.name===target))assertUnitRetention(workspace.read(target).content,action.files[0].content)
    failedCalls=0
    contract=''
    const progressKey=JSON.stringify({files:workspace.manifest(),pending:workspace.pending(),phase,target,steps,attempt:action})
    stalls=progressKey===lastKey?stalls+1:0;lastKey=progressKey
    if(stalls>=3)throw Object.assign(Error('连续操作未改变实现或测试，停止重复读取/空修复，保留现场'),{code:'BUILD_STALLED'})
    if(phase==='test'){
     if(action.op==='blocked')throw Object.assign(Error('验收受阻：'+String(action.reason).slice(0,400)),{code:'BUILD_STALLED'})
     if(action.op==='implementation_issue'){
      const observed=feedback?.actions?.[action.stepIndex]
      if(!manifest.some(f=>f.name===action.module)||typeof action.reason!=='string'||action.reason.length<12||action.reason.length>600||!observed||observed.skipped||observed.ok&&observed.assertion?.passed!==false&&observed.changed!==false)throw Error('实现修复需要已观察的失败步骤、明确的预期差异和现有模块；先修正/执行测试')
      feedback={module:action.module,error:action.reason,evidence:observed};phase='implementation';continue
     }
     if(action.op!=='test')throw Error('测试阶段实现冻结；仅允许test、带观察证据的implementation_issue或blocked，不允许write/read')
    }else{
     if(action.op==='read'){
      if(!Array.isArray(action.names)||action.names.length!==1||action.names[0]===target)throw Error('目标文件已经提供；最多读取一个其他依赖，不重复read')
      workspace.read(action.names[0]);extraFile=action.names[0];continue
     }
     if(action.op==='describe'){
      if(!Array.isArray(action.names)||action.names.length>6||action.names.some(n=>!Object.hasOwn(REGISTRY,n)))throw Error('invalid component names')
      contract='\n'+registryReference({compact:true,names:action.names});continue
     }
     const requested=action.op==='patch'?action.name:action.op==='write'&&action.files?.length===1?action.files[0].name:null
     if(requested&&requested!==target&&manifest.some(f=>f.name===requested)){
      if(++redirects>2)throw Object.assign(Error('依赖修复反复切换目标，保留证据而不继续空转'),{code:'BUILD_STALLED'})
      feedback={...feedback,module:requested,error:'修复涉及共享依赖；本轮未应用修改。下轮提供此文件实际版本，请用局部patch修复，不必重写原目标模块。'}
      continue
     }
     if(action.op==='chunk'){
      if(action.name!==target)throw Error('chunk只能修改当前目标模块')
      workspace.chunk(action,{checkSyntax:true})
      if(!action.done){feedback={message:'分段已暂存；按pending.offset继续，完整后done=true提交'};await record();continue}
     }else if(action.op==='patch'){
      if(action.name!==target)throw Error('patch只能修改当前目标模块')
      workspace.patch(action,{checkSyntax:true})
     }else{
      if(action.op!=='write'||action.files?.length!==1||action.files[0].name!==target)throw Error('实现阶段只允许write/patch当前目标模块；测试脚本由独立阶段负责')
      workspace.write(action.files,{checkSyntax:true})
     }
     tested=null;redirects=0;rejected.delete(target)
     if(unit&&unit.module===target){committedUnits.add(unit.id);trace.push({kind:'unit-commit',unit:unit.id,goal:unit.goal,version:workspace.read(target).version,remaining:units.length-committedUnits.size})}
    }
    if(action.claims!==undefined){
     if(!Array.isArray(action.claims)||action.claims.length>12)throw Error('invalid claims')
     for(const c of action.claims)if(!plan.requirements.some(r=>r.id===c.id)||!Array.isArray(c.modules)||c.modules.some(n=>!plan.modules.some(m=>m.name===n))||c.blocked!==undefined&&(typeof c.blocked!=='string'||!c.blocked.trim()||c.blocked.length>400))throw Error('invalid claim: immutable requirement ID and planned modules required')
     claims=[...new Map([...claims,...action.claims].map(c=>[c.id,c])).values()]
    }
    // Never accept test scripts embedded in a code-writing response.
    if(phase==='test'&&action.steps!==undefined){
     // Validate individual assertions before compaction so no invalid field is hidden.
     if(Array.isArray(action.steps))for(const step of action.steps)validateDebugInput({source:'<card/>',steps:[step]},context.extendedGeneration||context.renderMode==='web'?120000:48000)
     steps=validateDebugInput({source:'<card/>',steps:compactBuildTestSteps(action.steps)},48000).steps
    }
    if(nextBuildUnit(units,committedUnits)||plan.modules.some(m=>!workspace.manifest().some(f=>f.name===m.name))){phase='implementation';feedback=null;await record();continue}
    let assembled
    try{assembled=workspace.assemble()}catch(e){feedback={error:e.message,module:e.module||'main.cardspec'};phase='implementation';continue}
    const absent=plan.modules.filter(m=>!assembled.used.includes(m.name))
    if(absent.length){feedback={error:'Unconnected modules: '+absent.map(m=>m.name).join(', ')+'. Include from main; do not copy inline.',module:'main.cardspec'};phase='implementation';continue}
    const dataIssues=buildDataflowDiagnostics(assembled.source,{context:{...context,datasets:research?.datasets?.()||context.datasets},records:research?.records?.()||[]})
    if(dataIssues.length){
     const diagnostics=dataIssues.map(d=>({...d,module:assembled.ranges.find(r=>Number.isInteger(d.offset)&&d.offset>=r.start&&d.offset<r.end)?.name||'main.cardspec'}))
     feedback={phase:'implementation',module:diagnostics[0].module,diagnostics,error:'数据流或导航尚未接通；修复指出的模块，不改测试预期。'};phase='implementation';await record();continue
    }
    // Code repair runs a discovery pass only; selectors/assertions cannot cause code rewrites.
    const checkedSteps=phase==='test'?steps:[{op:'check'}]
    let rawFeedback=await debug.test({source:assembled.source,steps:checkedSteps},{signal})
    let evidence=debug.evidence();feedback=buildFeedback(rawFeedback,evidence,assembled)
    if(rawFeedback.status==='budget_exhausted'||rawFeedback.status==='unverified')throw Object.assign(Error('验收环境/预算不可用：'+(feedback.unavailable||rawFeedback.status)),{code:'BUILD_STALLED'})
    ledger.record(assembled.version,checkedSteps,evidence)
    // Code changes invalidate evidence, not the executable regression flows.
    // Replay in clean browser states; don't concatenate independent start paths.
    if(phase!=='test'&&feedback.phase==='test')for(const replay of ledger.pending(assembled.version)){
     rawFeedback=await debug.test({source:assembled.source,steps:replay},{signal})
     evidence=debug.evidence();feedback=buildFeedback(rawFeedback,evidence,assembled)
     if(['budget_exhausted','unverified'].includes(rawFeedback.status))throw Object.assign(Error('回归验收不可用，保留现场'),{code:'BUILD_STALLED'})
     ledger.record(assembled.version,replay,evidence)
     trace.push({kind:'regression-replay',version:assembled.version,requirements:[...new Set(replay.map(s=>s.requirement).filter(Boolean))],status:rawFeedback.status})
     if(feedback.phase==='implementation'||feedback.testRepair?.length){steps=replay;break}
    }
    lastAudit=requirementAudit(plan.requirements,claims,{actions:ledger.actions()})
    // Keep the strongest observed candidate, separately from the latest draft.
    // It is an inspection checkpoint, never permission to skip acceptance.
    const score=[lastAudit.items.filter(r=>['checked','limited'].includes(r.status)).length,-feedback.diagnostics.filter(d=>d.severity==='error').length,-feedback.layout.length,-feedback.layout.reduce((s,i)=>s+(i.overflow||0),0)]
    const different=bestCandidate?score.findIndex((v,i)=>v!==bestCandidate.score[i]):-1
    if(!bestCandidate||different>=0&&score[different]>bestCandidate.score[different]){
     bestCandidate={version:assembled.version,score,status:'manual-review-required',path:'artifacts/deep-build/'+cardId+'/best-candidate.json'}
     await mkdir(root,{recursive:true});await writeFile(resolve(root,'best-candidate.json'),JSON.stringify({goal:input.prompt,context:{renderMode:context.renderMode,expressionDialect:context.expressionDialect,cardSize:context.cardSize,extendedGeneration:context.extendedGeneration},plan,claims,steps,committedUnits:[...committedUnits],workspace:workspace.snapshot(),source:assembled.source,coverage:lastAudit,feedback,...bestCandidate},null,2))
    }
    if(phase==='test')testAttempts++
    if(phase==='test'&&['passed','partial'].includes(rawFeedback.status)&&!feedback.layout.length&&!feedback.testRepair?.length&&lastAudit.items.every(r=>['checked','limited'].includes(r.status))){tested={version:assembled.version,feedback:rawFeedback,audit:lastAudit};return await finish()}
    phase=feedback.phase
    if(phase==='implementation')feedback.module=feedback.module||'main.cardspec'
    if(!context.extendedGeneration&&testAttempts>=6)throw Object.assign(Error('验收脚本达到6轮，保留未通过需求与观察结果，不降低标准'),{code:'BUILD_STALLED'})
   }catch(e){
    signal?.throwIfAborted();if(['BUILD_STALLED','GENERATION_BUDGET'].includes(e.code))throw e
    if(e.code==='OUTPUT_TRUNCATED')emit({type:'build_progress',stage:'recovery',message:'本轮未提交完整代码，正在缩小操作并恢复；已完成模块保留'})
    const draft=action?.op==='write'&&action.files?.length===1&&action.files[0].name===target?action.files[0].content:null
    if(typeof draft==='string'&&draft.length<=18000)rejected.set(target,draft)
    feedback={...feedback,underlyingError:feedback?.underlyingError||feedback?.error,error:e.message,...(e.module?{module:e.module}:{}),...(e.code==='OUTPUT_TRUNCATED'?{recovery:phase==='test'?'输出较短的完整test操作；先覆盖当前可见路径，随后按观察增补，不重复长解释。':'本轮没有提交任何修改。改用chunk分段写入完整模块，或对已有文件做少量patch，不重复全量输出。'}:{})}
    // Malformed model output must converge as well, not silently consume the whole budget.
    if(!action&&++failedCalls>=3)throw Error('连续三次模型调用未提交有效操作：'+e.message)
   }
   await record()
  }
  throw Error('深度构建达到轮数上限；未完成项与源码已保存在 trace，未宣称全部通过')
 }finally{await record()}
}
