// Progress is evidence, not wording, source churn, or a green/partial label.
const testCodes=new Set(['requirement_assertion','debug_test_step','debug_test_oracle_conflict','debug_test_revision_required'])
const faults=r=>(r.diagnostics||[]).filter(d=>d.severity==='error'&&!testCodes.has(d.code))
const key=d=>[d.code,d.node||d.module||'',String(d.message||'').replace(/(?:line|column|position|offset)\s*[:=]?\s*\d+/gi,'position #')].join(':')
const ops=r=>JSON.stringify((r.steps||[]).map(({expect,requirement,...s})=>s))
export function createProgressLedger({patience=3}={}){
 let stale=0,observations=0,stopped=false,previous,scope
 const seen=new Set(),fixed=new Set(),history=[]
 function observe(r,contextHash='default'){
  if(scope!==contextHash){scope=contextHash;stale=0;observations=0;stopped=false;previous=undefined;seen.clear();fixed.clear();history.length=0}
  const checked=[...(r.cujCoverage?.items||[]).filter(x=>x.kind==='interaction'&&x.status==='checked').map(x=>'requirement:'+x.id),...(r.behaviorCoverage?.items||[]).filter(x=>x.status==='checked').map(x=>'behavior:'+JSON.stringify(x.states))]
  for(const outcome of r.terminalCoverage?.checked||[])checked.push('terminal:'+outcome)
  // One unlabelled core-path milestone, not infinitely many model-authored IDs.
  const runs=(r.browser?.runs||[]).filter(x=>x.scenario==='normal')
  const healthy=r.browser?.status==='tested'&&runs.length&&runs.every(x=>!x.initial?.errors?.length&&!x.final?.errors?.length&&!x.pageErrors?.length&&x.actions?.every(a=>a.ok&&a.assertion?.passed!==false&&a.restored!==false))
  if(healthy&&runs.some(x=>x.actions.some(a=>a.assertion?.passed&&(a.step?.expect?.text||Object.keys(a.step?.expect?.state||{}).length||Object.keys(a.step?.expect?.derived||{}).length))))checked.push('core-path')
  if(healthy&&runs.every(x=>x.actions.some(a=>a.step?.op==='reload'&&a.restored===true)))checked.push('restore')
  const gained=checked.filter(x=>!seen.has(x));gained.forEach(x=>seen.add(x))
  const current=new Set(faults(r).map(key)),resolved=[]
  if(previous&&r.version!==previous.version){
   for(const d of faults(previous)){
    const id=key(d),runtime=/^debug_|runtime/.test(d.code)
    // Runtime errors need a re-execution of the same path. Missing/skipped
    // checks, test edits, and an unresponsive host cannot prove a code fix.
    if(!current.has(id)&&!fixed.has(id)&&current.size<faults(previous).length&&r.compiled===true&&(!runtime||healthy&&ops(previous)===ops(r))){resolved.push(id);fixed.add(id)}
   }
  }
  const progress=gained.length>0||resolved.length>0
  stale=observations===0||progress?0:stale+1;observations++
  stopped=stopped||stale>=patience
  const result={stopped,stale,patience,observations,improved:progress,newEvidence:gained,resolvedErrors:resolved,reason:stopped?'no_effective_progress':undefined}
  history.push({...result,version:r.version,status:r.status});previous=r
  return result
 }
 return {observe,stopped:()=>stopped,snapshot:()=>({stopped,stale,patience,observations,evidence:[...seen],history})}
}

export function remainingTasks(best,latest,{pendingTests=[]}={}){
 const tasks=[]
 const add=(lane,target,reason,extra={})=>tasks.push({id:'T'+(tasks.length+1),lane,target,reason,status:'pending',...extra})
 for(const r of best?.record?.cujCoverage?.items||latest?.cujCoverage?.items||[])if(r.status!=='checked'&&r.status!=='other-card')add(r.kind==='review'?'review':'interaction',r.id,r.quote||r.reason||'缺少结果证据',{requirement:r.id})
 for(const d of [...(best?.record?.diagnostics||[]),...(latest?.diagnostics||[])])if(d.severity==='error'||['debug_request','debug_test_step','debug_layout','debug_linkage_unverified'].includes(d.code)){
  const lane=['debug_test_step','debug_request'].includes(d.code)||d.code.includes('test_')?'test':d.code==='requirement_assertion'?'behavior-review':d.code==='debug_layout'?'layout':'implementation'
  add(lane,d.node||d.module||d.code,String(d.message).slice(0,650),{code:d.code})
 }
 for(const outcome of best?.record?.terminalCoverage?.remaining||latest?.terminalCoverage?.remaining||[])add('interaction','terminal:'+outcome,'尚无从初始状态到 '+outcome+' 的完整持久化结果证据')
 if(latest?.browser?.classification==='host_unverified')add('host',latest.browser.phase||'browser','宿主验证不确定；不得以改模型代码代替宿主诊断')
 for(const d of pendingTests)add('test',d.version,'测试预期冲突尚未完成同源码复测',{steps:d.corrected})
 if(!tasks.length)add('review','coverage','已停在可用候选；有界检查不证明全部原始需求已完成')
 return [...new Map(tasks.map(t=>[[t.lane,t.target,t.reason].join(':'),t])).values()].map((t,i)=>({...t,id:'T'+(i+1),baseVersion:best?.version,preserve:'保留已通过路径；只修改对应局部，修改后重验受影响行为与整卡关键路径。'}))
}
