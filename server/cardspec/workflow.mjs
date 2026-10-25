// A bounded DAG of registered readonly calls. No shell, recursion or dynamically constructed IDs.
export async function runReadWorkflow({steps},read,signal){
 if(!Array.isArray(steps)||!steps.length||steps.length>6)throw Error('workflow requires 1–6 steps')
 const ids=new Set()
 for(const s of steps){
  if(!s||typeof s.id!=='string'||!s.id||ids.has(s.id)||typeof s.tool!=='string'||!s.input||typeof s.input!=='object'||Array.isArray(s.input))throw Error('invalid workflow step')
  ids.add(s.id)
 }
 const pending=new Map(steps.map(s=>[s.id,s])),results=new Map(),trace=[]
 for(const s of steps)if(s.after!==undefined&&(!Array.isArray(s.after)||s.after.some(id=>!ids.has(id))))throw Error('unknown dependency')
 // Validate the entire graph before any external effects.
 const visited=new Set(),visiting=new Set()
 function visit(id){if(visiting.has(id))throw Error('workflow dependency cycle');if(visited.has(id))return;visiting.add(id);for(const dep of pending.get(id).after||[])visit(dep);visiting.delete(id);visited.add(id)}
 steps.forEach(s=>visit(s.id))
 while(pending.size){
  signal?.throwIfAborted()
  const ready=[...pending.values()].filter(s=>(s.after||[]).every(id=>results.has(id)))
  // OpenCLI is serialized conservatively, including its public adapters.
  const batch=ready[0].tool.startsWith('opencli.')?[ready[0]]:ready.filter(s=>!s.tool.startsWith('opencli.')).slice(0,2)
  await Promise.all(batch.map(async s=>{
   let value
   if((s.after||[]).some(id=>results.get(id).status==='failed'))value={status:'failed',error:'dependency failed',dataAvailable:false}
   else try{value={status:'succeeded',result:await read(s.tool,s.input,signal)}}catch(e){signal?.throwIfAborted();value={status:'failed',error:e.message,code:e.errorInfo?.code||e.code,dataAvailable:false}}
   results.set(s.id,value);pending.delete(s.id);trace.push({id:s.id,tool:s.tool,...value})
  }))
 }
 return {steps:trace,complete:trace.every(s=>s.status==='succeeded'),instruction:'Only successful steps contain data; failures are not zero observations.'}
}
