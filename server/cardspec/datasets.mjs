import {createHash} from 'node:crypto'
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0,16)
const rowId=(row,index)=>String(row.rowKey??row.id??`row-${index}`)
// Full values remain host-owned. Metadata never implies that a sample is the population.
export function datasetDescriptor(record){
 const rows=Array.isArray(record.value?.items)?record.value.items:[],fields=[...new Set(rows.flatMap(Object.keys))]
 return {id:record.id,version:hash(record.value),tool:record.tool,fields,count:rows.length,
  coverage:record.value?.coverage??{complete:record.value?.truncated===false?null:false},
  fetchedAt:record.value?.fetchedAt||record.updatedAt,source:record.value?.source||record.tool}
}
export function datasetAggregate(record,{groupBy,timeField}={}){
 const rows=record.value?.items
 if(!Array.isArray(rows))throw Error('dataset aggregate requires items')
 if(typeof groupBy!=='string'||!groupBy||groupBy.length>80)throw Error('groupBy must be an existing field')
 if(rows.length&&!rows.some(r=>Object.hasOwn(r,groupBy)))throw Error('unknown group field')
 const groups=new Map()
 rows.forEach((row,i)=>{
  const value=row[groupBy];if(value!==null&&typeof value==='object')throw Error('group field must be scalar')
  const label=value==null?'未知':String(value).slice(0,100)
  const raw=timeField?row[timeField]:null
  // Require explicit date/time; do not guess epochs or relative dates.
  const date=timeField?(typeof raw==='string'&&/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(raw)?raw.slice(0,10):'日期未知'):''
  const key=JSON.stringify([date,label])
  if(!groups.has(key))groups.set(key,{id:hash(key),label:date||label,...(date?{series:label}:{}),group:label,date,value:0,recordIds:[]})
  const group=groups.get(key);group.value++;group.recordIds.push(rowId(row,i))
 })
 return {items:[...groups.values()].sort((a,b)=>a.date.localeCompare(b.date)),dataset:datasetDescriptor(record),method:'count observed records',totalObserved:rows.length}
}
// Analysis annotations are joined to originals, never allowed to replace titles, URLs or counts.
export function validateAnnotations(record,output){
 const rows=record.value?.items||[],byId=new Map(rows.map((r,i)=>[rowId(r,i),r])),seen=new Set()
 if(byId.size!==rows.length)throw Error('analysis requires unique record IDs')
 if(!output||!Array.isArray(output.annotations)||output.annotations.length>40)throw Error('annotations must contain at most 40 records')
 return output.annotations.map(a=>{
  if(!a||typeof a.id!=='string'||!byId.has(a.id)||seen.has(a.id))throw Error('analysis references unknown or duplicate record')
  seen.add(a.id)
  if(typeof a.label!=='string'||!a.label.trim()||a.label.length>40||typeof a.quote!=='string'||!a.quote.trim()||a.quote.length>240)throw Error('analysis label and exact quote required')
  const row=byId.get(a.id)
  if(!Object.values(row).some(v=>typeof v==='string'&&v.includes(a.quote)))throw Error('analysis quote is not present in source record')
  return {id:a.id,label:a.label,quote:a.quote}
 })
}
export function analysisInput(record){
 const priority=['evidenceKind','title','text','content','body','comment','description','source','date','createdAt'],sample=[];let remaining=12000
 for(const [i,r] of (record.value?.items||[]).slice(0,40).entries()){
  const value={id:rowId(r,i)};let rowBudget=900-JSON.stringify(value).length
  const fields=Object.entries(r).filter(([k,v])=>k!=='id'&&k!=='rowKey'&&typeof v!=='object').sort(([a],[b])=>(priority.includes(a)?priority.indexOf(a):99)-(priority.includes(b)?priority.indexOf(b):99))
  for(const [k,v]of fields.slice(0,12)){if(rowBudget<k.length+30)break;const clipped=typeof v==='string'?v.slice(0,Math.min(400,rowBudget-k.length-10)):v;value[k]=clipped;rowBudget-=JSON.stringify({[k]:clipped}).length}
  const size=JSON.stringify(value).length;if(size>remaining)break;remaining-=size;sample.push(value)
 }
 return sample
}
