// Host-owned progress, independent of model wording, file hashes and budgets.
export function createBuildConvergence({patience=8}={}){
 let best,stale=0,observations=0
 const history=[]
 const compare=(a,b)=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0}
 function observe({units=0,audit,feedback={}}={}){
  const checked=(audit?.items||[]).filter(r=>['checked','limited'].includes(r.status)).length
  const errors=new Set((feedback.diagnostics||[]).filter(d=>d.severity==='error'&&!['requirement_assertion','debug_test_step'].includes(d.code)).map(d=>d.code+':'+(d.module||'')))
  const layout=feedback.layout||[]
  const score=[units,checked,-errors.size,-layout.length,-Math.ceil(layout.reduce((s,i)=>s+(i.overflow||0),0)/8)]
  const improved=!best||compare(score,best)>0
  if(improved){best=score;stale=0}else stale++
  observations++
  history.push({score,phase:feedback.phase,failures:[...errors].sort(),layout:[...new Set(layout.map(i=>i.code+':'+(i.module||'')))].sort()})
  if(history.length>patience+1)history.shift()
  return {improved,stale,stop:stale>=patience,score,best,observations,reason:stale>=patience?`连续 ${patience} 轮未增加已提交功能/已验证需求，也未改善阻断错误或布局；已停止自动修复，保留候选供人工验收。`:undefined}
 }
 return {observe,snapshot:()=>({best,stale,observations,history})}
}

// Each requirement retains a complete executable prefix, never an isolated click.
// Evidence expires on a source change; scripts survive and must be replayed.
export function createBuildEvidenceLedger(){
 let version
 const verified=new Map(),flows=new Map(),attempted=new Set()
 const setVersion=v=>{if(v!==version){version=v;verified.clear();attempted.clear()}}
 const key=steps=>JSON.stringify(steps)
 function record(v,steps,evidence){
  setVersion(v);attempted.add(key(steps))
  const runs=(evidence?.runs||[]).filter(r=>r.scenario==='normal')
  if(!runs.length)return
  // A source must pass every normal viewport, not just the first screenshot.
  for(const id of new Set(steps.map(s=>s.requirement).filter(Boolean))){
   const end=steps.findLastIndex(s=>s.requirement===id),prefix=steps.slice(0,end+1)
   const passing=runs.every(r=>!r.initial?.errors?.length&&!r.final?.errors?.length&&!r.pageErrors?.length&&r.actions?.length>end&&r.actions.slice(0,end+1).every(a=>a.ok&&!a.skipped&&!a.errors?.length&&a.assertion?.passed!==false&&a.restored!==false)&&r.actions.slice(0,end+1).some(a=>a.step?.requirement===id&&a.assertion?.passed===true))
   if(passing){
    const actions=runs.flatMap(r=>r.actions.slice(0,end+1).filter(a=>a.step?.requirement===id)).map(({step,ok,changed,assertion,restored})=>({step,ok,changed,assertion,restored}))
    // A later read-only assertion doesn't erase this version's passed action.
    verified.set(id,[...new Map([...(verified.get(id)||[]),...actions].map(a=>[key(a.step),a])).values()].slice(-64))
    // Keep the action-bearing path when a later check adds no navigation.
    if(!flows.has(id)||prefix.some(s=>!['check','reload'].includes(s.op)))flows.set(id,structuredClone(prefix))
   }
   else verified.delete(id)
  }
 }
 function pending(v){
  setVersion(v)
  const all=[...new Map([...flows.values()].filter(s=>!attempted.has(key(s))).map(s=>[key(s),s])).values()]
  return all.filter(s=>!all.some(other=>other.length>s.length&&key(other.slice(0,s.length))===key(s)))
 }
 function summary(){return {version,verified:[...verified.keys()],retainedFlows:[...flows].map(([id,steps])=>({id,steps:steps.length})),policy:'Evidence is source-version scoped. Retained flows replay from fresh initial state; discovery never proves coverage.'}}
 return {record,pending,actions:()=>[...verified.values()].flat(),summary}
}
