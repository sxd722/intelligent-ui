export function canonicalInput(value){return JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)}

// Earlier generation research used an internal function name and dataset ID.
// Resolve only this known alias, only when its immutable source records still
// match the annotated result. No inference from titles or similar instructions.
export function prefetchedInvocation(record,records=[]){
 if(record.tool!=='dataset_analyze')return record
 const source=records.find(r=>r.id===record.input?.dataset)
 if(!Array.isArray(source?.value?.items)||typeof record.input?.instruction!=='string'||record.value?.analysis?.dataset?.id!==source.id)return null
 const strip=items=>items.map(({analysisLabel,analysisQuote,...row})=>row)
 if(!Array.isArray(record.value?.items)||canonicalInput(strip(record.value.items))!==canonicalInput(strip(source.value.items)))return null
 return {tool:'dataset.analyze',input:{items:source.value.items,instruction:record.input.instruction}}
}

// A prefetched dataset and its matching refresh binding are the same query.
// Project committed values into scopes, without mutating the generated spec or
// confusing an in-flight query's input with the last successful value's input.
export function liveDatasetContext(spec,bindings={}){
 const context=spec.context||{},datasets={...context.datasets};let changed=false
 const latestFor=invocation=>{
  let latest=null
  for(const [id,b] of Object.entries(bindings)){
   if(spec.bindings?.[id]?.tool!==invocation.tool||!b.updatedAt)continue
   let inputKey=b.valueInputKey
   if(!inputKey&&b.status==='success'&&b.inputKey)try{inputKey=canonicalInput(JSON.parse(b.inputKey))}catch{}
   if(inputKey!==canonicalInput(invocation.input))continue
   if(!latest||Date.parse(b.updatedAt)>=Date.parse(latest.updatedAt))latest=b
  }
  return latest
 }
 for(const record of spec.prefetched||[]){
  if(!record.id||!Object.hasOwn(datasets,record.id))continue
  const invocation=prefetchedInvocation(record,spec.prefetched);if(!invocation)continue
  const latest=latestFor(invocation)
  if(latest){datasets[record.id]=latest.value;changed=true}
 }
 // An annotation belongs to the exact input snapshot, not merely its row IDs.
 // Resolve raw datasets first so record ordering cannot keep stale annotations
 // alive. Only explicit, verified provenance participates; never infer lineage
 // from similar titles, queries or IDs. Original artifacts remain immutable.
 for(const record of spec.prefetched||[]){
  const invocation=prefetchedInvocation(record,spec.prefetched)
  if(invocation?.tool!=='dataset.analyze'||!Object.hasOwn(datasets,record.id))continue
  const source=(spec.prefetched||[]).find(r=>r.id===record.value?.analysis?.dataset?.id)
  if(!Array.isArray(source?.value?.items)||canonicalInput(invocation.input.items)!==canonicalInput(source.value.items))continue
  const items=datasets[source.id]?.items
  if(!Array.isArray(items)||canonicalInput(items)===canonicalInput(source.value.items))continue
  const latest=latestFor({tool:invocation.tool,input:{...invocation.input,items}})
  datasets[record.id]=latest?latest.value:{...record.value,items:[],analysis:{
   dataset:record.value.analysis.dataset,status:'stale',classified:0,total:0,counts:{},
   scope:'source snapshot changed; annotations require an explicit refresh',
  }}
  changed=true
 }
 return changed?{...context,datasets}:context
}
