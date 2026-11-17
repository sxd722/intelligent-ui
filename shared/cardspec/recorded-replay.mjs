import {canonicalInput} from './prefetch.mjs'

export const RECORDED_REPLAY_MODE='recorded-only-v1'
const safePath=p=>Array.isArray(p)&&p.length>0&&p.length<=8&&p.every(k=>typeof k==='string'&&k.length>0&&!['__proto__','prototype','constructor'].includes(k))
const get=(v,path)=>path.reduce((x,k)=>x&&Object.hasOwn(x,k)?x[k]:undefined,v)
const set=(v,path,value)=>{let x=v;for(const k of path.slice(0,-1)){if(!x[k]||typeof x[k]!=='object'||Array.isArray(x[k]))throw Error('Invalid replay metadata path');x=x[k]}x[path.at(-1)]=value}
export function replayMiss(tool){return Object.assign(Error(`DEBUG_REPLAY_MISS: no authorized recorded response for ${tool}; query, language, sort and pagination must match`),{code:'DEBUG_REPLAY_MISS'})}

// Fault injection is an explicitly requested evaluation scenario, never a
// substitute for missing normal data. A matched snapshot is the prerequisite.
// Only the standard list envelope has a known empty representation here.
export function emptyRecordedList(saved){
 if(!saved||!Array.isArray(saved.value?.items))throw Object.assign(Error('DEBUG_UNSUPPORTED: recorded response has no supported empty list representation'),{code:'DEBUG_UNSUPPORTED'})
 const value=structuredClone(saved.value)
 value.items=[]
 if(Object.hasOwn(value,'truncated'))value.truncated=false
 if(value.coverage&&typeof value.coverage==='object'&&!Array.isArray(value.coverage)){
  for(const key of ['total','matched','returned'])if(Object.hasOwn(value.coverage,key))value.coverage[key]=0
  if(Object.hasOwn(value.coverage,'complete'))value.coverage.complete=true
 }
 return value
}

// Only host-authored metadata can assert ordered-prefix semantics. Tool names,
// numeric fields and similar text never imply permission to adapt a snapshot.
export function matchRecordedSnapshot(records,payload,{allowPrefix=false}={}){
 const candidates=records.filter(r=>r.tool===payload.tool)
 const exact=candidates.find(r=>canonicalInput(r.input)===canonicalInput(payload.input))
 if(exact)return {record:exact,match:'exact',value:structuredClone(exact.value),...(exact.snapshotCoverage?{snapshotCoverage:structuredClone(exact.snapshotCoverage)}:{})}
 if(!allowPrefix)return null
 for(const record of candidates){
  const policy=record.metadata?.replay
  if(policy?.mode!=='ordered-prefix-v1'||!safePath([policy.limitField])||!safePath(policy.itemsPath)||!safePath(policy.truncatedPath)||policy.returnedPath&&!safePath(policy.returnedPath)||policy.completePath&&!safePath(policy.completePath))continue
  const key=policy.limitField,requested=payload.input?.[key],recorded=record.input?.[key]
  if(!Number.isSafeInteger(requested)||requested<1||!Number.isSafeInteger(recorded)||recorded<1)continue
  const a={...payload.input},b={...record.input};delete a[key];delete b[key]
  if(canonicalInput(a)!==canonicalInput(b))continue
  const items=get(record.value,policy.itemsPath),truncated=get(record.value,policy.truncatedPath)
  if(!Array.isArray(items)||typeof truncated!=='boolean')continue
  const selected=items.slice(0,requested),value=structuredClone(record.value)
  const incomplete=truncated||selected.length<items.length
  set(value,policy.itemsPath,structuredClone(selected));set(value,policy.truncatedPath,incomplete)
  if(policy.returnedPath)set(value,policy.returnedPath,selected.length)
  if(policy.completePath)set(value,policy.completePath,!incomplete)
  const snapshotCoverage={requested,returned:selected.length,complete:!incomplete,mode:'recorded-live',recordedLimit:recorded,available:items.length}
  return {record,match:'ordered-prefix',value,snapshotCoverage}
 }
 return null
}
