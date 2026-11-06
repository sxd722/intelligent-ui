import {createStore,makeScope} from './store.mjs'
import {evaluate} from './expression.mjs'
import {visitExpression,referencePaths,expressionReads} from './dataflow.mjs'

// Bounded, effect-free evidence checks. These are contradictions we can prove,
// not a model judging its own work, nor a claim to solve arbitrary semantics.
export function contentIntegrity(spec,{records=spec?.prefetched||[],goal=spec?.context?.userGoal||''}={}){
 if(!spec)return []
 const issues=[],seen=new Set(),scope=makeScope(spec,createStore())
 const add=(code,message,severity='error')=>{const k=code+message;if(!seen.has(k)){seen.add(k);issues.push({code,message,severity})}}
 for(const [id,ast]of Object.entries(spec.derived||{}))visitExpression(ast,n=>{
  if(n.type!=='call'||!['filter','count','some','every'].includes(n.name))return
  let rows;try{rows=evaluate(n.args[0],scope)}catch{return}
  if(!Array.isArray(rows)||!rows.length||!rows.every(r=>r&&typeof r==='object'))return
  const param=n.params?.[0]||'item'
  // Only equality predicates assert membership in a category. Optional reads,
  // null checks and missing-value fallbacks remain valid.
  visitExpression(n.args[1],p=>{if(p.type!=='binary'||!['==','==='].includes(p.op))return
   for(const [side,other]of [[p.left,p.right],[p.right,p.left]]){
    const path=referencePaths(side)[0]
    if(path?.length!==2||path[0]!==param||other?.type==='literal'&&other.value==null)return
    if(rows.every(r=>!Object.hasOwn(r,path[1])))add('evidence_missing_category',`${id}: category predicate reads ${path[1]}, absent from all ${rows.length} source rows. Populate evidence-backed classification or keep these rows explicitly unclassified; do not count them as analyzed.`)
   }
  })
 })
 const effects=steps=>(steps||[]).some(s=>s.type==='invoke'||effects(s.steps)||effects(s.then)||effects(s.else))
 const text=nodes=>(nodes||[]).map(n=>n.type==='run'&&n.value?.type==='literal'?n.value.value:text(n.children)).join('')
 const numericInputs=[]
 const collect=nodes=>{for(const n of nodes||[]){if(['input','slider'].includes(n.type)&&(n.type==='slider'||n.props?.inputType?.value==='number')){
  const label=n.props?.label?.value||'',path=referencePaths(n.props?.value)[0]
  if(path?.[0]==='state'&&/预算|年龄|人数|时长|上限|距离|budget|age|duration|limit|distance/i.test(label))numericInputs.push({label,key:path[1]})
 }collect(n.children)}};collect(spec.children)
 const decisionReads=(ast,visited=new Set())=>{
  const reads=new Set()
  visitExpression(ast,n=>{
   if(n.type==='binary'&&n.op!=='+'||n.type==='conditional'||n.type==='call'&&['min','max','clamp','filter','find','sort'].includes(n.name))for(const k of expressionReads(spec,n,'state'))reads.add(k)
   const p=referencePaths(n)[0];if(['derived','data'].includes(p?.[0])&&p.length===2&&!visited.has(p.join('.'))){visited.add(p.join('.'));for(const k of decisionReads(spec[p[0]]?.[p[1]],visited))reads.add(k)}
  });return reads
 }
 const walk=nodes=>{for(const n of nodes||[]){
  const label=String(n.props?.label?.value||text(n.children)).trim(),action=n.props?.onPress?.value
  // Plain presses carry no value/id event; explicit args have their own scope.
  // Do not guess or silently copy object fields into events (ambiguous for
  // callbacks shared with inputs). Give the repair loop a precise contract.
  if(action&&['button','pressable','chip'].includes(n.type)&&n.props?.args){
   const body=spec.actions?.[action],reads=expressionReads(spec,body,'event')
   if(reads.length&&!referencePaths(body).some(p=>p[0]==='args'))add('evidence_click_payload',`${n.id}: plain onPress supplies an empty event, but ${action} reads event.${reads.join('/event.')}. The explicitly passed payload is args (or args.id for an object). Read args instead; do not infer an event payload.`)
  }
  if(action&&/^(?:刷新|重新获取|重试|refresh|retry)$/i.test(label)&&Object.keys(spec.data||{}).length&&/真实|实时|工具|新闻|天气|舆情|real|live|tool/i.test(goal)&&!effects(spec.actions?.[action]))add('evidence_fake_refresh',`${n.id}: “${label}” has no reachable tool effect. Wire a real invoke and consume its result, or label it as a local reset; changing a notice is not refreshing data.`)
  if(action&&/生成.*(?:行程|方案|计划)|规划|generate.*plan/i.test(label)&&!effects(spec.actions?.[action])){
   const decisions=decisionReads(spec.actions?.[action]),missing=numericInputs.filter(i=>!decisions.has(i.key))
   if(missing.length)add('evidence_constraint_unused',`${n.id}: ${missing.map(i=>i.label).join(', ')} never affects a calculation, constraint or branch in this planning action. Interpolating settings into text is not planning. Apply real constraints, or invoke a planning tool with selected entities and settings. Keep missing data explicit.`)
  }
  walk(n.children)
 }};walk(spec.children)
 // A copied source row may not acquire an invented publication date. This only
 // flags exact source identity/title matches, never approximate entity joins.
 const raw=records.flatMap(r=>r.value?.items||[])
 for(const [id,ast]of Object.entries(spec.data||{})){
  let rows;try{rows=evaluate(ast,scope)}catch{continue}
  if(!Array.isArray(rows))continue
  for(const row of rows){if(!row||typeof row!=='object'||!row.title)continue
   const matches=raw.filter(r=>r.title===row.title);if(!matches.length)continue
   const date=row.publishedAt||row.published_at||row.date
   if(typeof date==='string'&&/^\d{4}-\d{2}-\d{2}/.test(date)&&matches.every(r=>!r.publishedAt&&!r.published_at&&!r.date&&!r.time))add('evidence_date_unproven',`${id}: copied source “${String(row.title).slice(0,55)}” has no publication time in the retrieved record. Keep its date unknown or fetch the actual detail; retrieval order is not a date.`)
  }
 }
 // Constraint-sensitive prose cannot be proved by static reference checks.
 // Return a targeted obligation, not a false pass or automatic business rewrite.
 if(/预算|年龄|起点|budget|constraint/i.test(goal)&&/规划|行程|plan/i.test(goal))add('evidence_constraint_check','Verify two materially different constraint values against the plan/route/cost result, not the heading or notice. A fixed template with interpolated settings is not constraint-sensitive planning.','warning')
 return issues.slice(0,8)
}

export function auditClassification({samples,analyzedIds,tally}){
 const classified=samples.filter(r=>analyzedIds.includes(r.id)),allowed=new Set(['positive','negative','neutral','uncertain'])
 const invalid=classified.filter(r=>!allowed.has(r.stance)||!r.evidence?.text||!r.evidence?.source||!r.target)
 const counts=Object.fromEntries([...allowed].map(k=>[k,classified.filter(r=>r.stance===k).length]))
 return {status:invalid.length||Object.keys(counts).some(k=>tally[k]!==counts[k])?'failed':'passed',counts,analyzed:classified.length,unknown:samples.length-classified.length,invalidIds:invalid.map(r=>r.id)}
}
export function auditResultSensitivity({beforeInput,afterInput,beforeResult,afterResult}){
 const changed=JSON.stringify(beforeInput)!==JSON.stringify(afterInput)
 return {status:!changed?'unverified':JSON.stringify(beforeResult)===JSON.stringify(afterResult)?'unverified':'changed',requiresSemanticReview:true}
}
export const INTEGRITY_PROMPT='结果闭环：刷新要真实invoke并显示新结果；规划让设置约束方案而非只拼文案；分类仅统计已读且有分类/依据的记录，未知不算已分析；日期和附近/同实体关系必须来自返回证据。调试断言结果，不以按钮变色或提示变化代替完成。'
