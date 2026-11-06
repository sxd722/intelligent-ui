// Host-owned, serializable task operations. No execution, fuzzy matching or LLM.
import {projectToolRows,slotContract,formatSlot} from './tool-slots.mjs'
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v
export const taskStamp=v=>JSON.stringify(canonical(v))
const bad=m=>{throw Error('TASK_CONTRACT: '+m)}
const own=(v,k)=>Object.hasOwn(v,k)
const scalar=v=>v!==null&&['string','number','boolean'].includes(typeof v)
export function validateTask(task={}){
 if(!task||typeof task!=='object'||Array.isArray(task))bad('task must be an object')
 for(const k of Object.keys(task))if(!['where','selection','max','pin','compare','groupBy','aggregate'].includes(k))bad('unknown task option '+k)
 if(task.selection!==undefined&&!['single','multiple'].includes(task.selection))bad('selection must be single or multiple')
 if(task.max!==undefined&&(!Number.isInteger(task.max)||task.max<1||task.max>20))bad('max must be 1–20')
 if(task.pin!==undefined&&(typeof task.pin!=='string'||!task.pin.trim()||task.pin.length>40))bad('pin needs a short role label')
 if(task.pin&&task.selection==='multiple')bad('pin uses single selection')
 if(task.compare&&(task.pin||task.selection==='single'))bad('compare needs multiple selection; pin is only for an explicitly fixed single result')
 if(task.compare!==undefined&&typeof task.compare!=='boolean')bad('compare must be boolean')
 if(task.where!==undefined&&(!Array.isArray(task.where)||task.where.length>6))bad('where needs at most six constraints')
 for(const c of task.where||[]){
  if(!c||typeof c.field!=='string'||!c.field||c.field.length>64)bad('constraint needs a field')
  if(Object.keys(c).some(k=>!['field','op','value','unit'].includes(k)))bad('unknown constraint property')
  if(!['eq','in','lte','gte'].includes(c.op))bad('op must be eq/in/lte/gte')
  if(c.op==='in'?(!Array.isArray(c.value)||!c.value.length||c.value.length>30||c.value.some(x=>!scalar(x))):!scalar(c.value))bad('invalid constraint value')
  if(c.unit!==undefined&&typeof c.unit!=='string')bad('unit must be string')
 }
 if(task.groupBy!==undefined&&(typeof task.groupBy!=='string'||!task.groupBy))bad('groupBy must be a field')
 if(task.aggregate!==undefined){const a=task.aggregate;if(!a||!['count','sum','min','max'].includes(a.op)||Object.keys(a).some(k=>!['op','field'].includes(k))||a.op!=='count'&&typeof a.field!=='string')bad('aggregate needs count or numeric sum/min/max + field')}
 return task
}
function comparable(value,type){
 if(type==='tags')return Array.isArray(value)&&value.every(x=>typeof x==='string')?value:typeof value==='string'?value:null
 if(type==='number')return typeof value==='number'&&Number.isFinite(value)?value:null
 if(type==='date')return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value?value:null
 if(type==='datetime')return typeof value==='string'&&/(Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(Date.parse(value))?Date.parse(value):null
 return scalar(value)?value:null
}
export function validateTaskFields(task,contract){
 validateTask(task);if(!contract)bad('no audited field mapping')
 const fields=new Map(contract.fields.map(f=>[f.key,f]))
 for(const c of task.where||[]){const f=fields.get(c.field);if(!f)bad('unknown field '+c.field)
  if(c.unit!==undefined&&c.unit!==(f.unit||''))bad('unit mismatch for '+c.field)
  if(['lte','gte'].includes(c.op)&&!['number','date','datetime'].includes(f.type))bad('range needs a typed numeric/date field: '+c.field)
  for(const v of c.op==='in'?c.value:[c.value])if(comparable(v,f.type)===null)bad('invalid typed constraint '+c.field)
 }
 if(task.groupBy&&!fields.has(task.groupBy))bad('unknown group field '+task.groupBy)
 if(task.aggregate&&task.aggregate.op!=='count'&&fields.get(task.aggregate.field)?.type!=='number')bad('aggregate needs a numeric field')
 return fields
}
export function taskDataset(tool,value,{input={},task={},contract=slotContract(tool)}={}){
 const fields=validateTaskFields(task,contract),projection=projectToolRows(tool,value?.items,contract)
 if(!projection.ok)bad(projection.code)
 const contextKey=taskStamp({tool,input}),constraintKey=taskStamp(task.where||[])
 const items=projection.items.map(item=>({...item,key:taskStamp([contextKey,item.viewKey]),values:Object.fromEntries(item.$display.fields.map(f=>[f.key,f.status==='present'?comparable(f.value,f.type):null])),input,tool}))
 const matches=item=>(task.where||[]).every(c=>{const v=item.values[c.field];if(v==null)return false;const f=fields.get(c.field),target=comparable(c.value,f.type);return f.type==='tags'&&Array.isArray(v)?(c.op==='eq'?v.includes(c.value):c.op==='in'&&c.value.some(x=>v.includes(x))):c.op==='in'?c.value.some(x=>v===comparable(x,f.type)):c.op==='eq'?v===target:c.op==='lte'?v<=target:v>=target})
 const eligible=items.filter(matches),unknown=items.filter(item=>(task.where||[]).some(c=>item.values[c.field]==null))
 const columns=contract.fields.map(f=>({key:f.key,label:f.label,type:f.type,unit:f.unit||''}))
 return {tool,input,contextKey,constraintKey,items,eligible,unknown,columns,records:projection.records,partial:!!value?.truncated||value?.coverage?.complete===false,source:value?.source,updatedAt:value?.fetchedAt,diagnostics:projection.diagnostics}
}
export function taskSelection(dataset,saved={},task={}){
 const same=saved.contextKey===dataset.contextKey&&saved.constraintKey===dataset.constraintKey
 // Bind selection to current verified rows; stale and newly ineligible choices
 // cannot silently retain old prices or a different date/source.
 const keys=same&&Array.isArray(saved.keys)?saved.keys:[],limit=task.pin||!(task.selection==='multiple'||task.compare)?1:task.max||2
 return {contextKey:dataset.contextKey,constraintKey:dataset.constraintKey,keys:[...new Set(keys)].filter(k=>dataset.eligible.some(r=>r.key===k)).slice(0,limit)}
}
export function toggleTaskSelection(dataset,saved,key,task={}){
 const selection=taskSelection(dataset,saved,task),keys=selection.keys
 if(!dataset.eligible.some(r=>r.key===key))bad('selection is stale or outside constraints')
 if(keys.includes(key))return {...selection,keys:keys.filter(k=>k!==key)}
 if(task.pin||!(task.selection==='multiple'||task.compare))return {...selection,keys:[key]}
 if(keys.length>=(task.max||2))bad('selection limit reached')
 return {...selection,keys:[...keys,key]}
}
export function taskComparison(dataset,selection){
 const rows=selection.keys.map(k=>dataset.eligible.find(r=>r.key===k)).filter(Boolean)
 return {items:rows,fields:dataset.columns.map(c=>({...c,values:rows.map(r=>formatSlot(r.$display.fields.find(f=>f.key===c.key)))}))}
}
export function taskAggregate(dataset,task={}){
 if(!task.groupBy&&!task.aggregate)return null
 const a=task.aggregate||{op:'count'},groups=new Map();let unknown=0
 for(const row of dataset.eligible){const group=task.groupBy?row.values[task.groupBy]:'全部';if(group==null){unknown++;continue}
  if(!groups.has(group))groups.set(group,[]);groups.get(group).push(row)
 }
 return {scope:'observed-sample',total:dataset.eligible.length,unknown,partial:dataset.partial,groups:[...groups].map(([label,rows])=>{const numbers=rows.map(r=>r.values[a.field]).filter(Number.isFinite);return {label:String(label),count:rows.length,value:a.op==='count'?rows.length:!numbers.length?null:a.op==='sum'?numbers.reduce((s,x)=>s+x,0):a.op==='min'?Math.min(...numbers):Math.max(...numbers),known:a.op==='count'?rows.length:numbers.length,recordKeys:rows.map(r=>r.key)}})}
}
export function taskConstraintLabels(task,columns){return (task.where||[]).map(c=>`${columns.find(f=>f.key===c.field)?.label||c.field} ${({eq:'=',in:'属于',lte:'≤',gte:'≥'})[c.op]} ${Array.isArray(c.value)?c.value.join(' / '):c.value}${columns.find(f=>f.key===c.field)?.unit||''}`)}
