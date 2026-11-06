import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {createBuildConvergence,createBuildEvidenceLedger} from '../server/cardspec/build-convergence.mjs'
import {installDebugRandom} from '../server/cardspec/debug-random.mjs'
import {requirementAudit} from '../server/cardspec/requirements.mjs'
import {buildDeepCard} from '../server/cardspec/deep-build.mjs'
import {createDebugSession} from '../server/cardspec/debug-session.mjs'

// Positive evidence must name the result, not merely observe any UI change.
const step=(id='R1')=>({op:'click',name:'增加',requirement:id,expect:{changed:true,state:{n:1}}})
const action=s=>({step:s,ok:true,changed:true,assertion:{passed:true}})
const evidence=(steps,bad=false)=>({runs:[320,432].map(width=>({scenario:'normal',width,actions:steps.map((s,i)=>bad&&width===320&&i===steps.length-1?{...action(s),assertion:{passed:false}}:action(s))}))})

test('generic changed-only observation is still insufficient for requirement acceptance',()=>{
 const s={...step(),expect:{changed:true}}
 assert.equal(requirementAudit([{id:'R1',kind:'interaction'}],[{id:'R1',modules:['main.cardspec']}],{actions:[action(s)]}).status,'partial')
})

test('new hashes, alternating phases, and changed error prose do not reset semantic stagnation',()=>{
 const monitor=createBuildConvergence({patience:4})
 let result
 for(let i=0;i<5;i++)result=monitor.observe({units:5,feedback:{phase:i%2?'test':'implementation',version:'new'+i,diagnostics:[{severity:'error',code:'parse',message:'wording'+i}],layout:[]}})
 assert.equal(result.stop,true)
 assert.equal(monitor.observe({units:5,audit:{items:[{status:'checked'}]},feedback:{}}).stop,false)
})

test('substantial overflow improvement counts, tiny metric jitter does not',()=>{
 const monitor=createBuildConvergence({patience:3})
 const f=n=>({feedback:{layout:[{code:'clipped-content',overflow:n}]}})
 monitor.observe(f(100));assert.equal(monitor.observe(f(70)).improved,true)
 monitor.observe(f(69));monitor.observe(f(70));assert.equal(monitor.observe(f(71)).stop,true)
})

test('seeded random is reproducible without mutating host Math or UUID',()=>{
 const run=seed=>vm.runInNewContext(`(${installDebugRandom.toString()})(${seed});Array.from({length:8},()=>Math.random())`)
 const original=Math.random
 assert.equal(JSON.stringify(run(71)),JSON.stringify(run(71)))
 assert.notEqual(JSON.stringify(run(71)),JSON.stringify(run(72)))
 assert.equal(Math.random,original)
})

test('coverage accumulates on same source, discovery preserves it, new source requires complete replay',()=>{
 const ledger=createBuildEvidenceLedger(),s1=step(),s2=step('R2')
 ledger.record('a',[s1],evidence([s1]));ledger.record('a',[s2],evidence([s2]))
 ledger.record('a',[{op:'check'}],evidence([{op:'check'}]))
 assert.deepEqual(ledger.summary().verified,['R1','R2'])
 assert.equal(ledger.pending('b').length,2);assert.equal(ledger.actions().length,0)
 ledger.record('b',[s1],evidence([s1],true))
 assert.equal(ledger.summary().verified.length,0)
 ledger.record('b',[s2],evidence([s2]));assert.deepEqual(ledger.summary().verified,['R2'])
})

test('failed navigation or a single failing viewport cannot count as verified',()=>{
 const ledger=createBuildEvidenceLedger(),steps=[{op:'click',name:'进入'},step()]
 const e=evidence(steps);e.runs[0].actions[0].ok=false
 ledger.record('a',steps,e);assert.equal(ledger.actions().length,0)
 ledger.record('a',steps,evidence(steps));assert.equal(ledger.summary().verified.length,1)
 ledger.record('a',steps,evidence(steps,true));assert.equal(ledger.actions().length,0)
 const runtime=evidence(steps);runtime.runs[1].pageErrors=['uncaught runtime failure']
 ledger.record('a',steps,runtime);assert.equal(ledger.actions().length,0)
})

test('regression keeps full prefixes, coalesces overlapping paths and preserves action proof after check',()=>{
 const ledger=createBuildEvidenceLedger(),s1=step(),s2=step('R2')
 ledger.record('a',[s1,s2],evidence([s1,s2]))
 const check={op:'check',requirement:'R1',expect:{text:'结果'}}
 ledger.record('a',[check],evidence([check]))
 const audit=requirementAudit([{id:'R1',kind:'interaction'}],[{id:'R1',modules:['main.cardspec']}],{actions:ledger.actions()})
 assert.equal(audit.status,'checked')
 assert.deepEqual(ledger.pending('b'),[[s1,s2]])
})

test('extended deep builds stop changing selector guesses without escalating model budgets',async()=>{
 const context={buildMode:'deep',renderMode:'native',extendedGeneration:true}
 const debug=createDebugSession({context:()=>context,runner:async(_spec,{steps})=>({status:'tested',runs:[{scenario:'normal',width:432,initial:{errors:[]},final:{errors:[],controls:[],coverage:[]},pageErrors:[],actions:steps.map(s=>({step:s,ok:false,error:'not present'}))}]})})
 let calls=0
 await assert.rejects(buildDeepCard({input:{prompt:'计数交互'},context,debug,cardId:'test-convergence-extended',streamUpstream:async(_m,o)=>{
  calls++
  const response=calls===1?{requirements:[{id:'R1',kind:'interaction',acceptance:'增加后计数变化'}],modules:[{name:'main.cardspec'}],interfaces:'main持有计数状态与增加动作'}:calls===2?{op:'write',files:[{name:'main.cardspec',content:'<card><text>占位</text></card>'}],claims:[{id:'R1',modules:['main.cardspec']}]}:{op:'test',steps:[{op:'click',name:'不断改名'+calls,requirement:'R1',expect:{changed:true}}]}
  o.onPiece({content:JSON.stringify(response)})
 }}),e=>e.code==='BUILD_STALLED'&&/未增加/.test(e.message))
 assert.ok(calls<=11,`calls=${calls}`)
})

test('independent failure evidence resumes implementation, without pretending it passed',async()=>{
 const context={buildMode:'deep',renderMode:'native'},goal='计数交互',controller=new AbortController()
 const resume={goal,plan:{requirements:[{id:'R1',kind:'interaction',acceptance:'增加后计数变化'}],modules:[{name:'main.cardspec',purpose:'计数交互'}],interfaces:'main持有计数'},workspace:{'main.cardspec':{content:'<card><text>计数</text></card>'}},reviewDiagnostics:[{module:'main.cardspec',message:'独立操作后计数没有改变',evidence:'qa/counter/evidence.json'}]}
 const debug=createDebugSession({context:()=>context,runner:async()=>({status:'tested',runs:[{scenario:'normal',width:432,initial:{errors:[]},final:{errors:[],controls:[]},actions:[],pageErrors:[]}]})})
 let observed
 await assert.rejects(buildDeepCard({input:{prompt:goal},context,debug,resume,cardId:'test-independent-review',signal:controller.signal,streamUpstream:async(m,o)=>{
  observed={body:JSON.parse(m[1].content),phase:o.buildPhase};controller.abort();throw controller.signal.reason
 }}))
 assert.equal(observed.phase,'implementation')
 assert.ok(JSON.stringify(observed.body).includes('独立操作后计数没有改变'))
 assert.ok(JSON.stringify(observed.body).includes('independent_review'))
 assert.equal(observed.body.coverage,undefined)
 resume.reviewDiagnostics[0].module='../other'
 await assert.rejects(buildDeepCard({input:{prompt:goal},context,debug,resume,cardId:'test-independent-review-invalid',streamUpstream:async()=>{throw Error('must not call model')}}),/invalid independent build review/)
})

test('deep build repairs code then replays passed requirements before accepting a separate new flow',async()=>{
 const context={buildMode:'deep',renderMode:'native',extendedGeneration:true},claim=id=>({id,modules:['main.cardspec']})
 let calls=0,replays=0
 const a=step('R1'),b=step('R2')
 const debug=createDebugSession({context:()=>context,runner:async(spec,{steps})=>{
  const fixed=JSON.stringify(spec).includes('ready')
  if(fixed&&steps.length===1&&steps[0].requirement==='R1')replays++
  return {status:'tested',runs:[320,432].map(width=>({scenario:'normal',width,initial:{errors:[]},final:{errors:[],controls:[],coverage:[]},pageErrors:[],actions:steps.map(s=>({...action(s),assertion:{passed:!s.requirement||s.requirement==='R1'||fixed,failures:fixed?[]:['view did not change']}}))}))}
 }})
 const result=await buildDeepCard({input:{prompt:'计数交互，切换视图'},context,debug,cardId:'test-convergence-replay',streamUpstream:async(m,o)=>{
  const body=JSON.parse(m[1].content);let response
  switch(++calls){
   case 1:response={requirements:[{id:'R1',kind:'interaction',acceptance:'计数改变'},{id:'R2',kind:'interaction',acceptance:'视图改变'}],modules:[{name:'main.cardspec'}],interfaces:'main持有状态'};break
   case 2:response={op:'write',files:[{name:'main.cardspec',content:'<card><text>broken</text></card>'}],claims:[claim('R1'),claim('R2')]};break
   case 3:response={op:'test',steps:[a,b]};break
   case 4:response={op:'implementation_issue',module:'main.cardspec',reason:'点击第二个操作后视图未改变，与切换需求相违背',stepIndex:1};break
   case 5:response={op:'patch',name:'main.cardspec',version:body.files[0].version,edits:[{old:'broken',new:'ready'}]};break
   case 6:assert.deepEqual(body.retainedEvidence.verified,['R1']);response={op:'test',steps:[b]};break
   default:throw Error('Unexpected model call '+calls)
  }
  o.onPiece({content:JSON.stringify(response)})
 }})
 assert.equal(result.coverage.status,'checked');assert.equal(calls,6);assert.equal(replays,1)
})
