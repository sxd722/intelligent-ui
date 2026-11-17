import {makeScope,createStore} from './store.mjs'
import {evaluate} from './expression.mjs'
import {canonicalInput,prefetchedInvocation} from './prefetch.mjs'
import {sampleFieldDiagnostics} from './sample-field-diagnostics.mjs'
import {visitExpression,expressionPath} from './dataflow.mjs'
import {TOOLS} from './tools.mjs'

// Real snapshots only, matched by tool AND evaluated input. Compile-time idle
// bindings contain no rows. Hydrate a disposable scope, never run a tool or
// mutate the delivered card. Rebuild scopes between dependency passes.
export function toolFieldDiagnostics(spec,records=[]){
 if(!spec||!records.length)return []
 const bindings={},observedRows=new WeakSet(),store=createStore()
 function mark(value,depth=0){if(depth>8||!value||typeof value!=='object')return;if(Array.isArray(value)){for(const row of value.slice(0,2000)){if(row&&typeof row==='object')observedRows.add(row);mark(row,depth+1)}}else for(const v of Object.values(value))mark(v,depth+1)}
 for(const r of records)mark(r.value)
 const sampled={...spec,prefetched:records}
 for(let pass=0;pass<4;pass++){
  let scope;try{scope=makeScope(sampled,store,{bindings})}catch{return []}
  let changed=false
  for(const [id,b]of Object.entries(spec.bindings||{})){
   if(bindings[id])continue
   let input;try{input=evaluate(b.input,scope)}catch{continue}
   const r=records.findLast(r=>{const inv=prefetchedInvocation(r,records);return r.value!=null&&inv?.tool===b.tool&&canonicalInput(inv.input)===canonicalInput(input)})
   if(r){bindings[id]={value:r.value,status:'success',updatedAt:r.updatedAt||null,valueInputKey:canonicalInput(input)};changed=true}
  }
  if(!changed)break
 }
 try{
  const scope=makeScope(sampled,store,{bindings}),issues=sampleFieldDiagnostics(sampled,scope,{observedRows}),seen=new Set()
  // Inspect response-envelope accesses too: discovery summaries are not fields
  // on binding.value. Coalescing a nonexistent aggregate to zero hides errors.
  const decisionFields=new Set()
  visitExpression([spec.derived,spec.data,spec.children],ast=>{if(ast.type==='call'&&['find','filter','some','every','sum','count','groupCounts'].includes(ast.name))visitExpression(ast.args?.[0],n=>{const p=expressionPath(n);if(p?.length===4&&p[0]==='bindings'&&p[2]==='value')decisionFields.add(p.join('.'))})})
  visitExpression([spec.derived,spec.data,spec.children],ast=>{
   if(ast.type==='call'&&['compose','helper:compose'].includes(ast.name))try{const v=evaluate(ast,scope);if(v.issues?.some(i=>i.code==='CLASSIFICATION_SNAPSHOT_MISMATCH')&&!seen.has('annotation-snapshot')){seen.add('annotation-snapshot');issues.push({severity:'error',code:'tool_classification_snapshot_mismatch',message:'compose annotations do not match any current source record. The classified snapshot and the displayed query differ; reuse its matching raw binding or explicitly analyze the new dataset. Do not copy old counts or force an ID-only join.'})}}catch{}
   const path=expressionPath(ast)
   if(path?.length!==4||path[0]!=='bindings'||path[2]!=='value')return
   const [_,id,,key]=path,b=bindings[id],schema=TOOLS[spec.bindings[id]?.tool]?.outputSchema
   if(!b?.value||Object.hasOwn(b.value,key)||Object.hasOwn(schema?.properties||{},key)||seen.has(id+':envelope:'+key))return
   seen.add(id+':envelope:'+key)
   issues.push({severity:decisionFields.has(path.join('.'))?'error':'warning',code:'tool_response_field_missing',message:`bindings.${id}.value.${key} is absent from the actual response and declared output fields. Discovery summary fields are not response fields; a zero/empty fallback masks missing data. Use actual items or the returned hostView for derived statistics; retain the requested result.`})
  })
  // collection emits its rendered row key, which can differ from the business
  // ID. Prove a mismatch using real rows, rather than aliasing either ID.
  const selections=[]
  function walk(nodes){for(const n of nodes||[]){
   if(n.type==='collection'){
    let rows;try{rows=evaluate(n.props.items,scope)}catch{}
    if(Array.isArray(rows)&&rows.length&&rows.every(r=>r&&typeof r==='object'))for(const step of spec.actions?.[n.props.onSelect?.value]||[]){
     if(step.type==='set'&&!step.key&&expressionPath(step.value)?.join('.')==='event.id')selections.push({state:step.target,rows,node:n.id})
    }
   }
   walk(n.children)
  }}walk(spec.children)
  for(const [id,ast]of Object.entries(spec.derived||{}))visitExpression(ast,n=>{
   if(n.type!=='call'||n.name!=='find')return
   let rows;try{rows=evaluate(n.args[0],scope)}catch{return}
   if(!Array.isArray(rows)||!rows.length)return
   const param=n.params?.[0]||'item'
   visitExpression(n.args[1],p=>{
    if(p.type!=='binary'||!['==','==='].includes(p.op))return
    for(const [left,right]of [[p.left,p.right],[p.right,p.left]]){
     const a=expressionPath(left),b=expressionPath(right)
     if(a?.length!==2||a[0]!==param||a[1]!=='id'||b?.[0]!=='state'||b.length!==2)continue
     const selected=selections.find(s=>s.state===b[1]&&rows.every(r=>s.rows.includes(r)))
     if(!selected||!rows.some(r=>r.rowKey!=null&&String(r.rowKey)!==String(r.id))||seen.has('identity:'+id))continue
     seen.add('identity:'+id);issues.push({severity:'error',code:'tool_selection_identity',message:`${id}: compares business row.id with state.${b[1]}, but ${selected.node}.onSelect writes event.id (the rendered rowKey). These differ in the actual rows, so details cannot resolve. Match row.rowKey, or retain event.item and explicitly read its business id; keep selectedId using the rendered key.`})
    }
   })
  })
  // Source metadata may be constant (platform/city); a stance assigned to every
  // real row is not evidence-backed classification. Unknown is legitimate.
  for(const [id,ast]of Object.entries({...spec.data,...spec.derived}))visitExpression(ast,n=>{
   if(n.type!=='call'||n.name!=='map'||n.args[1]?.type!=='object')return
   let rows;try{rows=evaluate(n.args[0],scope)}catch{return}
   if(!Array.isArray(rows)||!rows.length||!rows.every(r=>observedRows.has(r)))return
   for(const [key,value]of n.args[1].entries||[]){
    if(!/^(?:attitude|stance|sentiment|analysisLabel|态度|立场|情感)$/i.test(key)||value.type!=='literal'||typeof value.value!=='string'||/^(?:|未知|(?:未|待)(?:分类|判定|标注|分析)|不确定|unknown|unclassified|unlabeled|unlabelled|unannotated|uncertain)$/i.test(value.value.trim()))continue
    if(rows.every(r=>r[key]===value.value)||seen.has(id+key))continue
    seen.add(id+key);issues.push({severity:'error',code:'tool_classification_unproven',message:`${id}: maps every real row to ${key}=${JSON.stringify(value.value)} without a returned classification. Platform is metadata, not an attitude. Use dataset_analyze (analysisLabel + source quote) or a dataset.analyze binding triggered by an explicit user action; unclassified records stay unknown, excluded from classified percentages. Keep the requested classification and filtering.`})
   }
  })
  return issues.slice(0,8)
 }catch{return []}
}
