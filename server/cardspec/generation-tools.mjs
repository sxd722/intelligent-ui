import {readDatasetText,longTextFields} from './dataset-text.mjs'
import {CONTENT_SKELETON_SCHEMA,normalizeContentSkeleton,CONTENT_RELATION_INSTRUCTION} from '../../shared/cardspec/content-skeleton.mjs'
import {auditResultCoverage} from '../../shared/cardspec/task-evidence.mjs'
import {HOST_PAGINATION_INSTRUCTION} from '../../shared/cardspec/result-pagination.mjs'
import {BINDING_INTENT_SCHEMA,BINDING_PLAN_INSTRUCTION,createBindingPlan,bindingRecipe,validateBindingIntent} from './binding-plan.mjs'
import {browseTools,contractVersion} from '../tools/discovery-tree.mjs'
import {sandboxInstruction} from '../../shared/cardspec/sandbox-policy.mjs'
import {PLAN_DESIGN,PLAN_CAPABILITIES,PLAN_TEMPERATURE} from '../../shared/cardspec/plan-design.mjs'
import {planningPolicy} from './compact-prompt.mjs'
import {randomUUID} from 'node:crypto'
import {TOOLS,validateToolInput,validateJson} from '../../shared/cardspec/tools.mjs'
import {canonicalInput} from '../../shared/cardspec/prefetch.mjs'
import {datasetDescriptor,datasetAggregate,validateAnnotations,analysisInput} from './datasets.mjs'
import {runReadWorkflow} from './workflow.mjs'
import {REGISTRY,registryReference} from '../../shared/cardspec/registry.mjs'
import {findCapabilities} from '../../shared/cardspec/capability-index.mjs'
import {enrichDataset} from './data-enrichment.mjs'
import {toolDiscovery} from '../tools/semantic-discovery.mjs'
import {decisionProfile,DECISION_REFERENCE} from '../../shared/cardspec/decision-profile.mjs'
import {journeyRequirements} from './journey-coverage.mjs'
import {CORE_TASK_SCHEMA,CORE_TASK_INSTRUCTION,normalizeTaskIntent} from '../../shared/cardspec/core-task.mjs'
import {routeCoreTasks} from '../tools/task-routing.mjs'
import {evidencePresentation} from '../../shared/cardspec/evidence-presentation.mjs'
const tool=(name,description,properties,required=[])=>({type:'function',function:{name,description,parameters:{type:'object',properties,required,additionalProperties:false}}})
export const GENERATION_TOOL_PROMPT=`${BINDING_PLAN_INSTRUCTION}\n${HOST_PAGINATION_INSTRUCTION}\n取数按需：cli_discover按用途全局检索（不确定时按领域/来源浏览）→cli_describe批量核实所选契约→cli_read只读执行。候选非全集，无数据需求可不用工具。返回hostView时按核心任务选择consumer，不另写重复筛选/详情。多工具和素材围绕当前对象时，先component_describe(task-board)：compose共享选择和角色视图，避免逐个tool-view平铺。工具摘要字段不等于binding.value字段。返回dataset路径引用完整数据，items只是样本；更多样本dataset_read；longTextFields标明被截断的正文，用dataset_read的field/find按需读原文再归纳，缺筛选/详情字段dataset_enrich按真实ID补取。可先设计加载/空态，不把占位当事实。输出前可调用plan_cards规划1–3张互补卡（简单任务一张）及0–2个有用后续意图（可为空）；只写标题/任务/意图，本轮只输出首张card。宿主负责其余卡和后续入口，不重复实现。`
export function createGenerationTools({catalog=[],invoke,analyze,budget,discover=toolDiscovery.discover,initialRecords=[],experiment=null,renderMode='native',webGraphics=false,enabled=true,allowDeck=true,goal,contentRelations='on',allowPlanning=goal===undefined?true:planningPolicy(goal,{enabled,allowDeck}).allowPlanning}){
 const connections=createBindingPlan()
 const adaptive=budget?.policy.profile==='adaptive-v1'
 const maxCards=allowDeck?(/(?:三|3)\s*张|three.?cards/i.test(String(goal||''))?3:2):1
 const records=structuredClone(initialRecords),seen=new Map(),blockedReads=new Map();let plan=null,reads=0,bytes=JSON.stringify(records).length,locked=false
 if(records.length>40||bytes>320000)throw Error('Restored dataset budget exceeded')
 for(const r of records)if(TOOLS[r.tool])seen.set(r.tool+canonicalInput(r.input),r)
 const readable=catalog.filter(t=>enabled&&t.available&&!t.unsupportedReason&&t.readOnly!==false&&t.id!=='glm.generate'&&t.provider!=='host')
 const allowed=new Map(readable.map(t=>[t.id,t]))
 let planningAttempted=false,taskIntent=null,taskRouting=null
 const routedTasks=(id,index)=>{const matches=(taskRouting?.tasks||[]).filter(t=>t.requiresBinding&&t.tools.some(c=>c.id===id));return index===undefined?(matches.length===1?matches:[]):matches.filter(t=>t.task===index)}
 function recordRouteRead(id,index,status,error){
  for(const task of routedTasks(id,index)){
   const attempts=[...(task.execution?.attempts||[]),{tool:id,status,...(error?{error:String(error).slice(0,180)}:{})}].slice(-4)
   task.execution={status:attempts.some(a=>a.status==='succeeded')?'succeeded':'failed',attempts}
  }
 }
 const pendingReads=()=> (taskRouting?.tasks||[]).filter(t=>t.requiresBinding&&t.execution?.status!=='succeeded'&&(t.execution?.attempts?.length||0)<2).map(t=>({...t,next:{...t.next,describe:t.next.describe.filter(id=>!t.execution?.attempts?.some(a=>a.tool===id))}})).filter(t=>t.next.describe.length)
 async function routeIntent(input,signal){
  const normalized=normalizeTaskIntent(input)
  if(taskRouting&&canonicalInput(normalized)===canonicalInput(taskIntent))return {taskIntent,taskRouting,cached:true,instruction:taskRouting.instruction}
  const routed=await routeCoreTasks(enabled?catalog:[],normalized,{signal,discover})
  taskIntent=normalized;taskRouting=routed
  return {taskIntent,taskRouting,instruction:routed.instruction}
 }
 const tools=()=>[
  ...(enabled?[tool('task_route','提交核心任务与查询；宿主跨全目录匹配来源与工具，不执行CLI，不生成布局',CORE_TASK_SCHEMA.properties,CORE_TASK_SCHEMA.required)]:[]),
  tool('capability_find','按任务用途搜索组件和工具候选；不执行查询，不替代精确契约',{query:{type:'string',maxLength:160}},['query']),
  tool('component_describe','按需查看组件精确契约，一次至多6个；无需模型重复实现宿主功能',{names:{type:'array',maxItems:6,items:{type:'string'}}},['names']),
  tool('plan_cards','规划体验及卡组分工；每张goal短述使用者角色、主体、操作→结果、视图共用数据与详情分层。后续用短label作按钮标题，prompt写输入→结果，不生成正文',{taskIntent:CORE_TASK_SCHEMA,cards:{type:'array',maxItems:maxCards,items:{type:'object',properties:{title:{type:'string',maxLength:60},goal:{type:'string',maxLength:600},...(contentRelations!=='off'?{contentSkeleton:CONTENT_SKELETON_SCHEMA}:{}),journeyIds:{type:'array',items:{type:'string',pattern:'^R[0-9]+$'},maxItems:12}},required:['title','goal'],additionalProperties:false}},followups:{type:'array',maxItems:2,items:{type:'object',properties:{label:{type:'string',maxLength:24},prompt:{type:'string',maxLength:200}},required:['label','prompt'],additionalProperties:false}}},['cards','followups','taskIntent']),
  ...(enabled?[
   tool('cli_discover','用途明确用query全局语义检索；不确定可按domains→sources→tools浏览。发现不等于执行许可',{query:{type:'string',maxLength:120},level:{type:'string',enum:['domains','sources','tools']},domains:{type:'array',maxItems:4,items:{type:'string'}},sources:{type:'array',maxItems:6,items:{type:'string'}},offset:{type:'integer',minimum:0}}),
   tool('cli_describe','按需展开真实契约，ids一次至多4个；knownVersions跳过已有契约',{id:{type:'string'},ids:{type:'array',minItems:1,maxItems:4,items:{type:'string'}},knownVersions:{type:'object',additionalProperties:{type:'string'}},binding:BINDING_INTENT_SCHEMA}),
   tool('cli_read','执行已声明且可用的只读工具；参数必须来自契约；task可引用宿主任务序号（多个任务共用来源时填写）',{id:{type:'string'},input:{type:'object',additionalProperties:true},task:{type:'integer',minimum:0,maximum:2},binding:BINDING_INTENT_SCHEMA},['id','input']),
   tool('dataset_read','读取已有数据：默认最多8行；field读取offset行的长正文，可find定位相关原文，无外部调用',{dataset:{type:'string'},offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:8},field:{type:'string'},textOffset:{type:'integer',minimum:0},textLimit:{type:'integer',minimum:100,maximum:2400},find:{type:'string',maxLength:120}},['dataset']),
   tool('dataset_enrich','筛选/详情缺字段时，按真实ID补取详情并合入原dataset；最多5条，保留未知。不新增模型调用',{dataset:{type:'string'},fields:{type:'array',maxItems:8,items:{type:'string'}},limit:{type:'integer',minimum:1,maximum:5}},['dataset','fields']),
   ...(adaptive?[
    tool('workflow_run','批量只读取数：1–6步，浏览器串行；after依赖失败则跳过；每一步仍计真实读取预算',{steps:{type:'array',maxItems:6,items:{type:'object',properties:{id:{type:'string'},tool:{type:'string'},input:{type:'object',additionalProperties:true},after:{type:'array',items:{type:'string'}}},required:['id','tool','input'],additionalProperties:false}}},['steps']),
    tool('dataset_aggregate','按真实字段统计已取得记录，宿主计数并返回原记录ID；可按日期分组',{dataset:{type:'string'},groupBy:{type:'string'},timeField:{type:'string'}},['dataset','groupBy']),
    ...(analyze?[tool('dataset_analyze','必要时分类原记录（至多40项），一次共享预算模型调用，标签必须引用原文。返回analysisLabel/analysisQuote；之后aggregate计数。非总体民意统计。',{dataset:{type:'string'},instruction:{type:'string',maxLength:600}},['dataset','instruction'])]:[])
   ]:[])]:[])].filter(t=>t.function.name!=='plan_cards'||allowPlanning&&!locked&&!planningAttempted)
 function summary(r,offset=0,limit=4){
  const value=r.value,items=Array.isArray(value.items)?value.items:[],sample=items.slice(offset,offset+limit)
  const result={presentation:evidencePresentation(value),taskCoverage:auditResultCoverage({goal,...r}),bindingRecipe:bindingRecipe(r.tool,r.input),dataset:r.id,path:`context.datasets.${r.id}`,...(adaptive?{descriptor:datasetDescriptor(r)}:{}),tool:r.tool,input:r.input,source:value.source,fetchedAt:value.fetchedAt||r.updatedAt,coverage:value.coverage,truncated:value.truncated,totalObserved:items.length,sampleCount:sample.length,sampleOffset:offset,longTextFields:longTextFields(sample,offset),fields:[...new Set(items.slice(0,20).flatMap(Object.keys))],items:sample.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,typeof v==='string'?v.slice(0,500):v]))),...(!Array.isArray(value.items)?{value}:{}),sampleOnly:sample.length<items.length,instruction:'totalObserved为宿主已保存数量；items仅是模型样本，页面引用path.items取得完整结果。来源是否完整由coverage/truncated决定。'}
  if(r.snapshotCoverage)result.snapshotCoverage=structuredClone(r.snapshotCoverage)
  if(r.tool==='dataset.analyze'){
   const parent=records.find(p=>p.id===value.analysis?.dataset?.id)
   // Never echo every original row again inside input + binding DSL. Keep the
   // exact invocation in the host; expose a verified reference and small sample.
   if(parent&&/^D\d+$/.test(parent.id)&&canonicalInput(parent.value?.items)===canonicalInput(r.input.items)){
    const args=`{items:context.datasets.${parent.id}.items,instruction:${JSON.stringify(r.input.instruction).replaceAll('<','\\u003c').replaceAll('>','\\u003e')}}`
    result.input={itemsPath:`context.datasets.${parent.id}.items`,instruction:r.input.instruction}
    result.bindingRecipe={...result.bindingRecipe,load:'manual',declaration:`<binding id="${result.bindingRecipe.id}" tool="dataset.analyze" input={${args}} initial={{items:[],source:"",fetchedAt:"",truncated:false}} load="manual"/>`,reuse:'复用同一快照的已有分类，不自动调用模型。刷新原始数据后须明确重做分类；不能沿用旧标签。'}
    result.classificationCounts=datasetAggregate(r,{groupBy:'analysisLabel'}).items.map(({group,value})=>({label:group,value}))
    if(compositionCapability(parent.tool))result.hostView={component:'task-board',declarations:[bindingRecipe(parent.tool,parent.input).declaration,result.bindingRecipe.declaration],consumer:`<task-board label="分类与原文" layout="evidence" view={compose({main:"${bindingRecipe(parent.tool,parent.input).id}"},{annotations:"${result.bindingRecipe.id}"})} skin="auto"/>`,usage:'直接使用此单一主体，内置分类统计→分类/来源交叉筛选→样本详情/引文→原文跳转→返回与恢复。不要另写chart/each/分类state复制同一数据；多源加入同一compose，annotations可为分类binding ID数组。宿主只给仍匹配原记录的引文分类计数，刷新后新记录显示未分类；分析不自动重放。'}
   }
  }
  if(adaptive){
   while(result.items.length&&JSON.stringify(result).length>5000)result.items.pop()
   if(JSON.stringify(result).length>5000){delete result.value;result.input={omitted:true};result.fields=result.fields.slice(0,40);if(result.descriptor)result.descriptor.fields=result.descriptor.fields.slice(0,40)}
   result.sampleCount=result.items.length;result.sampleOnly=result.items.length<items.length
  }
  const link=TOOLS[r.tool]?.detail
  if(link)result.enrichment={tool:link.tool,available:allowed.has(link.tool),fields:TOOLS[link.tool]?.columns||[],usage:'dataset_enrich({dataset,fields,limit}) adds missing fields by verified ID to this dataset; filter this same dataset, not the raw list binding.'}
  if(r.enrichment)result.fieldCoverage=r.enrichment.after
  if(decisionProfile(r.tool)){
   const roles=(taskRouting?.tasks||[]).filter(t=>t.tools.some(c=>c.id===r.tool)),summarize=roles.length>0&&roles.every(t=>['understand','monitor','create','custom'].includes(t.kind));
   const siblings=records.filter(x=>x.tool===r.tool).filter((x,i,a)=>a.findIndex(y=>canonicalInput(y.input)===canonicalInput(x.input))===i).slice(0,4),paired=decisionProfile(r.tool).kind==='tickets'&&siblings.length>1;
   result.hostView={component:'tool-view',profile:decisionProfile(r.tool).kind,composition:compositionCapability(r.tool),usage:DECISION_REFERENCE,
    ...(paired?{declarations:siblings.map(x=>bindingRecipe(x.tool,x.input).declaration),consumer:'<tool-view bindings={'+JSON.stringify(Object.fromEntries(siblings.map((x,i)=>['行程'+(i+1),bindingRecipe(x.tool,x.input).id])))+'}/>',ownership:'以上整个视图内置并排票券、每程选择、候选原地切换、票价与区间经停、返回及恢复。角色标签可改名；不要重写票券/列表/leg/pick/detail状态。用户编辑只需settings内的input→state，binding.input读取state；改哪个输入就只重查该绑定。'}:{consumer:bindingRecipe(r.tool,r.input).consumer,summaryConsumer:`<tool-view binding="${bindingRecipe(r.tool,r.input).id}" presentation="summary"/>`})};
   if(summarize)result.hostView={component:'tool-view',composition:compositionCapability(r.tool),consumer:`<tool-view binding="${bindingRecipe(r.tool,r.input).id}" presentation="summary"/>`,usage:'当前任务以了解为主，展示当前对象摘要，不自动升级为购买工作台。多工具与素材读取task-board的compose契约；各绑定参数共用当前对象。'};
  }
  else if(compositionCapability(r.tool))result.hostView={component:'task-board',binding:{tool:r.tool,input:r.input},usage:'候选/比较任务：用上面的tool/input声明binding id="b"，直接 <task-board label="任务名称" view={compose({main:"b"},{primary:"main"})} skin="auto"/>。多源加到同一个compose；内置大图、筛选、多选、详情、对比和恢复，不再手写each列表或外加标题。没有适配的功能仍可自由编排。'}
  const taskView=(taskRouting?.tasks||[]).find(t=>t.tools.some(c=>c.id===r.tool))?.presentation
  if(taskView){
   result.taskPresentation={...taskView,availableViews:result.presentation.candidates.filter(c=>c.available).map(c=>c.kind)}
   if(taskView.recipe==='opinion-evidence'&&compositionCapability(r.tool))result.hostView={component:'task-board',consumer:`<task-board label="真实讨论样本" layout="evidence" view={compose({main:"${result.bindingRecipe.id}"},{primary:"main"})} skin="auto"/>`,usage:'把此consumer作为口碑证据主体；多源合入同一个compose。宿主提供搜索、来源筛选、详情及原文，不再手抄data evidence和逐条按钮。需要分类时dataset_analyze后直接采用返回hostView（annotations绑定），其统计和样本共用集合，无需另写chart/each/分类state；标题/播放量不等于用户态度。'}
  }
  return result
 }
 function contextSummary({compact=false}={}){let remaining=compact?7000:16000;return records.filter(r=>!compact||!r.enrichedInto).map(r=>{let s=summary(r,0,compact?1:4);if(compact)s={presentation:s.presentation,taskCoverage:s.taskCoverage,dataset:s.dataset,path:s.path,tool:s.tool,totalObserved:s.totalObserved,fields:s.fields,items:s.items,enrichment:s.enrichment,fieldCoverage:s.fieldCoverage,hostView:s.hostView,bindingRecipe:s.bindingRecipe};if(adaptive&&JSON.stringify(s).length>remaining)s={dataset:r.id,path:`context.datasets.${r.id}`,totalObserved:r.value?.items?.length||0,sampleOnly:true};remaining-=JSON.stringify(s).length;return s})}

 function save(tool,input,value){
  const length=JSON.stringify(value).length;if(bytes+length>256000)throw Error('结果超过会话数据预算，请缩小查询范围');bytes+=length
  const r={id:'D'+(records.length+1),tool,input,value,updatedAt:new Date().toISOString()};records.push(r);return r
 }
 async function execute(name,input,signal){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('tool input must be object')
  if(name==='capability_find'){
   const found=findCapabilities(input.query,{catalog:[],renderMode})
   return enabled?{...found,...await discover(catalog,input.query,{signal,limit:6}),...(taskRouting?{taskRouting}:{})}:found
  }
  if(name==='component_describe'){
   if(!Array.isArray(input.names)||!input.names.length||input.names.length>6||input.names.some(n=>typeof n!=='string'||!Object.hasOwn(REGISTRY,n)))throw Error('unknown component')
   return {contract:registryReference({names:input.names})+(input.names.includes('task-board')?'\n'+COMPOSITION_REFERENCE:'')+(experiment?.logicSnapshots==='readonly-v1'&&input.names.includes('sandbox')?'\nExperimental sandbox attribute: logicSnapshot="siblingLogicId". Read-only data.logicSnapshot.state carries that logic module current state; version/revision identify updates. Keep sandbox and logic as siblings, never nest sandbox inside logic.':'')}
  }
  if(name==='plan_cards'){
   if(!allowPlanning)throw Error('本任务直接生成单卡，无需卡组规划')
   if(locked)throw Error('卡组计划已经提交；本次只生成指定卡片')
   if(!Array.isArray(input.cards)||input.cards.length<1||input.cards.length>maxCards||!Array.isArray(input.followups)||input.followups.length>2)throw Error('计划需1–3张卡和至多两个后续意图')
   const short=(x,n)=>typeof x==='string'&&x.trim()&&x.length<=n
   if(input.cards.some(c=>!short(c.title,60)||!short(c.goal,600))||input.followups.some(s=>typeof s==='string'?!short(s,200):!s||Array.isArray(s)||Object.keys(s).some(k=>!['label','prompt'].includes(k))||!short(s.label,24)||!short(s.prompt,200)))throw Error('计划字段过长或为空')
   if(input.taskIntent)await routeIntent(input.taskIntent,signal)
   const journeys=journeyRequirements(goal||'');for(const c of input.cards)if(c.journeyIds?.some(id=>!journeys.some(r=>r.id===id)))throw Error('Unknown journey ID; use supplied R IDs');
   plan={profile:'cardplan-v3-cuj',journeys,temperature:PLAN_TEMPERATURE,cards:input.cards.map(c=>({title:c.title,goal:c.goal,...(contentRelations!=='off'&&normalizeContentSkeleton(c.contentSkeleton)?{contentSkeleton:normalizeContentSkeleton(c.contentSkeleton)}:{}),...(c.journeyIds?.length?{journeyIds:[...new Set(c.journeyIds)]}:{})})),followups:[...input.followups]};return {accepted:true,current:plan.cards[0],siblings:plan.cards.slice(1),instruction:'只生成第一张卡并验收current.journeyIds；其余宿主负责。注意siblings对当前卡的依赖：共用选择/领域标记须在首卡声明state scope="deck"（例如type="record" initial={{}}），实体ID跨卡一致；后卡将读取这些接口。局部展开/草稿不共享。后续意图由宿主展示入口'}
  }
  if(name==='task_route')return routeIntent(input,signal)
  if(!enabled)throw Error('工具增强已关闭')
  if(adaptive&&name==='workflow_run'){
   if(!Array.isArray(input.steps))throw Error('workflow steps required')
   for(const step of input.steps){if(!allowed.has(step.tool))throw Error('workflow contains unavailable or non-readonly tool');validateToolInput(step.tool,step.input)}
   return runReadWorkflow(input,(id,input,signal)=>execute('cli_read',{id,input},signal),signal)
  }
  if(adaptive&&['dataset_aggregate','dataset_analyze'].includes(name)){
   const r=records.find(r=>r.id===input.dataset);if(!r)throw Error('unknown dataset')
   const key=name+canonicalInput(input);if(seen.has(key))return summary(seen.get(key))
   let value
   if(name==='dataset_aggregate')value={...datasetAggregate(r,input),source:r.value.source||r.tool,fetchedAt:r.updatedAt,coverage:r.value.coverage,truncated:r.value.truncated}
   else{
    if(!analyze||typeof input.instruction!=='string'||!input.instruction.trim()||input.instruction.length>600)throw Error('invalid analysis request')
    const annotations=validateAnnotations(r,await analyze({rows:analysisInput(r),instruction:input.instruction},signal))
    const labels=new Map(annotations.map(a=>[a.id,a]))
    value={...r.value,items:(r.value.items||[]).map((row,i)=>{
     const a=labels.get(String(row.rowKey??row.id??`row-${i}`))
     return {...row,analysisLabel:a?.label||'未分类',analysisQuote:a?.quote||''}
    }),analysis:{dataset:datasetDescriptor(r),classified:annotations.length,scope:'observed sample only',method:'model annotations with exact source quotes'}}
   }
   // Store materialized analysis under the same invocation identity used by a
   // later CardSpec binding, so a matching manual binding can reuse it once.
   const saved=name==='dataset_analyze'?save('dataset.analyze',{items:r.value.items,instruction:input.instruction},value):save(name,input,value)
   seen.set(key,saved);return summary(saved)
  }
  if(name==='dataset_enrich'){
   const r=records.find(r=>r.id===input.dataset);if(!r)throw Error('unknown dataset')
   const link=TOOLS[r.tool]?.detail
   const result=await enrichDataset(r,input,{link:link&&allowed.has(link.tool)?{...link,fields:TOOLS[link.tool].columns}:null,signal,read:async(id,params,signal)=>{
    const response=await execute('cli_read',{id,input:params},signal)
    const detail=records.find(record=>record.id===response.dataset);detail.enrichedInto=r.id;return detail.value
   }})
   const growth=JSON.stringify(result.value).length-JSON.stringify(r.value).length
   if(bytes+growth>256000)throw Error('enrichment exceeds session data budget')
   bytes+=growth;r.value=result.value;r.enrichment=result.report
   return {...summary(r),enrichmentReport:result.report,instruction:'Use this enriched dataset for filtering, details and comparison. Unknown fields stay unknown; do not claim filtering on absent fields. Detail adds information beyond list. Initial values belong to this snapshot; a raw list refresh does not contain enriched fields.'}
  }
  if(name==='cli_discover'){
   if(!input.query)return browseTools(catalog,input)
   if(typeof input.query!=='string'||!input.query.trim()||input.query.length>120)throw Error('query must contain 1–120 characters')
   const found=await discover(catalog,input.query,{signal,limit:8});return {...found,...(input.domains?.length||input.sources?.length?{scope:browseTools(catalog,{...input,level:'sources'}),scopePolicy:'全局语义召回不被分类过滤；scope仅辅助导航'}:{})}
  }
  if(name==='dataset_read'){const r=records.find(r=>r.id===input.dataset);if(!r)throw Error('未知dataset');if(input.field)return readDatasetText(r,input);if(!Number.isInteger(input.offset??0)||(input.offset??0)<0||!Number.isInteger(input.limit??4)||(input.limit??4)<1||(input.limit??4)>8)throw Error('invalid dataset range');return summary(r,input.offset??0,input.limit??4)}
  if(['cli_describe','cli_read'].includes(name))validateBindingIntent(input.binding)
  // Business reads inherit their host-routed live intent. The model need not
  // repeat binding boilerplate; ordinary background reads remain unbound.
  if(name==='cli_read'&&input.task!==undefined&&!routedTasks(input.id,input.task).length)throw Error('task must name a routed task that accepts this tool')
  if(name==='cli_read'&&!input.binding&&routedTasks(input.id,input.task).length)input={...input,binding:{purpose:routedTasks(input.id,input.task).map(t=>t.query).join('；').slice(0,160),load:'visible'}}
  if(name==='cli_describe'&&input.ids!==undefined){
   if(input.id||!Array.isArray(input.ids)||input.ids.length<1||input.ids.length>4||input.ids.some(id=>typeof id!=='string'))throw Error('describe requires id or 1–4 ids')
   return {contracts:await Promise.all([...new Set(input.ids)].map(id=>execute('cli_describe',{id,knownVersions:input.knownVersions,...(input.ids.length===1?{binding:input.binding}:{})},signal))),...(input.ids.length>1?{bindingPolicy:'批量契约仅为候选，不承诺全部绑定；选定工具后用单项describe或read附带binding意图。'}:{})}
  }
  let t=name==='cli_describe'?catalog.find(t=>enabled&&t.id===input.id&&!t.unsupportedReason):allowed.get(input.id);if(!t){const blocked=enabled&&catalog.find(t=>t.id===input.id);throw Error(blocked&&!blocked.available?`工具暂不可执行：${blocked.reason||blocked.connection||'需连接或启用'}；这不证明来源站点离线。`:'工具不存在、未启用或不允许生成期间调用')}
  if(blockedReads.has(t.id))t={...t,available:false,reason:blockedReads.get(t.id).errorInfo?.message||blockedReads.get(t.id).message}
  connections.add(t.id,input.binding,{...(name==='cli_read'?{input:input.input}:{}),available:!!t.available,reason:t.reason})
  if(name==='cli_describe'&&input.knownVersions?.[t.id]===contractVersion(t))return {bindingRecipe:bindingRecipe(t.id,undefined,input.binding),id:t.id,version:contractVersion(t),unchanged:true,available:!!t.available,readOnly:t.readOnly!==false,...(!t.available?{reason:t.reason||'当前不可执行'}:{})}
  if(name==='cli_describe')return {bindingRecipe:bindingRecipe(t.id,undefined,input.binding),version:contractVersion(t),id:t.id,available:!!t.available,readOnly:t.readOnly!==false,...(!t.available?{reason:t.reason||'当前不可执行',connection:t.connection}:{}),input:TOOLS[t.id].inputSchema,output:TOOLS[t.id].outputSchema,columns:t.columns,fieldSemantics:t.fieldSemantics,detail:t.detail||null,composition:compositionCapability(t.id),taskView:taskToolFields(t.id)?{...taskToolFields(t.id),component:"tool-view",usage:decisionProfile(t.id)?DECISION_REFERENCE:"用tool-view task组合条件、选择、固定和比较，字段仅限本表，详情由宿主提供。"}:null,presentation:presentationFor(t.id)?{component:'tool-view',kind:presentationFor(t.id).kind,mappingVersion:1,usage:'<tool-view tool="'+t.id+'" input={参数对象} style="当前风格"/>；宿主负责映射、加载和详情。'}:null}
  if(name!=='cli_read')throw Error('unknown generation tool')
  validateToolInput(t.id,input.input)
  if(blockedReads.has(t.id))throw blockedReads.get(t.id)
  const key=t.id+canonicalInput(input.input);if(seen.has(key)){recordRouteRead(t.id,input.task,'succeeded');return {...summary(seen.get(key)),bindingRecipe:bindingRecipe(t.id,input.input,input.binding)}}
  if(budget)budget.read();else if(reads>=6)throw Error('生成前读取已达到6次预算');reads++
  let result
  try{result=await invoke({tool:t.id,input:input.input,target:'binding',cause:'generation',requestId:randomUUID(),pageId:'generation',sessionId:'generation'},signal)}catch(e){
   recordRouteRead(t.id,input.task,'failed',e.errorInfo?.message||e.message)
   connections.failed(t.id,input.input,e.errorInfo?.message||e.message)
   if(['AUTH_REQUIRED','ACCESS_RESTRICTED','RATE_LIMITED','SCHEMA_MISMATCH'].includes(e.errorInfo?.code||e.code)){blockedReads.set(t.id,e);connections.unavailable(t.id,e.errorInfo?.message||e.message)}
   throw e
  }
  signal?.throwIfAborted();try{validateJson(result.value,TOOLS[t.id].outputSchema)}catch(e){recordRouteRead(t.id,input.task,'failed',e.message);connections.failed(t.id,input.input,e.message);throw e}
  recordRouteRead(t.id,input.task,'succeeded')
  const r=save(t.id,input.input,result.value);if(result.snapshotCoverage)r.snapshotCoverage=structuredClone(result.snapshotCoverage);seen.set(key,r);return {...summary(r),bindingRecipe:bindingRecipe(t.id,input.input,input.binding)}
 }
 function planningRequest(){
  if(goal===undefined||locked||planningAttempted)return null
  if(allowPlanning)return {goal,temperature:PLAN_TEMPERATURE,prompt:CORE_TASK_INSTRUCTION+'\n'+PLAN_DESIGN+(contentRelations!=='off'?'\n'+CONTENT_RELATION_INSTRUCTION:'')+'\n原始CUJ：'+JSON.stringify(journeyRequirements(goal))+'\n'+PLAN_CAPABILITIES+'\n'+sandboxInstruction(renderMode,{webGraphics}),tool:tools().find(t=>t.function.name==='plan_cards')}
  if(enabled)return {goal,temperature:.2,timeoutMs:25000,maxTokens:1000,prompt:CORE_TASK_INSTRUCTION+'\n只提交任务，不规划卡组；所有纯本地任务data=none。',tool:tools().find(t=>t.function.name==='task_route')}
  return null
 }
 return {tools,execute,bindingPlan:connections.snapshot,planningRequest,pendingReads,finishPlanning:()=>{planningAttempted=true},taskRouting:()=>taskRouting&&structuredClone(taskRouting),
  prompt:(enabled?GENERATION_TOOL_PROMPT.split('输出前可调用plan_cards')[0]:'')+(allowPlanning?GENERATION_TOOL_PROMPT.slice(GENERATION_TOOL_PROMPT.indexOf('输出前可调用plan_cards')):'本次直接完成单卡，不调用plan_cards；后续入口按需。')+'\n宿主task_route返回任务来源候选，不需要重写宿主数据转换与计数；取数后以presentation的可用视图为准。',
  records:()=>structuredClone(records),datasets:()=>Object.fromEntries(records.map(r=>[r.id,r.value])),plan:()=>plan&&structuredClone(plan),lockPlan:()=>{locked=true},context:contextSummary,snapshot:()=>({reads,datasetCount:records.length,plan,taskIntent,taskRouting})}
}
import {presentationFor,toolViewReference} from '../../shared/cardspec/tool-presentations.mjs'
import {taskToolFields} from '../../shared/cardspec/task-reference.mjs'

import {compositionCapability,COMPOSITION_REFERENCE} from '../../shared/cardspec/task-composition.mjs'

