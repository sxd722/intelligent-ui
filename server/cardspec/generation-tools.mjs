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
const tool=(name,description,properties,required=[])=>({type:'function',function:{name,description,parameters:{type:'object',properties,required,additionalProperties:false}}})
export const GENERATION_TOOL_PROMPT=`生成前可用cli_discover找能力、cli_describe读取参数契约、cli_read执行只读查询；不得猜工具ID或实体ID。工具返回dataset及context.datasets路径，页面直接引用该数据，或声明同工具同参数的binding以便刷新（宿主复用首次结果）。可先按已知契约设计加载、空结果和详情布局；取数失败不妨碍布局，但不得把占位内容当真实结论；只向模型返回摘要和样本，完整数据由宿主保留。需要更多样本用dataset_read。输出前可调用plan_cards规划1–3张互补卡（简单任务一张即可）及当前卡最多两个后续意图；只提交标题、任务、意图，不写正文。本轮随后只输出第一张card，宿主按计划逐张生成其余卡。不要在一个DSL里输出多张card。长集合优先collection，首屏少量候选→选择→详情；无图片时用结构化关键值，不伪造图片。后续意图由宿主提供按钮，不再重复同名GLM绑定。` 
export function createGenerationTools({catalog=[],invoke,analyze,budget,initialRecords=[],renderMode='native',enabled=true,allowDeck=true,goal,allowPlanning=goal===undefined?true:planningPolicy(goal,{enabled,allowDeck}).allowPlanning}){
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
   tool('cli_discover','发现当前可读工具（按领域、站点、用途检索）',{query:{type:'string',maxLength:120}},['query']),
   tool('cli_describe','读取已注册工具的真实输入和输出契约',{id:{type:'string'}},['id']),
   tool('cli_read','执行已声明且可用的只读工具；参数必须来自契约',{id:{type:'string'},input:{type:'object',additionalProperties:true}},['id','input']),
   tool('dataset_read','查看已取得数据的另一段样本，最多8项',{dataset:{type:'string'},offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:8}},['dataset']),
   ...(adaptive?[
    tool('workflow_run','批量只读取数：1–6步，浏览器串行；after依赖失败则跳过；每一步仍计真实读取预算',{steps:{type:'array',maxItems:6,items:{type:'object',properties:{id:{type:'string'},tool:{type:'string'},input:{type:'object',additionalProperties:true},after:{type:'array',items:{type:'string'}}},required:['id','tool','input'],additionalProperties:false}}},['steps']),
    tool('dataset_aggregate','按真实字段统计已取得记录，宿主计数并返回原记录ID；可按日期分组',{dataset:{type:'string'},groupBy:{type:'string'},timeField:{type:'string'}},['dataset','groupBy']),
    ...(analyze?[tool('dataset_analyze','必要时分类原记录（至多40项），一次共享预算模型调用，标签必须引用原文。返回analysisLabel/analysisQuote；之后aggregate计数。非总体民意统计。',{dataset:{type:'string'},instruction:{type:'string',maxLength:600}},['dataset','instruction'])]:[])
   ]:[])]:[])].filter(t=>t.function.name!=='plan_cards'||allowPlanning&&!locked&&!planningAttempted)
 function summary(r,offset=0,limit=4){
  const value=r.value,items=Array.isArray(value.items)?value.items:[],sample=items.slice(offset,offset+limit)
  const result={dataset:r.id,path:`context.datasets.${r.id}`,...(adaptive?{descriptor:datasetDescriptor(r)}:{}),tool:r.tool,input:r.input,source:value.source,fetchedAt:value.fetchedAt||r.updatedAt,coverage:value.coverage,truncated:value.truncated,totalObserved:items.length,sampleCount:sample.length,sampleOffset:offset,fields:[...new Set(items.slice(0,20).flatMap(Object.keys))],items:sample.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,typeof v==='string'?v.slice(0,500):v]))),...(!Array.isArray(value.items)?{value}:{}),sampleOnly:sample.length<items.length,instruction:'totalObserved为宿主已保存数量；items仅是模型样本，页面引用path.items取得完整结果。来源是否完整由coverage/truncated决定。'}
  if(adaptive){
   while(result.items.length&&JSON.stringify(result).length>5000)result.items.pop()
   if(JSON.stringify(result).length>5000){delete result.value;result.input={omitted:true};result.fields=result.fields.slice(0,40);if(result.descriptor)result.descriptor.fields=result.descriptor.fields.slice(0,40)}
   result.sampleCount=result.items.length;result.sampleOnly=result.items.length<items.length
  }
  return result
 }
 function contextSummary(){let remaining=16000;return records.map(r=>{let s=summary(r);if(adaptive&&JSON.stringify(s).length>remaining)s={dataset:r.id,path:`context.datasets.${r.id}`,totalObserved:r.value?.items?.length||0,sampleOnly:true};remaining-=JSON.stringify(s).length;return s})}

 function save(tool,input,value){
  const length=JSON.stringify(value).length;if(bytes+length>256000)throw Error('结果超过会话数据预算，请缩小查询范围');bytes+=length
  const r={id:'D'+(records.length+1),tool,input,value,updatedAt:new Date().toISOString()};records.push(r);return r
 }
 async function execute(name,input,signal){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('tool input must be object')
  if(name==='capability_find')return findCapabilities(input.query,{catalog:enabled?catalog:[],renderMode})
  if(name==='component_describe'){
   if(!Array.isArray(input.names)||!input.names.length||input.names.length>6||input.names.some(n=>typeof n!=='string'||!Object.hasOwn(REGISTRY,n)))throw Error('unknown component')
   return {contract:registryReference({names:input.names})}
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
  if(name==='cli_discover'){
   const words=String(input.query||'').toLowerCase().split(/\s+/);return {tools:readable.map(t=>({id:t.id,description:t.description,score:words.reduce((s,w)=>s+Number((t.id+' '+t.description+' '+t.group).toLowerCase().includes(w)),0)})).filter(t=>t.score).sort((a,b)=>b.score-a.score).slice(0,12).map(({score,...t})=>t)}
  }
  if(name==='dataset_read'){const r=records.find(r=>r.id===input.dataset);if(!r)throw Error('未知dataset');if(!Number.isInteger(input.offset??0)||(input.offset??0)<0||!Number.isInteger(input.limit??4)||(input.limit??4)<1||(input.limit??4)>8)throw Error('invalid dataset range');return summary(r,input.offset??0,input.limit??4)}
  const t=name==='cli_describe'?catalog.find(t=>t.id===input.id&&t.available&&!t.unsupportedReason):allowed.get(input.id);if(!t)throw Error('工具不存在、不可用或不允许生成期间调用')
  if(name==='cli_describe')return {id:t.id,input:TOOLS[t.id].inputSchema,output:TOOLS[t.id].outputSchema,columns:t.columns,fieldSemantics:t.fieldSemantics}
  if(name!=='cli_read')throw Error('unknown generation tool')
  validateToolInput(t.id,input.input)
  if(blockedReads.has(t.id))throw blockedReads.get(t.id)
  const key=t.id+canonicalInput(input.input);if(seen.has(key))return summary(seen.get(key))
  if(budget)budget.read();else if(reads>=6)throw Error('生成前读取已达到6次预算');reads++
  let result
  try{result=await invoke({tool:t.id,input:input.input,target:'binding',cause:'generation',requestId:randomUUID(),pageId:'generation',sessionId:'generation'},signal)}catch(e){
   if(['AUTH_REQUIRED','ACCESS_RESTRICTED','RATE_LIMITED','SCHEMA_MISMATCH'].includes(e.errorInfo?.code||e.code))blockedReads.set(t.id,e)
   throw e
  }
  signal?.throwIfAborted();validateJson(result.value,TOOLS[t.id].outputSchema)
  const r=save(t.id,input.input,result.value);seen.set(key,r);return summary(r)
 }
 return {tools,execute,planningRequest:()=>goal!==undefined&&allowPlanning&&!locked&&!planningAttempted?{goal,temperature:PLAN_TEMPERATURE,prompt:PLAN_DESIGN+'\n'+PLAN_CAPABILITIES+'\n'+sandboxInstruction(renderMode),tool:tools().find(t=>t.function.name==='plan_cards')}:null,finishPlanning:()=>{planningAttempted=true},prompt:(enabled?GENERATION_TOOL_PROMPT.split('输出前可调用plan_cards')[0]:'')+(allowPlanning?GENERATION_TOOL_PROMPT.slice(GENERATION_TOOL_PROMPT.indexOf('输出前可调用plan_cards')):'本次直接完成单卡，不调用plan_cards；仍可按真实任务声明用户触发的glm.generate后续，不为凑数添加入口。'),records:()=>structuredClone(records),datasets:()=>Object.fromEntries(records.map(r=>[r.id,r.value])),plan:()=>plan&&structuredClone(plan),lockPlan:()=>{locked=true},context:contextSummary,snapshot:()=>({reads,datasetCount:records.length,plan})}
}
