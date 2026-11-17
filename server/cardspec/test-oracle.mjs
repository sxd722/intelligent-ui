import {isDeepStrictEqual as equal} from 'node:util'

const walk=nodes=>(nodes||[]).flatMap(n=>[n,...walk(n.children)])
const operation=s=>Object.fromEntries(Object.entries(s||{}).filter(([k])=>k!=='expect'))
const healthy=run=>!(run.initial?.errors?.length||run.final?.errors?.length||run.pageErrors?.length)&&run.actions?.every(a=>a.ok&&!a.errors?.length&&a.restored!==false)
const enabled=(c,observed)=>{const matches=(observed?.controls||[]).filter(x=>x.name===c.name);return matches.length&&matches.every(x=>!x.disabled===c.enabled)}

// A model-authored expectation is a hypothesis, not a product requirement.
// Revision needs previously observed passing assertions on the exact source/
// context, or independently verified host restoration semantics. Code alone
// is never an oracle.
export function createTestOracle(){
 const anchors=[],disputes=[],history=[]
 function inspect(spec,browser,{version,contextHash}){
  const issues=[]
  for(const run of browser?.runs||[]){
   if(!healthy(run))continue
   for(const [index,a]of run.actions.entries()){
    // Reload's host contract is restoration, not a state mutation. A successful
    // stable restore independently proves that changed:true is a test mistake;
    // don't change the app to invent a mutation. Autonomous/waited transitions
    // and all unrelated business assertions remain outside this exception.
    if(a.step?.op==='reload'&&a.step.expect?.changed===true&&!a.step.waitMs&&a.restored===true&&a.changed===false&&!a.resumedStateChanged&&a.assertion?.failures?.includes('unexpected feedback change')){
     const expected={...structuredClone(a.step.expect),changed:false},conflicts=['changed']
     const anchor={kind:'host-contract',contract:'reload restores persisted state without a requested autonomous wait'}
     const unresolvedFailures=a.assertion.failures.filter(f=>f!=='unexpected feedback change')
     const issue={classification:'test_oracle_conflict',index,width:run.width,scenario:run.scenario,version,contextHash,step:structuredClone(a.step),expected,conflicts,anchor}
     a.classification=issue.classification;a.oracle={conflicts,expected,anchor,unresolvedFailures};issues.push(issue);continue
    }
    if(a.assertion?.passed!==false||!a.step?.handle||a.step.op!=='click')continue
    const before=index?run.actions[index-1].observed:run.initial
    const prefix=run.actions.slice(0,index+1).map(x=>operation(x.step))
    const node=walk(spec.children).find(n=>{try{return decodeURIComponent(a.step.handle).split(':')[0].split('/').at(-1)===n.id}catch{return false}})
    const body=spec.actions?.[node?.props?.onPress?.value]
    // Independent literal setters permit different unrelated input values.
    // Increment, conditional, async, sandbox and keyed updates do not qualify.
    const constant=body?.length&&body.every(s=>s.type==='set'&&!s.key&&s.value?.type==='literal')?Object.fromEntries(body.map(s=>[s.target,s.value.value])):{}
    const anchor=anchors.find(p=>p.version===version&&p.contextHash===contextHash&&p.width===run.width&&p.scenario===run.scenario&&p.step.handle===a.step.handle&&equal(operation(p.step),operation(a.step))&&Object.entries(a.step.expect?.state||{}).some(([key,value])=>Object.hasOwn(p.step.expect?.state||{},key)&&!equal(value,p.step.expect.state[key])&&equal(a.observed?.state?.[key],p.step.expect.state[key])&&(Object.hasOwn(constant,key)&&equal(constant[key],p.step.expect.state[key])||equal(p.prefix,prefix)&&equal(p.before,before))))
    if(!anchor)continue
    const expected=structuredClone(a.step.expect),conflicts=[]
    for(const [key,value]of Object.entries(expected.state||{}))if(Object.hasOwn(anchor.step.expect?.state||{},key)&&!equal(value,anchor.step.expect.state[key])&&equal(a.observed?.state?.[key],anchor.step.expect.state[key])&&(Object.hasOwn(constant,key)&&equal(constant[key],anchor.step.expect.state[key])||equal(anchor.prefix,prefix)&&equal(anchor.before,before))){expected.state[key]=structuredClone(anchor.step.expect.state[key]);conflicts.push('state.'+key)}
    // Preserve every unrelated assertion; replace only controls contradicted by
    // an already witnessed alternative. The revision must actually run again.
    if(anchor.step.expect?.controls?.length&&anchor.step.expect.controls.every(c=>enabled(c,a.observed))&&expected.controls?.some(c=>!enabled(c,a.observed))){
     const keep=expected.controls.filter(c=>enabled(c,a.observed));expected.controls=[...keep,...anchor.step.expect.controls.filter(c=>!keep.some(k=>equal(k,c)))];conflicts.push('controls')
    }
    const issue={classification:'test_oracle_conflict',index,width:run.width,scenario:run.scenario,version,contextHash,step:structuredClone(a.step),expected,conflicts,anchor:{version:anchor.version,step:anchor.index+1,expect:anchor.step.expect},reason:'Contradicts a passing assertion on the same source and context; actual output still matches that evidence. This is not proof of complete business correctness.'}
    const unresolvedFailures=(a.assertion.failures||[]).filter(f=>!conflicts.some(k=>k==='controls'?f.startsWith('expected visible control '):f===k+' did not equal expected value'))
    a.classification=issue.classification;a.oracle={conflicts,expected,anchor:issue.anchor,unresolvedFailures};issues.push(issue)
   }
  }
  return issues
 }
 function record(steps,browser,meta,issues,ledger){
  const normal=(browser?.runs||[]).filter(r=>r.scenario==='normal'),base=steps.filter(s=>!s.scenario||s.scenario==='normal')
  const successful=normal.length&&normal.every(r=>healthy(r)&&r.actions.length===base.length&&r.actions.every(a=>a.assertion?.passed!==false))
  if(successful){
   for(const d of disputes.filter(d=>d.status==='pending'&&d.version===meta.version&&d.contextHash===meta.contextHash)){
    // Only a rerun of the SAME operations with the evidence-backed replacement
    // can supersede a disputed test. Deletion, weaker asserts or code changes
    // cannot erase it. Keep the original and revision in the artifact history.
    if(equal(base,d.corrected)&&d.widths.every(w=>normal.some(r=>r.width===w))){
     ledger.revise(d.original,base);d.status='corrected';history.push({...structuredClone(d),resolution:'same-source test-only rerun passed'})
    }
   }
   for(const run of normal)for(const [index,a]of run.actions.entries())if(a.assertion?.passed&&a.observed){
    anchors.push({...meta,width:run.width,scenario:run.scenario,index,step:structuredClone(a.step),before:structuredClone(index?run.actions[index-1].observed:run.initial),prefix:run.actions.slice(0,index+1).map(x=>operation(x.step))})
   }
   if(anchors.length>256)anchors.splice(0,anchors.length-256)
  }
  if(issues.length&&!disputes.some(d=>d.version===meta.version&&d.contextHash===meta.contextHash&&equal(d.original,base))){
   const corrected=structuredClone(base)
   for(const issue of issues.filter(i=>i.scenario==='normal'))if(corrected[issue.index])corrected[issue.index].expect=issue.expected
   if(!equal(corrected,base))disputes.push({...meta,status:'pending',original:structuredClone(base),corrected,widths:[...new Set(issues.map(i=>i.width))]})
  }
 }
 return {inspect,record,pending:()=>disputes.filter(d=>d.status==='pending'),snapshot:()=>({pending:structuredClone(disputes.filter(d=>d.status==='pending')),corrections:structuredClone(history)})}
}
