import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createDebugSession} from '../server/cardspec/debug-session.mjs'
import {assertSnapshot} from '../shared/cardspec/debug-assertions.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
import {createTestOracle} from '../server/cardspec/test-oracle.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createResearchSession} from '../server/research/session.mjs'

const source='<card><state id="open" type="boolean" initial={false}/><state id="input" type="number" initial={1}/><button id="show" onPress="show">展开</button><button id="back" onPress="back">返回</button><text>{state.open}</text><action id="show"><set target="open" value={true}/></action><action id="back"><set target="open" value={false}/></action></card>'
const steps=[{op:'click',name:'展开',requirement:'R1',expect:{state:{open:true}}},{op:'click',name:'返回',requirement:'R1',expect:{state:{open:false}}}]
const wrong=structuredClone(steps);wrong[1].expect.state.open=true
async function runner(spec,{steps}){
 const store=createStore(),snap=()=>({state:structuredClone(makeScope(spec,store).state),text:'content',controls:[],errors:[],coverage:[]}),initial=snap(),actions=[]
 for(const s of steps){const before=snap(),id=s.name==='展开'?'show':'back';if(s.op==='click')executeAction(spec,store,id);const after=snap();actions.push({step:{...s,handle:encodeURIComponent('/'+id)+':0',role:'button'},ok:true,changed:true,observed:after,assertion:assertSnapshot(s.expect,before,after),errors:[]})}
 return {status:'tested',runs:[{width:432,scenario:'normal',initial,final:snap(),actions,pageErrors:[]}]}
}
async function session(fn){const dir=await mkdtemp(join(tmpdir(),'cardspec-oracle-'));try{await fn(createDebugSession({artifactRoot:dir,runner}))}finally{await rm(dir,{recursive:true,force:true})}}

test('contradictory model test is corrected without modifying source; final and commit reuse witnessed paths',()=>session(async d=>{
 const first=await d.test({source,steps});assert.notEqual(first.status,'failed')
 const bad=await d.test({source,steps:wrong});assert.equal(bad.status,'failed');assert.equal(bad.repairLane,'test');assert.equal(bad.summary.testConflicts,1)
 assert.throws(()=>d.commit({version:first.version}),/failed|conflict/)
 assert.equal(d.snapshot().tests.at(-1).testOracle.pending.length,1)
 const corrected=await d.test({source,steps});assert.notEqual(corrected.status,'failed');assert.equal(d.snapshot().repairs,0)
 assert.equal(d.snapshot().tests.at(-1).testOracle.corrections.length,1)
 assert.equal(d.snapshot().tests.at(-1).testOracle.corrections[0].original[1].expect.state.open,true)
 assert.equal(d.commit({version:corrected.version}).source,source)
 assert.equal((await d.test({source},{final:true})).cached,true)
}))
test('deleting or weakening disputed assertions cannot clear the original failed path',()=>session(async d=>{
 await d.test({source,steps});await d.test({source,steps:wrong})
 const weaker=structuredClone(steps);weaker[1].expect={changed:true}
 const result=await d.test({source,steps:weaker});assert.equal(result.status,'failed');assert.equal(result.repairLane,'test');assert.throws(()=>d.commit({version:result.version}))
 assert.equal(d.snapshot().tests.at(-1).testOracle.pending.length,1)
}))
test('rewriting code to fit the wrong expectation cannot resolve a test conflict',()=>session(async d=>{
 await d.test({source,steps});await d.test({source,steps:wrong})
 const changed=source.replace('<action id="back"><set target="open" value={false}/>','<action id="back"><set target="open" value={true}/>')
 const result=await d.test({source:changed,steps:wrong});assert.equal(result.status,'failed');assert.ok(result.diagnostics.some(x=>x.code==='debug_test_revision_required'))
}))
test('without a prior passing oracle, even a constant setter is not proof that the expectation is wrong',()=>session(async d=>{
 const result=await d.test({source,steps:wrong});assert.equal(result.status,'failed');assert.equal(result.repairLane,'behavior-review');assert.equal(result.summary.testConflicts,0)
 // A subsequently passing different expectation cannot erase this first failure.
 const passing=await d.test({source,steps});assert.throws(()=>d.commit({version:passing.version}),/Earlier executable/)
}))
test('state contradictions cannot drop unrelated relational/business assertions',()=>session(async d=>{
 await d.test({source,steps});const mixed=structuredClone(wrong);mixed[1].expect.relations=[{left:'state.input',op:'eq',right:'state.open'}]
 await d.test({source,steps:mixed});const correction=d.snapshot().tests.at(-1).testOracle.pending[0].corrected
 assert.deepEqual(correction[1].expect.relations,mixed[1].expect.relations)
 const result=await d.test({source,steps:correction});assert.equal(result.status,'failed');assert.equal(d.snapshot().tests.at(-1).testOracle.pending.length,1)
}))
test('same-source literal transition permits unrelated inputs, but context or implementation changes invalidate the anchor',async()=>{
 const spec=compileCard(source,{final:true}).spec,oracle=createTestOracle(),browser=await runner(spec,{steps}),ledger={revise(){}}
 oracle.record(steps,browser,{version:'one',contextHash:'context'},[],ledger)
 const failed=await runner(spec,{steps:wrong});failed.runs[0].actions[0].observed.state.input=7;failed.runs[0].actions[1].observed.state.input=7
 assert.equal(oracle.inspect(spec,structuredClone(failed),{version:'one',contextHash:'context'}).length,1)
 assert.equal(oracle.inspect(spec,structuredClone(failed),{version:'two',contextHash:'context'}).length,0)
 assert.equal(oracle.inspect(spec,structuredClone(failed),{version:'one',contextHash:'changed'}).length,0)
})
test('a real result relation failure remains blocking after an unrelated passing path',()=>session(async d=>{
 await d.test({source,steps})
 const relation=[...steps,{op:'check',requirement:'R2',expect:{relations:[{left:'state.input',op:'eq',right:'state.open'}]}}]
 const result=await d.test({source,steps:relation});assert.equal(result.repairLane,'behavior-review');assert.equal(result.status,'failed');assert.equal(result.summary.testConflicts,0)
 await d.test({source,steps});assert.throws(()=>d.commit({version:result.version}),/Earlier executable/)
}))
test('test-only tool is disclosed on demand and reuses source without a code payload',()=>session(async d=>{
 assert.equal(d.retestTool(),null)
 await d.test({source,steps});const bad=await d.test({source,steps:wrong})
 assert.equal(d.retestTool().function.name,'card_retest')
 await assert.rejects(d.retest({version:bad.version,steps,source}),/source cannot/)
 let rounds=0
 const output=await createResearchSession().run(async(_messages,options)=>{
  rounds++
  if(rounds===1){assert.ok(options.tools.some(t=>t.function.name==='card_retest'));return {message:{role:'assistant',tool_calls:[{id:'retry',function:{name:'card_retest',arguments:JSON.stringify({version:bad.version,steps})}}]}}}
  assert.equal(options.tools.some(t=>t.function.name==='card_retest'),true)
  return {message:{role:'assistant',tool_calls:[{id:'commit',function:{name:'card_commit',arguments:JSON.stringify({version:bad.version})}}]}}
 },[],{debugSession:d})
 assert.equal(output,source);assert.equal(rounds,2);assert.equal(d.snapshot().repairs,0)
}))

test('same-version additional paths reuse code and accumulate coverage; changed source invalidates it',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cardspec-coverage-'))
 try{
  const d=createDebugSession({artifactRoot:dir,runner,context:()=>({userGoal:'点击展开显示说明。\n点击返回恢复桌面。'})})
  const first=await d.test({source,steps:[steps[0]]})
  assert.equal(d.retestTool().function.name,'card_retest')
  const second=await d.retest({version:first.version,steps:[{...steps[0],requirement:undefined},{...steps[1],requirement:'R2'}]})
  assert.deepEqual(second.cuj.checked,['R1','R2']);assert.equal(d.snapshot().repairs,0)
  // Cumulative coverage must not contaminate the latest execution evidence.
  assert.equal(d.evidence().runs.length,1)
  assert.equal(d.evidence().runs[0].actions.length,2)
  const changed=await d.test({source:source.replace('content','content')+'\n',steps:[{...steps[0],requirement:undefined},{...steps[1],requirement:'R2'}]})
  assert.deepEqual(changed.cuj.checked,['R2'])
 }finally{await rm(dir,{recursive:true,force:true})}
})

test('purely local cards omit irrelevant empty/failure tool probes but preserve explicit scenarios',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cardspec-scenarios-')),seen=[]
 try{
  const d=createDebugSession({artifactRoot:dir,runner:async(spec,opts)=>{seen.push(opts.scenarios);return runner(spec,opts)}})
  const first=await d.test({source,steps});assert.deepEqual(seen[0],['normal'])
  await d.retest({version:first.version,steps:[...steps,{op:'check',scenario:'failure'}]});assert.deepEqual(seen[1],['normal','failure'])
 }finally{await rm(dir,{recursive:true,force:true})}
})
test('cached identical failures count toward convergence without another browser run',()=>session(async d=>{
 await d.test({source,steps});await d.test({source,steps:wrong})
 const second=await d.test({source,steps:wrong})
 const third=await d.test({source,steps:wrong})
 assert.equal(third.convergence.stopped,true);assert.equal(d.canTest(),false)
 assert.equal(third.convergence.classification,'test_oracle_conflict')
 // The ledger changes once after the initial failure; subsequent repeats reuse
 // exact evidence but still must stop the no-progress loop.
 assert.equal(third.cached,true);assert.equal(d.snapshot().repairs,0)
 assert.equal(second.repairLane,'test')
}))

test('host restoration contract distinguishes a reload mutation expectation from real failed restoration',()=>{
 const oracle=createTestOracle(),step={op:'reload',expect:{changed:true,state:{input:7}}}
 const browser={status:'tested',runs:[{scenario:'normal',width:432,initial:{},final:{},actions:[{step,ok:true,changed:false,restored:true,assertion:{passed:false,failures:['unexpected feedback change','state.input did not equal expected value']}}]}]}
 const revised=structuredClone(browser),issues=oracle.inspect({},revised,{version:'v',contextHash:'c'})
 assert.equal(issues.length,1);assert.equal(issues[0].expected.changed,false)
 assert.equal(issues[0].expected.state.input,7);assert.deepEqual(revised.runs[0].actions[0].oracle.unresolvedFailures,['state.input did not equal expected value'])
 for(const alteration of [{restored:false},{resumedStateChanged:true},{step:{...step,waitMs:500}}]){
  const b=structuredClone(browser);Object.assign(b.runs[0].actions[0],alteration)
  assert.equal(oracle.inspect({},b,{version:'v',contextHash:'c'}).length,0)
 }
})
