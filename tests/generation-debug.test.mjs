import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createDebugSession,validateDebugInput} from '../server/cardspec/debug-session.mjs'
import {createDebugTransport} from '../shared/cardspec/debug-fixtures.mjs'
import {createGenerationBudget,generationPolicy} from '../server/cardspec/budget.mjs'
import {generateCard} from '../server/cardspec/generation.mjs'
import {createResearchSession} from '../server/research/session.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'

const good='<card><state id="n" type="number" initial={0}/><button onPress="inc">增加</button><text>{state.n}</text><action id="inc"><increment target="n"/></action></card>'
const broken='<card><button onPress="missing">增加</button></card>'
const signal=new AbortController().signal
const tested=(errors=[])=>({status:'tested',runs:[{scenario:'normal',initial:{errors:[]},final:{errors,controls:[],coverage:[]},actions:[],pageErrors:[]}]})
test('a final valid source still gets validated after the tool repair budget is exhausted',async()=>{
 const d=createDebugSession({runner:async()=>tested()})
 await d.test({source:broken});await d.test({source:broken+'\n'})
 assert.equal(d.snapshot().repairs,1)
 const final=await d.test({source:good},{final:true});assert.equal(final.status,'passed');assert.equal(d.snapshot().repairs,1)
})

test('layout warnings finish a usable candidate with explicit partial audit, without another repair',async()=>{
 let calls=0
 const runner=async()=>{const r=tested();r.runs[0].width=320;r.runs[0].final.layout={issues:[{code:'internal-overflow',element:'body',available:150,demand:160}]};return r}
 const result=await generateCard({signal,catalog:[],input:{prompt:'计数器'},view:{debugGeneration:true},debugRunner:runner,streamUpstream:async(_m,o)=>{calls++;o.onPiece({content:good})}})
 assert.equal(calls,1);assert.ok(result.spec);assert.equal(result.spec.generationDebug.tests.at(-1).status,'partial')
 assert.ok(result.diagnostics.some(d=>d.code==='debug_layout'))
})

test('debug step contract forbids script, selectors and unbounded inputs',()=>{
 assert.throws(()=>validateDebugInput({source:good,steps:[{op:'eval',value:'fetch()'}]}))
 assert.throws(()=>validateDebugInput({source:good,steps:[{op:'click',name:'增加',selector:'body'}]}))
 assert.throws(()=>validateDebugInput({source:good,steps:Array(9).fill({op:'reload'})}))
 assert.equal(validateDebugInput({source:good,steps:[{op:'reload'}]}).steps.length,1)
})
test('mock transport validates arguments and never executes write, GLM or unknown tools',async()=>{
 const calls=[],coverage=[],transport=createDebugTransport({calls,coverage})
 const a=await transport({tool:'autocli.hackernews.top',input:{limit:2},target:'binding'},signal)
 assert.equal(a.value.source,'DEBUG_MOCK_NOT_EVIDENCE');assert.equal(a.value.items.length,2)
 await assert.rejects(transport({tool:'glm.generate',input:{prompt:'x'},target:'page'},signal),/DEBUG_UNSUPPORTED/)
 await assert.rejects(transport({tool:'unknown',input:{},target:'binding'},signal))
 const empty=await createDebugTransport({scenario:'empty'})({tool:'autocli.hackernews.top',input:{},target:'binding'},signal)
 assert.deepEqual(empty.value.items,[])
 await assert.rejects(createDebugTransport({scenario:'failure'})({tool:'autocli.hackernews.top',input:{},target:'binding'},signal),/SIMULATED/)
 assert.equal(coverage.length,1)
})
test('debug caches candidates, retains steps and enforces one shared repair budget',async()=>{
 const artifactRoot=await mkdtemp(join(tmpdir(),'cardspec-debug-test-'));let runs=0
 try{
  const budget=createGenerationBudget(generationPolicy('counter',{debugGeneration:true}))
  const d=createDebugSession({artifactRoot,budget,runner:async()=>{runs++;return tested()}})
  assert.equal((await d.test({source:broken})).status,'failed');assert.equal(runs,0)
  assert.equal((await d.test({source:broken})).cached,true)
  const steps=[{op:'click',name:'增加'},{op:'click',name:'增加'},{op:'reload'}]
  assert.equal((await d.test({source:good,steps})).status,'passed')
  assert.equal(budget.snapshot().repairs,1)
  const final=await d.test({source:good},{final:true});assert.equal(final.status,'passed')
  assert.deepEqual(d.snapshot().tests.at(-1).steps,steps)
  for(let i=1;i<budget.policy.repairs;i++)d.repair()
  assert.throws(()=>d.repair(),/次数/)
 }finally{assert.ok(artifactRoot.startsWith(join(tmpdir(),'cardspec-debug-test-')));await rm(artifactRoot,{recursive:true,force:true})}
})
test('generation repairs renderer errors, retains production state and leaves mock values out',async()=>{
 let models=0,tests=0;const specs=[]
 const result=await generateCard({input:{prompt:'counter'},view:{debugGeneration:true,generationMode:'direct'},signal,
  streamUpstream:async(m,o)=>{models++;o.onPiece({content:good+(models>1?'\n':'')})},
  debugRunner:async spec=>{tests++;specs.push(spec);return tested(tests===1?['bad widget transition']:[])}})
 assert.equal(models,2);assert.equal(result.repairCount,1);assert.equal(result.spec.state.n.initial.value,0)
 assert.equal(result.spec.generationDebug.tests.at(-1).status,'passed')
 assert.equal(JSON.stringify(result.spec).includes('DEBUG_MOCK_NOT_EVIDENCE'),false)
})
test('repeated failed final candidate stops, infrastructure failure does not trigger another model',async()=>{
 let models=0
 await assert.rejects(generateCard({input:{prompt:'counter'},view:{debugGeneration:true},signal,streamUpstream:async(m,o)=>{models++;o.onPiece({content:good})},debugRunner:async()=>tested(['always fails'])}),/运行调试/)
 assert.equal(models,2)
 models=0
 const result=await generateCard({input:{prompt:'counter'},view:{debugGeneration:true},signal,streamUpstream:async(m,o)=>{models++;o.onPiece({content:good})},debugRunner:async()=>({status:'unverified',reason:'browser absent',runs:[]})})
 assert.equal(models,1);assert.equal(result.spec.generationDebug.tests[0].status,'unverified')
})
test('research offers debug without CLI and preserves no fake evidence or datasets',async()=>{
 let count=0;const budget=createGenerationBudget(generationPolicy('counter',{debugGeneration:true}))
 const research=createResearchSession({budget,extensions:createGenerationTools({enabled:false,allowPlanning:false})})
 const result=await generateCard({budget,research,input:{prompt:'counter'},view:{debugGeneration:true},signal,debugRunner:async()=>tested(),
 streamUpstream:(messages,options)=>research.run(async(m,o)=>{
  count++
  if(count===1){assert.ok(o.tools.some(t=>t.function.name==='card_test'));return {message:{role:'assistant',tool_calls:[{id:'test',function:{name:'card_test',arguments:JSON.stringify({source:good,steps:[{op:'click',name:'增加'}]})}}]}}}
  assert.ok(m.some(x=>x.role==='tool'&&JSON.parse(x.content).status==='passed'));return {message:{content:good}}
 },messages,options)})
 assert.equal(result.spec.research.modelCalls,2);assert.equal(result.spec.research.calls,0)
 assert.deepEqual(result.spec.research.evidence,[]);assert.deepEqual(result.spec.prefetched,[])
 assert.equal(budget.snapshot().modelCalls,2)
})
test('debug disabled retains the existing generation path',async()=>{
 let runs=0
 const result=await generateCard({input:{prompt:'counter'},view:{debugGeneration:false},signal,streamUpstream:async(m,o)=>{assert.equal(o.debugSession,null);o.onPiece({content:good})},debugRunner:async()=>{runs++;return tested()}})
 assert.equal(runs,0);assert.equal(result.spec.generationDebug,undefined)
})
test('cancelled debug never starts browser or consumes repair',async()=>{
 const controller=new AbortController();controller.abort(Error('user cancelled'));let runs=0
 const d=createDebugSession({runner:async()=>{runs++;return tested()}})
 await assert.rejects(d.test({source:good},{signal:controller.signal}),/user cancelled/)
 assert.equal(runs,0);assert.equal(d.snapshot().repairs,0)
})
test('debug reserves bounded repairs while leaving budget for tool tests',()=>{
 const budget=createGenerationBudget(generationPolicy('多步模拟器',{profile:'adaptive-v1',debugGeneration:true}))
 assert.equal(budget.policy.repairs,8);assert.equal(budget.policy.timeoutMs,900000)
 for(let i=0;i<15;i++)budget.model('generate')
 assert.equal(budget.generationReserve(),9)
 assert.throws(()=>budget.model('analyze'),/预留/)
 for(let i=0;i<8;i++){budget.repair();budget.model()}
 budget.model();assert.equal(budget.snapshot().modelCalls,24)
 assert.throws(()=>budget.repair(),/修复预算/);assert.throws(()=>budget.model(),/模型调用预算/)
})

test('commit returns immutable tested source without another render or output rewrite',async()=>{
 let models=0,renders=0,version
 const research=createResearchSession()
 const result=await generateCard({research,input:{prompt:'counter'},view:{debugGeneration:true},signal,debugRunner:async()=>{renders++;return tested()},
  streamUpstream:(messages,options)=>research.run(async(m,o)=>{
   models++
   if(models===1)return {message:{tool_calls:[{id:'t',function:{name:'card_test',arguments:JSON.stringify({source:good})}}]}}
   const feedback=JSON.parse(m.findLast(x=>x.role==='tool').content);version=feedback.version
   assert.ok(o.tools.some(t=>t.function.name==='card_commit'))
   return {message:{content:'This commentary must not become source.',tool_calls:[{id:'c',function:{name:'card_commit',arguments:JSON.stringify({version})}}]}}
  },messages,options)})
 assert.equal(result.source,good);assert.equal(result.repairCount,0)
 assert.equal(models,2);assert.equal(renders,1)
 assert.equal(result.spec.generationDebug.committed.version,version)
 assert.equal(result.spec.generationDebug.tests.length,1)
})

test('commit rejects unknown, failed, unverified, cross-session and stale-context versions',async()=>{
 let ctx={localDate:'2026-10-22'}
 const d=createDebugSession({context:()=>ctx,runner:async()=>tested()})
 const failed=await d.test({source:broken});assert.throws(()=>d.commit({version:failed.version}),/failed/)
 const valid=await d.test({source:good})
 assert.throws(()=>d.commit({version:valid.version,source:broken}),/only/)
 assert.throws(()=>createDebugSession().commit({version:valid.version}),/unknown/)
 ctx={localDate:'2026-10-23'};assert.throws(()=>d.commit({version:valid.version}),/context changed/)
 const unavailable=createDebugSession({runner:async()=>({status:'unverified',runs:[],reason:'browser missing'})})
 const u=await unavailable.test({source:good});assert.throws(()=>unavailable.commit({version:u.version}),/unverified/)
})

test('mixed commit and tool calls execute neither and permit a standalone retry',async()=>{
 let count=0,version,reads=0
 const debug=createDebugSession({runner:async()=>tested()})
 version=(await debug.test({source:good})).version
 const research=createResearchSession({extensions:{tools:()=>[{type:'function',function:{name:'cli_read'}}],execute:()=>{reads++;return {}},context:()=>[]}})
 const output=await research.run(async()=>({message:{tool_calls:++count===1?
  [{id:'c',function:{name:'card_commit',arguments:JSON.stringify({version})}},{id:'r',function:{name:'cli_read',arguments:'{}'}}]:
  [{id:'c2',function:{name:'card_commit',arguments:JSON.stringify({version})}}]}}),[],{debugSession:debug,signal})
 assert.equal(output,good);assert.equal(reads,0);assert.equal(count,2)
})

test('locator failures stay test-plan warnings even when replaying a retained path',async()=>{
 let calls=0
 const runner=async()=>{
  const r=tested();r.runs[0].actions=[++calls===1?{step:{op:'click',name:'增加'},ok:true,changed:true}:{step:{op:'click',name:'增加'},ok:false,error:'target hidden',classification:'test_plan'}];return r
 }
 const d=createDebugSession({runner})
 await d.test({source:good,steps:[{op:'click',name:'增加'}]})
 const feedback=await d.test({source:good+'\n'},{final:true})
 assert.equal(feedback.status,'partial');assert.equal(d.snapshot().repairs,0)
 assert.ok(feedback.diagnostics.every(x=>x.severity!=='error'))
 const committed=d.commit({version:feedback.version});assert.equal(committed.status,'partial')
})

test('state restoration errors remain product failures in empty and failure scenarios',async()=>{
 const d=createDebugSession({runner:async()=>{const r=tested();r.runs[0].scenario='empty';r.runs[0].actions=[{step:{op:'reload'},ok:true,restored:false}];return r}})
 const feedback=await d.test({source:good});assert.equal(feedback.status,'failed')
 assert.ok(feedback.diagnostics.some(d=>d.code==='debug_interaction'&&d.severity==='error'))
})

test('a different tested path cannot replace the retained successful flow on final publication',async()=>{
 const paths=[],d=createDebugSession({runner:async(spec,{steps})=>{paths.push(steps);const r=tested();r.runs[0].actions=steps.map(step=>({step,ok:true,changed:true}));return r}})
 const flow=[{op:'click',name:'增加'},{op:'reload'}]
 await d.test({source:good,steps:flow})
 await d.test({source:good+'\n',steps:[{op:'reload'}]})
 await d.test({source:good+'\n'},{final:true})
 assert.equal(paths.length,3);assert.deepEqual(paths[2],flow)
})

test('debug can repair four distinct failing candidates before succeeding',async()=>{
 let models=0;const prompts=[]
 const budget=createGenerationBudget(generationPolicy('counter',{debugGeneration:true}))
 const result=await generateCard({budget,input:{prompt:'counter'},view:{debugGeneration:true},signal,debugRunner:async()=>tested(),
  streamUpstream:async(m,o)=>{prompts.push(structuredClone(m));models++;o.onPiece({content:models<5?`<card>\n<button onPress="absent${models}">增加</button>\n</card>`:good})}})
 assert.equal(models,5);assert.equal(result.repairCount,4);assert.equal(result.source,good)
 assert.match(prompts[1].at(-1).content,/context/);assert.match(prompts[1].at(-1).content,/onPress/);assert.equal(prompts[4].length,prompts[1].length);assert.equal(prompts[4].filter(m=>m.role==='assistant').length,1)
})
