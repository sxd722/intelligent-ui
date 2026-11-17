import {TOOLS,validateToolInput,validateJson} from './tools.mjs'
import {matchRecordedSnapshot,replayMiss,emptyRecordedList,RECORDED_REPLAY_MODE} from './recorded-replay.mjs'

// Contract fixtures, never evidence. Sparse adapter schemas cannot prove field semantics.
export function schemaFixture(schema,seed=1,depth=0){
 if(!schema||depth>12)throw Error('No fixture schema')
 if(schema.enum)return schema.enum[0]
 const type=Array.isArray(schema.type)?schema.type.find(t=>t!=='null'):schema.type
 if(type==='object')return Object.fromEntries(Object.entries(schema.properties||{}).map(([k,s])=>[k,schemaFixture(s,seed,depth+1)]))
 if(type==='array')return Array.from({length:Math.min(schema.maxItems??2,Math.max(schema.minItems??0,2))},(_,i)=>schemaFixture(schema.items,i+1,depth+1))
 if(type==='number'||type==='integer')return Math.min(schema.maximum??seed,Math.max(schema.minimum??0,seed))
 if(type==='boolean')return true
 if(type==='null')return null
 if(type==='string')return ('DEBUG_SAMPLE_'+seed).padEnd(schema.minLength||0,'x').slice(0,schema.maxLength??80)
 throw Error('Unsupported fixture schema')
}
export function createDebugTransport({scenario='normal',calls=[],coverage=[],snapshots=[],replayMode}={}){
 return async(payload,signal)=>{
  signal?.throwIfAborted();const t=TOOLS[payload.tool]
  validateToolInput(payload.tool,payload.input)
  calls.push({tool:payload.tool,target:payload.target,input:payload.input,mock:true})
  if(!t||t.readOnly===false||!t.outputSchema||payload.target!=='binding'){
   coverage.push({tool:payload.tool,reason:'write or generated page/slot not executed'})
   throw Object.assign(Error('DEBUG_UNSUPPORTED: 此能力未模拟，未执行外部调用'),{code:'DEBUG_UNSUPPORTED'})
  }
  const strict=replayMode===RECORDED_REPLAY_MODE
  if(scenario==='failure'&&!strict)throw Object.assign(Error('DEBUG_SIMULATED_FAILURE'),{code:'PROVIDER_ERROR'})
  // Exact host-collected snapshots keep real field names and nulls. They are
  // replayed offline, not treated as evidence of a fresh network invocation.
  const fault=strict&&(scenario==='empty'||scenario==='failure')
  const saved=(scenario==='normal'||fault)&&matchRecordedSnapshot(snapshots,payload,{allowPrefix:strict})
  if(saved&&fault){
   validateJson(saved.value,t.outputSchema)
   const mode='simulated-'+scenario
   Object.assign(calls.at(-1),{mode,scenario,baseSnapshot:true,match:saved.match,...(saved.snapshotCoverage?{baseSnapshotCoverage:saved.snapshotCoverage}:{})})
   coverage.push({tool:payload.tool,reason:'explicit fault injection',mode,scenario,match:saved.match})
   if(scenario==='failure')throw Object.assign(Error('DEBUG_SIMULATED_FAILURE'),{code:'PROVIDER_ERROR',mode})
   let value
   try{value=emptyRecordedList(saved);validateJson(value,t.outputSchema)}
   catch(e){coverage.push({tool:payload.tool,reason:'DEBUG_UNSUPPORTED',scenario,detail:String(e.message)});throw Object.assign(Error('DEBUG_UNSUPPORTED: recorded response cannot represent a schema-valid empty list'),{code:'DEBUG_UNSUPPORTED',mode})}
   return {kind:'json',value,dataMode:mode}
  }
  if(saved){validateJson(saved.value,t.outputSchema);Object.assign(calls.at(-1),{snapshot:true,match:saved.match,...(saved.snapshotCoverage?{snapshotCoverage:saved.snapshotCoverage}:{})});return {kind:'json',value:saved.value,...(saved.snapshotCoverage?{snapshotCoverage:saved.snapshotCoverage}:{})}}
  if(strict){coverage.push({tool:payload.tool,reason:'DEBUG_REPLAY_MISS',scenario,input:payload.input});throw replayMiss(payload.tool)}
  const value=schemaFixture(t.outputSchema)
  if(Array.isArray(value.items)){
   // Adapters expose column names, not per-column types. Do not invent numeric semantics.
   if(t.provider==='opencli'){
    coverage.push({tool:t.id,reason:'column types unspecified; normal rows are partial fixtures'})
    value.items=Array.from({length:2},(_,i)=>Object.fromEntries([...new Set(['rowKey',...(t.columns||[])])].map(k=>[k,/^(rowKey|id)$/.test(k)?String(i+1):/^(title|name|label)$/.test(k)?'DEBUG_SAMPLE_'+(i+1):null])))
   }else value.items.forEach((row,i)=>{if(row&&typeof row==='object'&&'id' in row)row.id=String(i+1)})
   if(scenario==='empty')value.items=[]
   value.source='DEBUG_MOCK_NOT_EVIDENCE';value.fetchedAt='2026-01-01T00:00:00.000Z'
   if('truncated' in value)value.truncated=false
   if(value.coverage)value.coverage={complete:true,total:value.items.length,matched:value.items.length,returned:value.items.length}
  }
  validateJson(value,t.outputSchema);return {kind:'json',value}
 }
}
