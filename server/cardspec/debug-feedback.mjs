// Summaries for the model, never serialized browser snapshots. Keep failing
// steps before successful steps and explicitly report any omitted evidence.
const clip=(v,n=240)=>String(v??'').slice(0,n)
const failed=a=>!a.ok||a.restored===false||a.assertion?.passed===false||a.errors?.length
export function summarizeDebugFeedback(record,{limit=6000}={}){
 const runs=record.browser?.runs||[],all=runs.flatMap(run=>(run.actions||[]).map((a,i)=>({a,step:i+1,scenario:run.scenario,width:run.width})))
 const diagnostics=[...(record.diagnostics||[])].sort((a,b)=>Number(b.severity==='error')-Number(a.severity==='error')).map(d=>({...d,message:clip(d.message,450)}))
 const priority=a=>a.skipped?-1:failed(a)?2:0
 const actions=all.sort((a,b)=>priority(b.a)-priority(a.a)).map(({a,step,scenario,width})=>({step,scenario,width,op:a.step?.op,name:clip(a.step?.name,100),ok:a.ok,changed:a.changed,restored:a.restored,classification:a.classification,
  ...(a.error?{error:clip(a.error)}:{}),...(a.assertion?{assertion:{passed:a.assertion.passed,failures:(a.assertion.failures||[]).map(x=>clip(x,180)).slice(0,3)}}:{}),
  ...(a.stateKeysChanged?{stateKeysChanged:a.stateKeysChanged.slice(0,8)}:{}),
  ...(failed(a)&&a.observed?{observed:{text:clip(a.observed.text,350),state:Object.fromEntries(Object.entries(a.observed.state||{}).filter(([k])=>Object.hasOwn(a.step?.expect?.state||{},k)).slice(0,6).map(([k,v])=>[k,typeof v==='string'?clip(v,100):v]))}}:{})}))
 const controls=(runs[0]?.final?.controls||[]).map(c=>({role:c.role,name:clip(c.name,100),handle:c.handle,sandbox:c.sandbox,owner:c.owner,disabled:c.disabled,value:c.value})).sort((a,b)=>Number(b.name.startsWith('卡片页面：'))-Number(a.name.startsWith('卡片页面：')))
 const feedback={version:record.version,status:record.status,mode:record.mode,diagnostics:[],actions:[],controls:[],coverage:[],summary:{runs:runs.length,actions:all.length,failed:all.filter(({a})=>failed(a)).length},omitted:{diagnostics:0,actions:0,controls:0,coverage:0},elapsedMs:record.elapsedMs}
 // Reserve useful space for the failed step even when diagnostics contain long
 // code contexts. No single action may consume the whole return envelope.
 const add=(key,items,cap)=>{for(const item of items){if(feedback[key].length<cap){feedback[key].push(item);if(JSON.stringify(feedback).length<=limit-160)continue;feedback[key].pop()}feedback.omitted[key]++}}
 add('diagnostics',diagnostics.filter(d=>d.severity==='error').slice(0,2).map(d=>({...d,context:typeof d.context==='string'?clip(d.context,400):d.context})),2)
 add('actions',actions.filter(a=>a.ok===false||a.assertion?.passed===false||a.restored===false).slice(0,2),2)
 add('controls',controls,12)
 const shown=new Set(feedback.actions.map(a=>[a.step,a.scenario,a.width].join(':')))
 add('actions',actions.filter(a=>!shown.has([a.step,a.scenario,a.width].join(':'))),16)
 const used=new Set(feedback.diagnostics.map(d=>d.code+':'+d.message))
 add('diagnostics',diagnostics.filter(d=>!used.has(d.code+':'+d.message)),6)
 add('coverage',runs[0]?.final?.coverage||[],4)
 feedback.omitted.diagnostics=diagnostics.length-feedback.diagnostics.length
 feedback.omitted.actions=actions.length-feedback.actions.length
 if(Object.values(feedback.omitted).some(Boolean))feedback.truncated=true
 return feedback
}
