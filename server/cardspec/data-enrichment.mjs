// Field-driven reads, never title matching or guessed identifiers. The caller
// owns authorization, cancellation, caching and the shared physical-read budget.
export const present = value => value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0)
export function fieldCoverage(items, fields) {
 return Object.fromEntries(fields.map(field => [field, {known:items.filter(row=>present(row[field])).length,total:items.length}]))
}
export function plannedDataNeeds(plan,records=[]){
 const requests=[...(plan.dataNeeds||[]),...(plan.modules||[]).flatMap(m=>m.dataNeeds||[])]
 if(requests.length>12)throw Error('too many data requirement groups')
 const grouped=new Map()
 for(const request of requests){
  if(typeof request.dataset!=='string'||!Array.isArray(request.fields)||request.fields.length>30||request.fields.some(f=>typeof f!=='string'||!/^\w{1,64}$/.test(f)))throw Error('invalid data need')
  const prior=grouped.get(request.dataset)||{dataset:request.dataset,fields:[],limit:0}
  prior.fields=[...new Set([...prior.fields,...request.fields])]
  prior.limit=Math.min(5,Math.max(prior.limit,request.limit??3));grouped.set(request.dataset,prior)
 }
 const needs=[...grouped.values()].map(need=>{const rows=records.find(r=>r.id===need.dataset)?.value?.items||[];return {...need,fields:need.fields.filter(field=>!rows.length||rows.some(row=>!present(row[field]))).slice(0,8)}}).filter(n=>n.fields.length)
 if(needs.length>2)throw Error('at most two data sources need enrichment')
 return needs
}

// Resolve a common planning confusion (tool ID versus returned dataset ID)
// through registered contracts. Never guess required arguments or entity IDs.
export async function resolveBuildDataNeeds(plan,{records,execute,tools,validateInput,signal}){
 const raw=[...(plan.dataNeeds||[]),...(plan.modules||[]).flatMap(m=>m.dataNeeds||[])],diagnostics=[],resolved=[]
 if(raw.length>12)throw Error('too many data requirement groups')
 let bootstrapped=0
 for(const need of raw){
  signal?.throwIfAborted()
  const tool=tools[need.dataset]
  if(!tool||tool.readOnly===false||tool.provider==='host'||records().some(r=>r.id===need.dataset||r.tool===need.dataset)||tool.inputSchema?.required?.length)continue
  if(bootstrapped>=2)continue
  const input=tool.inputSchema?.properties?.limit?{limit:Math.min(3,tool.inputSchema.properties.limit.maximum||3)}:{}
  try{validateInput(need.dataset,input);bootstrapped++;await execute('cli_read',{id:need.dataset,input},signal)}
  catch(e){signal?.throwIfAborted();diagnostics.push({dataset:need.dataset,error:e.message})}
 }
 for(const need of raw){
  const exact=records().find(r=>r.id===need.dataset)
  const candidates=exact?[exact]:records().filter(r=>r.tool===need.dataset||tools[r.tool]?.detail?.tool===need.dataset)
  // Prefer the parent collection over standalone detail responses.
  const parents=candidates.filter(r=>tools[r.tool]?.detail?.tool===need.dataset),matches=parents.length?parents:candidates
  if(matches.length!==1){diagnostics.push({dataset:need.dataset,error:matches.length?'ambiguous dataset; explicit dataset ID required':'no verified dataset or required arguments; not fetched'});continue}
  resolved.push({...need,dataset:matches[0].id})
 }
 return {needs:plannedDataNeeds({dataNeeds:resolved},records()),diagnostics}
}
export async function enrichDataset(record, {fields,limit=5}, {link,read,signal}) {
 if(!Array.isArray(fields)||!fields.length||fields.length>8||fields.some(f=>typeof f!=='string'||!/^\w{1,64}$/.test(f)||['constructor','prototype','__proto__'].includes(f)))throw Error('fields must name 1–8 actual result fields')
 if(!Number.isInteger(limit)||limit<1||limit>5)throw Error('enrichment limit must be 1–5')
 const items=record.value.items||[], before=fieldCoverage(items,fields), rows=items.map(row=>({...row})), outcomes=[]
 let attempted=0
 for(const row of rows){
  signal?.throwIfAborted()
  const missing=fields.filter(f=>!present(row[f]))
  if(!missing.length)continue
  if(link?.fields&&!missing.some(field=>link.fields.includes(field))){outcomes.push({id:row[link.key||'id']??null,status:'unsupported_fields',missing});continue}
  if(!link||!present(row[link.key||'id'])){outcomes.push({id:row.id??null,status:'unavailable',missing});continue}
  if(attempted>=limit){outcomes.push({id:row[link.key||'id'],status:'deferred',missing});continue}
  const id=row[link.key||'id'], input={...link.input,[link.parameter||'id']:id}
  if(link.typeField){if(!link.types.includes(row[link.typeField])){outcomes.push({id,status:'unsupported_type',missing});continue}input.type=row[link.typeField]}
  attempted++
  try{
   const detail=await read(link.tool,input,signal)
   signal?.throwIfAborted()
   const match=detail.items?.find(item=>String(item[link.resultKey||'id'])===String(id))
   if(!match)throw Error('detail identity mismatch; no fields merged')
   // Add missing information only. Preserve stable list IDs, poster assets,
   // selection identity and existing nonempty facts from the original source.
   for(const [field,value] of Object.entries(match))if(!['__proto__','constructor','prototype'].includes(field)&&!present(row[field])&&present(value))row[field]=value
   outcomes.push({id,status:'read',tool:link.tool,input,fetchedAt:detail.fetchedAt,missing:fields.filter(f=>!present(row[f]))})
  }catch(e){signal?.throwIfAborted();outcomes.push({id,status:'failed',error:String(e.message).slice(0,240),missing});if(['GENERATION_BUDGET','AUTH_REQUIRED','ACCESS_RESTRICTED','RATE_LIMITED'].includes(e.code||e.errorInfo?.code))break}
 }
 return {value:{...record.value,items:rows},report:{fields,before,after:fieldCoverage(rows,fields),attempted,outcomes,complete:rows.every(row=>fields.every(field=>present(row[field])))}}
}
