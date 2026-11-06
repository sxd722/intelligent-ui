import {compileCard} from '../../shared/cardspec/compiler.mjs'
import {expressionReads,referencePaths,expressionPath} from '../../shared/cardspec/dataflow.mjs'
import {CONTRACTS} from '../../shared/cardspec/contracts.mjs'
import {evaluate} from '../../shared/cardspec/expression.mjs'
import {createStore,makeScope} from '../../shared/cardspec/store.mjs'
import {toolResultDiagnostics} from '../../shared/cardspec/tool-result-diagnostics.mjs'

// Structural defects, not a heuristic definition of a good business app.
// Empty *mutable* lists and legitimate empty responses are allowed. A visible
// consumer of a permanently empty collection/false guard has no recovery path.
export function buildDataflowDiagnostics(source,{context={},records=[]}={}) {
 const result=compileCard(source,{final:true,context}),spec=result.spec
 if(!spec||result.diagnostics.some(d=>d.severity==='error'))return []
 const writes=new Set(),issues=result.diagnostics.filter(d=>['view_navigation_redundant','view_navigation_duplicate'].includes(d.code)).map(d=>({...d,severity:'error'}))
 const scope=makeScope(spec,createStore())
 const closed=ast=>{try{return evaluate(ast,scope)===false}catch{return false}}
 const walkSteps=steps=>{for(const step of steps||[]){if(step.target&&step.type!=='invoke')writes.add(step.target);walkSteps(step.then);walkSteps(step.else)}}
 Object.values(spec.actions||{}).forEach(walkSteps)
 const domains=new Map(Object.entries(spec.state).filter(([,v])=>v.initial?.type==='literal'&&(v.initial.value===null||['string','boolean','number'].includes(typeof v.initial.value))).map(([id,v])=>[id,new Set([v.initial.value])]))
 const unknown=new Set()
 const scan=steps=>{for(const step of steps||[]){
  if(step.target){if(step.type==='set'&&!step.key&&step.value?.type==='literal'&&domains.has(step.target)&&!unknown.has(step.target)){domains.get(step.target).add(step.value.value);if(domains.get(step.target).size>8)unknown.add(step.target)}else unknown.add(step.target)}
  scan(step.then);scan(step.else)
 }};Object.values(spec.actions||{}).forEach(scan);unknown.forEach(id=>domains.delete(id))
 const finiteFalse=ast=>{
  const paths=referencePaths(ast),ids=[...new Set(paths.map(p=>p[1]))]
  if(!ids.length||ids.length>4||paths.some(p=>p[0]!=='state'||p.length!==2||!domains.has(p[1]))||ids.reduce((n,id)=>n*domains.get(id).size,1)>64)return false
  const visit=(i,values)=>{if(i===ids.length){try{return evaluate(ast,{...scope,state:{...scope.state,...values}})===false}catch{return false}}
   return [...domains.get(ids[i])].every(value=>visit(i+1,{...values,[ids[i]]:value}))}
  return visit(0,{})
 }
 // Logic modules may update state through validated patches; conservatively
 // defer their liveness to runtime tests rather than declaring them immutable.
 const hasLogic=Object.keys(spec.logic||{}).length>0
 const empty=ast=>ast?.type==='array'&&!ast.items.length||ast?.type==='literal'&&Array.isArray(ast.value)&&!ast.value.length
 const immutableStateOnly=ast=>{
  const paths=referencePaths(ast)
  return paths.length>0&&paths.every(p=>p[0]==='state'&&p.length===2&&!writes.has(p[1]))
 }
 const push=(node,code,message)=>issues.push({severity:'error',code,message,offset:result.locations?.[node.id]||0})
 const walk=(nodes,local=false)=>{for(const n of nodes||[]){
  const insideLogic=local||n.type==='logic'
  if(!insideLogic)for(const [eventName,fields] of Object.entries(CONTRACTS[n.type]?.events||{})){
   const actionId=n.props?.[eventName]?.value,steps=spec.actions?.[actionId]
   for(const step of steps||[]){
    const path=expressionPath(step.value)
    if(!step.when&&path?.length===2&&path[0]==='args'&&!n.props?.args)push(n,'build_action_args_missing',`${n.type}.${eventName} invokes ${actionId} without args, but it directly assigns args.${path[1]} to ${step.target}. Pass the required args or read the control event.`)
    if(!step.when&&path?.length===2&&path[0]==='event'&&path[1]!=='args'&&!Object.hasOwn(fields,path[1]))push(n,'build_event_field_missing',`${n.type}.${eventName} does not provide event.${path[1]}, but action ${actionId} directly assigns it to ${step.target}. Pass explicit args and read args, or use the correct event for this control.`)
   }
  }
  const input=['each','list','collection','carousel','table','chart','grid','mindmap','flowchart'].includes(n.type)?n.props?.items||n.props?.data||n.props?.nodes:undefined
  if(input&&!hasLogic&&immutableStateOnly(input))for(const id of expressionReads(spec,input,'state'))if(empty(spec.state[id]?.initial)&&!writes.has(id))push(n,'build_data_source_missing',`state.${id} feeds ${n.type} but stays empty: no action can populate it. Connect a binding/context dataset or a real producer; do not just change the empty-state text.`)
  if(n.type==='if'&&!hasLogic&&immutableStateOnly(n.props?.test)&&closed(n.props?.test))for(const id of expressionReads(spec,n.props?.test,'state'))if(spec.state[id]?.initial?.type==='literal'&&spec.state[id].initial.value===false&&!writes.has(id))push(n,'build_guard_unreachable',`state.${id} is permanently false and gates content. Connect its producer or derive readiness from the real data status.`)
  if(n.type==='if'&&!hasLogic&&finiteFalse(n.props?.test)&&!issues.some(d=>d.code==='build_guard_unreachable'&&d.offset===(result.locations?.[n.id]||0)))push(n,'build_guard_unreachable','This view condition cannot be true for any initial or assigned state value. Connect a real producer or remove the artificial loading gate for already-prefetched data; changing the loading label is not a fix.')
  walk(n.children,insideLogic)
 }};walk(spec.children)
 for(const d of toolResultDiagnostics(spec,records))if(d.code==='tool_result_unconsumed')issues.push({...d,severity:'error'})
 // Captured data is available to the compiler through context, not copied rows.
 const paths=referencePaths([spec.children,spec.actions,spec.data,spec.derived,spec.bindings])
 for(const record of records.filter(r=>r.enrichment)){
  // A fresh call to the original list tool does not include enriched fields.
  // A binding seeded from this dataset still contains the explicit context path.
  const consumed=paths.some(p=>p[0]==='context'&&p[1]==='datasets'&&(p.length===2||p[2]===record.id))
  if(!consumed)issues.push({severity:'error',code:'build_enrichment_unused',message:`Required fields were fetched into context.datasets.${record.id}, but the card does not consume that dataset. Reference its full items for filtering/details/comparison; do not transcribe sampled rows or build another empty loading path.`})
 }
 for(const p of paths)if(p[0]==='context'&&p[1]==='datasets'&&p[2]&&!Object.hasOwn(context.datasets||{},p[2]))issues.push({severity:'error',code:'build_dataset_missing',message:`context.datasets.${p[2]} was not returned by a tool; read a real dataset or use a declared binding.`})
 return [...new Map(issues.map(d=>[d.code+':'+d.message,d])).values()].slice(0,5)
}
