// Result assertions, intentionally independent from the operation reducers.
// Caller supplies original constraints / required roles, not model claims.
export function auditTaskConstraints({rows,constraints=[],fields=[]}){
 const failures=[]
 for(const row of rows)for(const c of constraints){const f=fields.find(f=>f.key===c.field),value=row.values?.[c.field]
  let valid=!!f&&value!=null&&(c.unit===undefined||c.unit===(f.unit||''))&&(f.type!=='number'||typeof value==='number'&&Number.isFinite(value))
  const target=v=>f?.type==='datetime'?typeof v==='string'&&/(Z|[+-]\d\d:\d\d)$/.test(v)?Date.parse(v):NaN:v
  if(valid&&f.type==='datetime')valid=typeof value==='number'&&Number.isFinite(value)
  if(valid&&f.type==='tags'&&Array.isArray(value)){valid=c.op==='eq'?value.includes(c.value):c.op==='in'&&Array.isArray(c.value)&&c.value.some(x=>value.includes(x))}
  else if(valid){if(c.op==='lte')valid=value<=target(c.value);else if(c.op==='gte')valid=value>=target(c.value);else if(c.op==='eq')valid=value===target(c.value);else if(c.op==='in')valid=Array.isArray(c.value)&&c.value.map(target).includes(value);else valid=false}
  if(!valid)failures.push({key:row.key,field:c.field,code:'CONSTRAINT_VIOLATED'})
 }
 return {status:failures.length?'failed':rows.length?'passed':'empty',failures}
}
export function auditFixedRoles({required,results}){
 const failures=[]
 const sorted=v=>v&&typeof v==='object'?Array.isArray(v)?v.map(sorted):Object.fromEntries(Object.keys(v).sort().map(k=>[k,sorted(v[k])])):v
 const canonical=v=>JSON.stringify(sorted(v))
 for(const role of required){const rows=results.filter(r=>r.role===role.name);if(rows.length!==1||!rows[0]?.visible||!rows[0]?.key||canonical(rows[0].input)!==canonical(role.input))failures.push({role:role.name,code:'FIXED_RESULT_MISSING_OR_CONTEXT_MISMATCH'})}
 return {status:failures.length?'failed':'passed',failures}
}
const technical=k=>/^(?:id|.*Id|.*_id|rowKey|rawRef|url|source|fetchedAt|requestId|\$.*)$/.test(k)
function facts(row){return Object.entries(row||{}).filter(([k,v])=>!technical(k)&&v!=null&&typeof v!=='object').map(([k,v])=>[k,String(v)])}
export function auditDetailEvidence({row,request,expected,details}){
 if(!expected||request?.tool!==expected.tool||Object.entries(expected.input).some(([k,v])=>request.input?.[k]!==v))return {status:'failed',code:'DETAIL_ENTITY_OR_CONTEXT_MISMATCH'}
 const old=new Set(facts(row).map(([,v])=>v)),items=details?.items||[]
 const added=items.flatMap(r=>typeof r.field==='string'&&Object.hasOwn(r,'value')&&!technical(r.field)?[[r.field,String(r.value??'')]]:facts(r)).filter(([,v])=>v.trim()&&!old.has(v))
 return added.length?{status:'passed',added:added.map(([field])=>field)}:{status:'limited',code:'DETAIL_NO_NEW_INFORMATION'}
}
