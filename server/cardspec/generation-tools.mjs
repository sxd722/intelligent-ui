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
const tool=(name,description,properties,required=[])=>({type:'function',function:{name,description,parameters:{type:'object',properties,required,additionalProperties:false}}})
export const GENERATION_TOOL_PROMPT=`${BINDING_PLAN_INSTRUCTION}\n${HOST_PAGINATION_INSTRUCTION}\n取数按需：cli_discover按用途全局检索（不确定时按领域/来源浏览）→cli_describe批量核实所选契约→cli_read只读执行。候选非全集，无数据需求可不用工具。返回dataset路径引用完整数据，items只是样本；更多样本dataset_read，缺筛选/详情字段dataset_enrich按真实ID补取。可先设计加载/空态，不把占位当事实。输出前可调用plan_cards规划1–3张互补卡（简单任务一张）及0–2个有用后续意图（可为空）；只写标题/任务/意图，本轮只输出首张card。宿主负责其余卡和后续入口，不重复实现。`
export function createGenerationTools({catalog=[],invoke,analyze,budget,discover=toolDiscovery.discover,initialRecords=[],renderMode='native',enabled=true,allowDeck=true,goal,allowPlanning=goal===undefined?true:planningPolicy(goal,{enabled,allowDeck}).allowPlanning}){
 const connections=createBindingPlan()
 const adaptive=budget?.policy.profile==='adaptive-v1'
 const maxCards=allowDeck?(/(?:三|3)\s*张|three.?cards/i.test(String(goal||''))?3:2):1
 const records=structuredClone(initialRecords),seen=new Map(),blockedReads=new Map();let plan=null,reads=0,bytes=JSON.stringify(records).length,locked=false
 if(records.length>40||bytes>320000)throw Error('Restored dataset budget exceeded')
 for(const r of records)if(TOOLS[r.tool])seen.set(r.tool+canonicalInput(r.input),r)
 const readable=catalog.filter(t=>enabled&&t.available&&!t.unsupportedReason&&t.readOnly!==false&&t.id!=='glm.generate'&&t.provider!=='host')
 const allowed=new Map(readable.map(t=>[t.id,t]))
 let planningAttempted=false
 const tools=()=>[
  tool('capability_find','按任务用途搜索组件和工具候选；不执行查询，不替代精确契约',{query:{type:'string',maxLength:160}},['query']),
  tool('component_describe','按需查看组件精确契约，一次至多6个；无需模型重复实现宿主功能',{names:{type:'array',maxItems:6,items:{type:'string'}}},['names']),
  tool('plan_cards','规划体验及卡组分工；每张goal短述使用者角色、主体、操作→结果、视图共用数据与详情分层。后续用短label作按钮标题，prompt写输入→结果，不生成正文',{cards:{type:'array',maxItems:maxCards,items:{type:'object',properties:{title:{type:'string',maxLength:60},goal:{type:'string',maxLength:600}},required:['title','goal'],additionalProperties:false}},followups:{type:'array',maxItems:2,items:{type:'object',properties:{label:{type:'string',maxLength:24},prompt:{type:'string',maxLength:200}},required:['label','prompt'],additionalProperties:false}}},['cards','followups']),
  ...(enabled?[
   tool('cli_discover','用途明确用query全局语义检索；不确定可按domains→sources→tools浏览。发现不等于执行许可',{query:{type:'string',maxLength:120},level:{type:'string',enum:['domains','sources','tools']},domains:{type:'array',maxItems:4,items:{type:'string'}},sources:{type:'array',maxItems:6,items:{type:'string'}},offset:{type:'integer',minimum:0}}),
   tool('cli_describe','按需展开真实契约，ids一次至多4个；knownVersions跳过已有契约',{id:{type:'string'},ids:{type:'array',minItems:1,maxItems:4,items:{type:'string'}},knownVersions:{type:'object',additionalProperties:{type:'string'}},binding:BINDING_INTENT_SCHEMA}),
   tool('cli_read','执行已声明且可用的只读工具；参数必须来自契约',{id:{type:'string'},input:{type:'object',additionalProperties:true},binding:BINDING_INTENT_SCHEMA},['id','input']),
   tool('dataset_read','查看已取得数据的另一段样本，最多8项',{dataset:{type:'string'},offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:8}},['dataset']),
   tool('dataset_enrich','筛选/详情缺字段时，按真实ID补取详情并合入原dataset；最多5条，保留未知。不新增模型调用',{dataset:{type:'string'},fields:{type:'array',maxItems:8,items:{type:'string'}},limit:{type:'integer',minimum:1,maximum:5}},['dataset','fields']),
   ...(adaptive?[
    tool('workflow_run','批量只读取数：1–6步，浏览器串行；after依赖失败则跳过；每一步仍计真实读取预算',{steps:{type:'array',maxItems:6,items:{type:'object',properties:{id:{type:'string'},tool:{type:'string'},input:{type:'object',additionalProperties:true},after:{type:'array',items:{type:'string'}}},required:['id','tool','input'],additionalProperties:false}}},['steps']),
    tool('dataset_aggregate','按真实字段统计已取得记录，宿主计数并返回原记录ID；可按日期分组',{dataset:{type:'string'},groupBy:{type:'string'},timeField:{type:'string'}},['dataset','groupBy']),
    ...(analyze?[tool('dataset_analyze','必要时分类原记录（至多40项），一次共享预算模型调用，标签必须引用原文。返回analysisLabel/analysisQuote；之后aggregate计数。非总体民意统计。',{dataset:{type:'string'},instruction:{type:'string',maxLength:600}},['dataset','instruction'])]:[])
   ]:[])]:[])].filter(t=>t.function.name!=='plan_cards'||allowPlanning&&!locked&&!planningAttempted)
 function summary(r,offset=0,limit=4){
  const value=r.value,items=Array.isArray(value.items)?value.items:[],sample=items.slice(offset,offset+limit)
  const result={bindingRecipe:bindingRecipe(r.tool,r.input),dataset:r.id,path:`context.datasets.${r.id}`,...(adaptive?{descriptor:datasetDescriptor(r)}:{}),tool:r.tool,input:r.input,source:value.source,fetchedAt:value.fetchedAt||r.updatedAt,coverage:value.coverage,truncated:value.truncated,totalObserved:items.length,sampleCount:sample.length,sampleOffset:offset,fields:[...new Set(items.slice(0,20).flatMap(Object.keys))],items:sample.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,typeof v==='string'?v.slice(0,500):v]))),...(!Array.isArray(value.items)?{value}:{}),sampleOnly:sample.length<items.length,instruction:'totalObserved为宿主已保存数量；items仅是模型样本，页面引用path.items取得完整结果。来源是否完整由coverage/truncated决定。'}
  if(adaptive){
   while(result.items.length&&JSON.stringify(result).length>5000)result.items.pop()
   if(JSON.stringify(result).length>5000){delete result.value;result.input={omitted:true};result.fields=result.fields.slice(0,40);if(result.descriptor)result.descriptor.fields=result.descriptor.fields.slice(0,40)}
   result.sampleCount=result.items.length;result.sampleOnly=result.items.length<items.length
  }
  const link=TOOLS[r.tool]?.detail
  if(link)result.enrichment={tool:link.tool,available:allowed.has(link.tool),fields:TOOLS[link.tool]?.columns||[],usage:'dataset_enrich({dataset,fields,limit}) adds missing fields by verified ID to this dataset; filter this same dataset, not the raw list binding.'}
  if(r.enrichment)result.fieldCoverage=r.enrichment.after
  if(decisionProfile(r.tool)){
   const siblings=records.filter(x=>x.tool===r.tool).filter((x,i,a)=>a.findIndex(y=>canonicalInput(y.input)===canonicalInput(x.input))===i).slice(0,4),paired=decisionProfile(r.tool).kind==='tickets'&&siblings.length>1;
   result.hostView={component:'tool-view',profile:decisionProfile(r.tool).kind,usage:DECISION_REFERENCE,
    ...(paired?{declarations:siblings.map(x=>bindingRecipe(x.tool,x.input).declaration),consumer:'<tool-view bindings={'+JSON.stringify(Object.fromEntries(siblings.map((x,i)=>['行程'+(i+1),bindingRecipe(x.tool,x.input).id])))+'}/>',ownership:'以上整个视图内置并排票券、每程选择、候选原地切换、票价与区间经停、返回及恢复。角色标签可改名；不要重写票券/列表/leg/pick/detail状态。用户编辑只需settings内的input→state，binding.input读取state；改哪个输入就只重查该绑定。'}:{consumer:bindingRecipe(r.tool,r.input).consumer})};
  }
  else if(compositionCapability(r.tool))result.hostView={component:'task-board',binding:{tool:r.tool,input:r.input},usage:'候选/比较任务：用上面的tool/input声明binding id="b"，直接 <task-board label="任务名称" view={compose({main:"b"},{primary:"main"})} skin="auto"/>。多源加到同一个compose；内置大图、筛选、多选、详情、对比和恢复，不再手写each列表或外加标题。没有适配的功能仍可自由编排。'}
  return result
 }
 function contextSummary({compact=false}={}){let remaining=compact?7000:16000;return records.filter(r=>!compact||!r.enrichedInto).map(r=>{let s=summary(r,0,compact?1:4);if(compact)s={dataset:s.dataset,path:s.path,tool:s.tool,totalObserved:s.totalObserved,fields:s.fields,items:s.items,enrichment:s.enrichment,fieldCoverage:s.fieldCoverage,hostView:s.hostView,bindingRecipe:s.bindingRecipe};if(adaptive&&JSON.stringify(s).length>remaining)s={dataset:r.id,path:`context.datasets.${r.id}`,totalObserved:r.value?.items?.length||0,sampleOnly:true};remaining-=JSON.stringify(s).length;return s})}

 function save(tool,input,value){
  const length=JSON.stringify(value).length;if(bytes+length>256000)throw Error('结果超过会话数据预算，请缩小查询范围');bytes+=length
  const r={id:'D'+(records.length+1),tool,input,value,updatedAt:new Date().toISOString()};records.push(r);return r
 }
 async function execute(name,input,signal){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('tool input must be object')
  if(name==='capability_find'){
   const found=findCapabilities(input.query,{catalog:[],renderMode})
   return enabled?{...found,...await discover(catalog,input.query,{signal,limit:6})}:found
  }
  if(name==='component_describe'){
   if(!Array.isArray(input.names)||!input.names.length||input.names.length>6||input.names.some(n=>typeof n!=='string'||!Object.hasOwn(REGISTRY,n)))throw Error('unknown component')
   return {contract:registryReference({names:input.names})+(input.names.includes('task-board')?'\n'+COMPOSITION_REFERENCE:'')}
  }
  if(name==='plan_cards'){
   if(!allowPlanning)throw Error('本任务直接生成单卡，无需卡组规划')
   if(locked)throw Error('卡组计划已经提交；本次只生成指定卡片')
   if(!Array.isArray(input.cards)||input.cards.length<1||input.cards.length>maxCards||!Array.isArray(input.followups)||input.followups.length>2)throw Error('计划需1–3张卡和至多两个后续意图')
   const short=(x,n)=>typeof x==='string'&&x.trim()&&x.length<=n
   if(input.cards.some(c=>!short(c.title,60)||!short(c.goal,600))||input.followups.some(s=>typeof s==='string'?!short(s,200):!s||Array.isArray(s)||Object.keys(s).some(k=>!['label','prompt'].includes(k))||!short(s.label,24)||!short(s.prompt,200)))throw Error('计划字段过长或为空')
   plan={profile:'cardplan-v2',temperature:PLAN_TEMPERATURE,cards:input.cards.map(c=>({title:c.title,goal:c.goal})),followups:[...input.followups]};return {accepted:true,current:plan.cards[0],instruction:'只生成第一张卡；其余宿主负责，后续意图由宿主展示入口'}
  }
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
  if(name==='dataset_read'){const r=records.find(r=>r.id===input.dataset);if(!r)throw Error('未知dataset');if(!Number.isInteger(input.offset??0)||(input.offset??0)<0||!Number.isInteger(input.limit??4)||(input.limit??4)<1||(input.limit??4)>8)throw Error('invalid dataset range');return summary(r,input.offset??0,input.limit??4)}
  if(['cli_describe','cli_read'].includes(name))validateBindingIntent(input.binding)
  if(name==='cli_describe'&&input.ids!==undefined){
   if(input.id||!Array.isArray(input.ids)||input.ids.length<1||input.ids.length>4||input.ids.some(id=>typeof id!=='string'))throw Error('describe requires id or 1–4 ids')
   return {contracts:await Promise.all([...new Set(input.ids)].map(id=>execute('cli_describe',{id,knownVersions:input.knownVersions,...(input.ids.length===1?{binding:input.binding}:{})},signal))),...(input.ids.length>1?{bindingPolicy:'批量契约仅为候选，不承诺全部绑定；选定工具后用单项describe或read附带binding意图。'}:{})}
  }
  let t=name==='cli_describe'?catalog.find(t=>enabled&&t.id===input.id&&!t.unsupportedReason):allowed.get(input.id);if(!t){const blocked=enabled&&catalog.find(t=>t.id===input.id);throw Error(blocked&&!blocked.available?`工具暂不可执行：${blocked.reason||blocked.connection||'需连接或启用'}；这不证明来源站点离线。`:'工具不存在、未启用或不允许生成期间调用')}
  if(blockedReads.has(t.id))t={...t,available:false,reason:blockedReads.get(t.id).errorInfo?.message||blockedReads.get(t.id).message}
  connections.add(t.id,input.binding,{...(name==='cli_read'?{input:input.input}:{}),available:!!t.available,reason:t.reason})
  if(name==='cli_describe'&&input.knownVersions?.[t.id]===contractVersion(t))return {bindingRecipe:bindingRecipe(t.id,undefined,input.binding),id:t.id,version:contractVersion(t),unchanged:true,available:!!t.available,readOnly:t.readOnly!==false,...(!t.available?{reason:t.reason||'当前不可执行'}:{})}
  if(name==='cli_describe')return {bindingRecipe:bindingRecipe(t.id,undefined,input.binding),version:contractVersion(t),id:t.id,available:!!t.available,readOnly:t.readOnly!==false,...(!t.available?{reason:t.reason||'当前不可执行',connection:t.connection}:{}),input:TOOLS[t.id].inputSchema,output:TOOLS[t.id].outputSchema,columns:t.columns,fieldSemantics:t.fieldSemantics,detail:t.detail||null,composition:decisionProfile(t.id)?null:compositionCapability(t.id),taskView:taskToolFields(t.id)?{...taskToolFields(t.id),component:"tool-view",usage:decisionProfile(t.id)?DECISION_REFERENCE:"用tool-view task组合条件、选择、固定和比较，字段仅限本表，详情由宿主提供。"}:null,presentation:presentationFor(t.id)?{component:'tool-view',kind:presentationFor(t.id).kind,mappingVersion:1,usage:'<tool-view tool="'+t.id+'" input={参数对象} style="当前风格"/>；宿主负责映射、加载和详情。'}:null}
  if(name!=='cli_read')throw Error('unknown generation tool')
  validateToolInput(t.id,input.input)
  if(blockedReads.has(t.id))throw blockedReads.get(t.id)
  const key=t.id+canonicalInput(input.input);if(seen.has(key))return {...summary(seen.get(key)),bindingRecipe:bindingRecipe(t.id,input.input,input.binding)}
  if(budget)budget.read();else if(reads>=6)throw Error('生成前读取已达到6次预算');reads++
  let result
  try{result=await invoke({tool:t.id,input:input.input,target:'binding',cause:'generation',requestId:randomUUID(),pageId:'generation',sessionId:'generation'},signal)}catch(e){
   if(['AUTH_REQUIRED','ACCESS_RESTRICTED','RATE_LIMITED','SCHEMA_MISMATCH'].includes(e.errorInfo?.code||e.code)){blockedReads.set(t.id,e);connections.unavailable(t.id,e.errorInfo?.message||e.message)}
   throw e
  }
  signal?.throwIfAborted();validateJson(result.value,TOOLS[t.id].outputSchema)
  const r=save(t.id,input.input,result.value);seen.set(key,r);return {...summary(r),bindingRecipe:bindingRecipe(t.id,input.input,input.binding)}
 }
 return {tools,execute,bindingPlan:connections.snapshot,planningRequest:()=>goal!==undefined&&allowPlanning&&!locked&&!planningAttempted?{goal,temperature:PLAN_TEMPERATURE,prompt:PLAN_DESIGN+'\n'+PLAN_CAPABILITIES+'\n'+sandboxInstruction(renderMode),tool:tools().find(t=>t.function.name==='plan_cards')}:null,finishPlanning:()=>{planningAttempted=true},prompt:(enabled?GENERATION_TOOL_PROMPT.split('输出前可调用plan_cards')[0]:'')+(allowPlanning?GENERATION_TOOL_PROMPT.slice(GENERATION_TOOL_PROMPT.indexOf('输出前可调用plan_cards')):'本次直接完成单卡，不调用plan_cards；仍可按真实任务声明用户触发的glm.generate后续，不为凑数添加入口。'),records:()=>structuredClone(records),datasets:()=>Object.fromEntries(records.map(r=>[r.id,r.value])),plan:()=>plan&&structuredClone(plan),lockPlan:()=>{locked=true},context:contextSummary,snapshot:()=>({reads,datasetCount:records.length,plan})}
}
import {presentationFor,toolViewReference} from '../../shared/cardspec/tool-presentations.mjs'
import {taskToolFields} from '../../shared/cardspec/task-reference.mjs'

import {compositionCapability,COMPOSITION_REFERENCE} from '../../shared/cardspec/task-composition.mjs'

