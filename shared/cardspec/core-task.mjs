// Intent is small and domain-independent. Tools, schemas and rendering stay host-owned.
export const CORE_TASKS = Object.freeze({
 find:'查找事实或候选', understand:'解释概念/关系', express:'写作、改写与沟通',
 decide:'比较取舍与推荐', plan:'安排路线、时间与资源', monitor:'跟踪变化与舆情',
 record:'记录与回顾', practice:'学习练习与反馈', calculate:'计算与模拟',
 create:'创作或游戏', organize:'整理资料与结构', custom:'其他任务'
})
export const CORE_TASK_SCHEMA={type:'object',additionalProperties:false,required:['tasks'],properties:{tasks:{type:'array',minItems:1,maxItems:3,items:{type:'object',additionalProperties:false,required:['kind','query','domain','data','outcome'],properties:{
 kind:{type:'string',enum:Object.keys(CORE_TASKS)},query:{type:'string',maxLength:160},
 domain:{type:'string',description:'短领域标签，如 gaming / travel / movies / health / learning',maxLength:40},
 data:{type:'string',enum:['none','provided','live']},outcome:{type:'string',maxLength:180},
 terms:{type:'array',maxItems:6,items:{type:'string',maxLength:40}}
}}}}}
export const CORE_TASK_INSTRUCTION=`先提取1–3个核心任务taskIntent：kind为${Object.entries(CORE_TASKS).map(([k,v])=>k+'('+v+')').join('、')}。每项只写query(保留用户实体原名，不混入UI/实现要求)、domain短领域、data(none不需外部数据/provided用户资料/live真实取数)、outcome(操作→可观察结果)，可附terms关键词。不选CLI、不写字段映射/统计结果/代码；宿主据此匹配来源与工具，取数后确定可用呈现。陌生任务可custom，纯写作/计算不强加工具；用户要求的意见采集属于monitor而非游戏创作。`
export function normalizeTaskIntent(input){
 if(!input||Array.isArray(input)||Object.keys(input).some(k=>k!=='tasks')||!Array.isArray(input.tasks)||input.tasks.length<1||input.tasks.length>3)throw Error('taskIntent requires 1–3 tasks')
 const short=(s,n,empty=false)=>typeof s==='string'&&s.length<=n&&(empty||s.trim().length>0)
 return {version:1,tasks:input.tasks.map(t=>{
  if(!t||Object.keys(t).some(k=>!['kind','query','domain','data','outcome','terms'].includes(k))||!Object.hasOwn(CORE_TASKS,t.kind)||!short(t.query,160,true)||!short(t.domain,40)||!short(t.outcome,180)||!['none','provided','live'].includes(t.data)||t.data==='live'&&!t.query.trim()||t.terms!==undefined&&(!Array.isArray(t.terms)||t.terms.length>6||t.terms.some(s=>!short(s,40))))throw Error('Invalid core task: kind/query/domain/data/outcome/terms')
  return {kind:t.kind,query:t.query.trim(),domain:t.domain.trim(),data:t.data,outcome:t.outcome.trim(),terms:[...new Set(t.terms||[])]}
 })}
}
