// Stop repeated non-progress, not merely long but improving work.
export function createConvergenceGuard(){
 let signature='',repeats=0,stopped=false,previousErrors=Infinity,history=[]
 return {observe(record){
  if(['passed','partial'].includes(record.status)){signature='';repeats=0;stopped=false;previousErrors=Infinity;history=[];return {stopped:false,repeats:0}}
  const errors=record.diagnostics.filter(d=>d.severity==='error')
  // Message offsets and literal values change during rewriting. Track the root
  // class plus failing requirement/node, while acknowledging fewer failures.
  const root=d=>d.code==='shared_action_payload'?'action:'+d.action:(d.node||d.requirement||'')+':'+String(d.message||'').replace(/@auto-\d+/g,'@auto').replace(/(?:offset|position|line|column)\s*[:=]?\s*\d+/gi,'position #')
  const testOnly=errors.length&&errors.every(d=>['debug_test_oracle_conflict','debug_test_revision_required'].includes(d.code))
  const next=record.browser?.classification==='host_unverified'?'host:'+record.browser.phase:testOnly?'test:oracle-conflict':[...new Set(errors.map(d=>d.code+':'+root(d)))].sort().join('|')||record.status
  if(record.progress?.improved)history=[]
  const cycle=history.slice(0,-1).includes(next)&&next!==signature&&!record.progress?.improved
  repeats=next===signature&&errors.length>=previousErrors?repeats+1:1;signature=next;previousErrors=errors.length
  history.push(next);history=history.slice(-8)
  // Initial failure + two further unchanged observations = two no-progress
  // retries. Host uncertainty needs only one retry and no model rewriting.
  stopped=cycle||repeats>=(next.startsWith('host:')?2:3)
  return {stopped,repeats,cycle,reason:cycle?'repair_cycle':undefined,classification:next.startsWith('host:')?'host_unverified':testOnly?'test_oracle_conflict':'model_or_contract',instruction:stopped?'Stop rewriting this card. Preserve the candidate and report unresolved verification; host failures need host diagnosis, not model rewrites.':testOnly?'Keep source unchanged; revise and rerun only the disputed test.':'Fix only the reported cause; preserve working behavior.'}
 },stopped:()=>stopped}
}
