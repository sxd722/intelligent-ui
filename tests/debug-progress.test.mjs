import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {createProgressLedger} from '../server/cardspec/debug-progress.mjs'
import {compactDebugHistory} from '../server/research/debug-context.mjs'
import {createDebugSession} from '../server/cardspec/debug-session.mjs'
import {createResearchSession} from '../server/research/session.mjs'
import {generateCard} from '../server/cardspec/generation.mjs'
import {buildDeepCard} from '../server/cardspec/deep-build.mjs'
const source='<card><state id="n" type="number" initial={0}/><button onPress="add">增加</button><text>{state.n}</text><action id="add"><increment target="n"/></action></card>'
const step={op:'click',name:'增加',requirement:'R1',expect:{state:{n:1}}}
const runner=async(_,{steps})=>({status:'tested',runs:[{scenario:'normal',width:432,initial:{state:{n:0},errors:[]},final:{errors:[],controls:[],coverage:[]},pageErrors:[],actions:steps.map(s=>({step:s,ok:true,changed:true,observed:{state:{n:1}},assertion:s.expect?{passed:s.expect.state?.n===1,failures:s.expect.state?.n===1?[]:['state.n did not equal expected value']}:undefined}))}]})
const record=(ids=[],extra={})=>({version:'v1',compiled:true,status:'partial',diagnostics:[],cujCoverage:{items:ids.map(id=>({id,kind:'interaction',status:'checked'}))},...extra})
test('partial, renamed source and alternating errors cannot evade stagnation; new requirements can',()=>{
 const p=createProgressLedger();p.observe(record(['R1']))
 p.observe(record(['R1'],{version:'v2'}));assert.equal(p.observe(record(['R1'],{status:'failed',diagnostics:[{severity:'error',code:'requirement_assertion',message:'different'}]})).stale,2)
 assert.equal(p.observe(record(['R1','R2'])).stale,0)
 p.observe(record(['R1','R2']));p.observe(record(['R1','R2']))
 assert.equal(p.observe(record(['R1','R2'])).stopped,true)
 assert.equal(p.observe(record(['R1','R2','R3']),'new-context').stopped,false)
})
test('real compile repair counts once, disappearance of runtime error without re-executing path does not',()=>{
 const p=createProgressLedger(),syntax={severity:'error',code:'syntax',message:'broken'}
 p.observe(record([],{compiled:false,status:'failed',diagnostics:[syntax]}))
 assert.equal(p.observe(record([],{version:'v2'})).resolvedErrors.length,1)
 p.observe(record([],{version:'v3',compiled:false,diagnostics:[syntax]}))
 assert.equal(p.observe(record([],{version:'v4'})).resolvedErrors.length,0)
 p.observe(record([],{version:'v5',diagnostics:[{severity:'error',code:'debug_runtime',message:'boom'}]}))
 assert.equal(p.observe(record([],{version:'v6'})).resolvedErrors.length,0)
})
test('history compression preserves task, tools, latest reasoning pair and one exact source; is bounded across repeats',()=>{
 const base=[{role:'system',content:'contract'},{role:'user',content:'full user requirements'}]
 const call=(id,tool,args)=>({role:'assistant',reasoning_content:'r'.repeat(10000),tool_calls:[{id,function:{name:tool,arguments:JSON.stringify(args)}}]})
 const tool=id=>({role:'tool',tool_call_id:id,content:'{"status":"partial"}'})
 const live=[call('b','card_retest',{version:'v'}),tool('b')]
 const h=[...base,call('a','card_test',{source:'x'.repeat(3000)}),tool('a'),{role:'user',content:'tool evidence remains'},...live]
 const result=compactDebugHistory(h,2,{source:'current',candidateVersion:'v'})
 assert.ok(result.afterCharacters<result.beforeCharacters);assert.deepEqual(h.slice(-2),live);assert.deepEqual(h.slice(0,2),base)
 assert.ok(h.some(x=>x.content==='tool evidence remains'))
 h.push(call('c','card_retest',{version:'v'}),tool('c'));compactDebugHistory(h,2,{source:'current',candidateVersion:'v'})
 assert.equal(h.filter(x=>x.content?.startsWith('宿主调试检查点（')).length,1)
 assert.equal(h.filter(x=>x.role==='tool').length,1)
})
test('research stops before another model, preserves best source and returns honest pending tasks',async()=>{
 const root=await mkdtemp(join(tmpdir(),'debug-progress-'));try{
  const context={userGoal:'点击增加得到新计数。\n点击返回恢复桌面。',extendedGeneration:true}
  const d=createDebugSession({artifactRoot:root,context:()=>context,runner});const research=createResearchSession();let models=0,v
  const result=await research.run(async()=>{models++;return {message:{role:'assistant',tool_calls:[{id:'t'+models,function:{name:models===1?'card_test':'card_retest',arguments:JSON.stringify(models===1?{source,steps:[step]}:{version:v,steps:[step]})}}]}}} ,[],{debugSession:{...d,test:async x=>{const r=await d.test(x);v=r.version;return r}},onPiece:()=>{}})
  assert.equal(models,4);assert.equal(result,source);assert.equal(d.stopResult().status,'partial');assert.ok(d.stopResult().remainingTasks.some(t=>t.requirement==='R2'))
  const final=await d.test({source},{final:true});assert.equal(final.retained,true);assert.equal(final.status,'partial')
 }finally{await rm(root,{recursive:true,force:true})}
})
test('failed later drafts cannot replace best or hide their local tasks; changed context invalidates retention',async()=>{
 const root=await mkdtemp(join(tmpdir(),'debug-best-'));try{
  let context={userGoal:'点击增加得到计数。',extendedGeneration:true}
  const d=createDebugSession({artifactRoot:root,context:()=>context,runner})
  await d.test({source,steps:[step]})
  for(let i=0;i<3;i++)await d.test({source:source+'\n'.repeat(i+1),steps:[{...step,expect:{state:{n:10+i}}}]})
  const best=d.stopResult();assert.equal(best.source,source);assert.ok(best.remainingTasks.some(t=>t.lane==='behavior-review'))
  context={...context,userGoal:'a different request'};assert.equal(d.stopResult(),null)
 }finally{await rm(root,{recursive:true,force:true})}
})
test('invalid requests count as stagnation and cannot produce an unverified delivery',async()=>{
 const root=await mkdtemp(join(tmpdir(),'debug-invalid-'));try{
  const d=createDebugSession({artifactRoot:root,runner});for(let i=0;i<4;i++)await d.rejectRequest('invalid steps '+i)
  assert.equal(d.stopResult().source,undefined);assert.equal(d.canTest(),false)
 }finally{await rm(root,{recursive:true,force:true})}
})
test('host repairs only reload mutation expectation, reruns same source, retains unrelated failures',async()=>{
 const root=await mkdtemp(join(tmpdir(),'debug-host-'));try{
  let calls=0
  const d=createDebugSession({artifactRoot:root,runner:async(_,{steps})=>{calls++;return {status:'tested',runs:[{scenario:'normal',width:432,initial:{state:{n:0},errors:[]},final:{errors:[],controls:[],coverage:[]},pageErrors:[],actions:steps.map(s=>({step:s,ok:true,restored:true,changed:false,observed:{state:{n:0}},assertion:{passed:s.expect.changed===false,failures:s.expect.changed?['unexpected feedback change']:[]}}))}]}}})
  const bad=await d.test({source,steps:[{op:'reload',expect:{changed:true,state:{n:0}}}]});assert.equal(bad.repairLane,'test')
  const fixed=await d.hostRepair();assert.equal(fixed.hostRepair.verified,true);assert.equal(calls,2);assert.equal(fixed.hostRepair.sourceChanged,false)
  assert.equal(d.commit({version:fixed.version}).source,source);assert.equal(await d.hostRepair(),null)
 }finally{await rm(root,{recursive:true,force:true})}
})
test('normal generation delivers retained source with partial scope and local tasks, no outer repair loop',async()=>{
 let calls=0,version;const research=createResearchSession()
 const result=await generateCard({input:{prompt:'点击增加得到新计数。\n点击返回恢复桌面。'},view:{debugGeneration:true,extendedGeneration:true},signal:new AbortController().signal,debugRunner:runner,streamUpstream:(messages,options)=>research.run(async()=>{
  calls++;return {message:{role:'assistant',tool_calls:[{id:'s'+calls,function:{name:calls===1?'card_test':'card_retest',arguments:JSON.stringify(calls===1?{source,steps:[step]}:{version,steps:[step]})}}]}}}
 ,messages,{...options,debugSession:{...options.debugSession,test:async(...args)=>{const r=await options.debugSession.test(...args);version=r.version;return r}}})})
 assert.equal(calls,4);assert.equal(result.source,source);assert.equal(result.spec.verificationStatus,'partial');assert.ok(result.spec.remainingTasks.length);assert.equal(result.repairCount,0)
})
test('deep mode retains an asserted usable module when another requirement stalls',async()=>{
 const context={buildMode:'deep',renderMode:'native',expressionDialect:'js-v1',extendedGeneration:true},root=await mkdtemp(join(tmpdir(),'deep-progress-'))
 try{
  const debug=createDebugSession({context:()=>context,artifactRoot:root,runner:async(spec,o)=>{
   const r=await runner(spec,o);for(const a of r.runs[0].actions)if(a.step.name?.startsWith('查看历史')){a.ok=false;a.assertion=undefined;a.error='not found'}return r
  }})
  let calls=0
  const result=await buildDeepCard({input:{prompt:'点击增加显示计数；点击查看历史'},context,debug,cardId:'test-progress-best-deep',streamUpstream:async(m,o)=>{
   calls++;const out=calls===1?{requirements:[{id:'R1',kind:'interaction',acceptance:'增加后计数变化'},{id:'R2',kind:'interaction',acceptance:'查看历史显示记录'}],modules:[{name:'main.cardspec'}],interfaces:'n'}:calls===2?{op:'write',files:[{name:'main.cardspec',content:source}],claims:[{id:'R1',modules:['main.cardspec']},{id:'R2',modules:['main.cardspec']}]}:{op:'test',steps:calls===3?[step]:[{op:'click',name:'查看历史'+calls,requirement:'R2',expect:{text:'记录'}}]}
   o.onPiece({content:JSON.stringify(out)})
  }})
  assert.ok(result.build.retained);assert.equal(result.feedback.status,'partial');assert.ok(result.build.remainingTasks.some(t=>t.requirement==='R2'));assert.ok(calls<11)
 }finally{await rm(root,{recursive:true,force:true})}
})
test('model output truncation retains the usable version without another model or code rewrite',async()=>{
 const root=await mkdtemp(join(tmpdir(),'debug-truncate-'));try{
  const d=createDebugSession({artifactRoot:root,runner});await d.test({source,steps:[step]})
  const session=createResearchSession();let calls=0
  const result=await session.run(async()=>{calls++;throw Object.assign(Error('truncated'),{code:'OUTPUT_TRUNCATED'})},[],{debugSession:d,onPiece:()=>{}})
  assert.equal(calls,1);assert.equal(result,source);assert.equal(d.stopResult().reason,'model_output_truncated');assert.ok(d.stopResult().remainingTasks.some(t=>t.target==='model-output'))
 }finally{await rm(root,{recursive:true,force:true})}
})
test('test-lane compact checkpoint omits source with exact on-demand retrieval and rejects stale contexts',async()=>{
 const root=await mkdtemp(join(tmpdir(),'debug-source-'));try{
  let context={userGoal:'点击增加'};const d=createDebugSession({artifactRoot:root,context:()=>context,runner})
  const saved=await d.test({source,steps:[step]});assert.equal(d.readSource({version:saved.version}).source,source)
  const history=[{role:'user',content:'goal'},...Array.from({length:3},(_,i)=>[{role:'assistant',reasoning_content:'r'.repeat(4000),tool_calls:[{id:'a'+i,function:{name:'card_retest',arguments:'{}'}}]},{role:'tool',tool_call_id:'a'+i,content:'{}'}]).flat()]
  const reduction=compactDebugHistory(history,1,d.contextSnapshot());assert.ok(reduction)
  assert.ok(!history[1].content.includes('<card>'));assert.ok(history[1].content.includes('card_source'))
  context={userGoal:'different'};assert.throws(()=>d.readSource({version:saved.version}),/stale/)
 }finally{await rm(root,{recursive:true,force:true})}
})
test('prose final after successful testing is resolved by host, not another code generation',async()=>{
 const root=await mkdtemp(join(tmpdir(),'debug-prose-'));try{
  const d=createDebugSession({artifactRoot:root,runner});await d.test({source,steps:[step]});let calls=0
  const result=await createResearchSession().run(async()=>{calls++;return {message:{role:'assistant',content:'测试完成，可以交付。'}}},[],{debugSession:d})
  assert.equal(calls,1);assert.equal(result,source);assert.equal(d.stopResult().reason,'model_omitted_submission');assert.equal(d.stopResult().status,'partial')
 }finally{await rm(root,{recursive:true,force:true})}
})
test('verified interactive prefixes survive later locator failures and malformed test requests',async()=>{
 const root=await mkdtemp(join(tmpdir(),'debug-prefix-'));try{
  const d=createDebugSession({artifactRoot:root,runner:async(spec,o)=>{
   const r=await runner(spec,o);r.runs[0].actions[1]={step:o.steps[1],ok:false,error:'covered by modal'};return r
  }})
  const first=await d.test({source,steps:[step,{op:'click',name:'behind modal'}]})
  assert.equal(first.status,'partial')
  for(let i=0;i<3;i++)await d.rejectRequest('invalid test '+i)
  const kept=d.stopResult();assert.equal(kept.source,source);assert.equal(kept.selection,'verified-prefix');assert.deepEqual(kept.prefixSteps,[1])
  assert.ok(kept.remainingTasks.some(t=>t.code==='debug_test_step'));assert.ok(kept.remainingTasks.some(t=>t.code==='debug_request'))
  assert.equal((await d.test({source},{final:true})).status,'partial')
 }finally{await rm(root,{recursive:true,force:true})}
})
test('prefix retention does not waive failed business assertions or missing prefixes in another viewport',async()=>{
 const root=await mkdtemp(join(tmpdir(),'debug-prefix-negative-'));try{
  for(const kind of ['assertion','viewport']){
   const d=createDebugSession({artifactRoot:root,runner:async(spec,o)=>{
    const r=await runner(spec,o)
    if(kind==='assertion')r.runs[0].actions[1].assertion={passed:false,failures:['wrong total']}
    else {r.runs[0].actions[1]={step:o.steps[1],ok:false,error:'covered'};r.runs.push({...r.runs[0],width:320,actions:[{step:o.steps[0],ok:false,error:'not found'}]})}
    return r
   }})
   await d.test({source,steps:[step,step]});for(let i=0;i<3;i++)await d.rejectRequest('invalid test '+i)
   assert.equal(d.stopResult()?.source,undefined)
  }
 }finally{await rm(root,{recursive:true,force:true})}
})
