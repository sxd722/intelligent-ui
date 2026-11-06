import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {generationSettings} from '../shared/cardspec/generation-settings.mjs'
import {generationLayout,appendGenerationContent} from '../shared/cardspec/generation-layout.mjs'
import {generationPolicy,createGenerationBudget} from '../server/cardspec/budget.mjs'
import {generationCallOptions} from '../server/cardspec/build-policy.mjs'
import {generateCard} from '../server/cardspec/generation.mjs'
import {handleCardSpec} from '../server/cardspec/handler.mjs'
import {createResearchSession} from '../server/research/session.mjs'
import {createDebugSession} from '../server/cardspec/debug-session.mjs'
import {createBuildWorkspace} from '../server/cardspec/build-workspace.mjs'

const source='<card><text>完成</text></card>'
const runner=async()=>({status:'tested',runs:[]})

test('extended is explicit and default budgets remain bounded',()=>{
 assert.equal(generationSettings({extendedGeneration:'true'}).extendedGeneration,undefined)
 assert.equal(generationSettings({extendedGeneration:true}).debugGeneration,true)
 assert.equal(generationPolicy('',{buildMode:'deep'}).modelCalls,18)
 let now=0
 const policy=generationPolicy('',{extendedGeneration:true,buildMode:'deep'})
 const budget=createGenerationBudget(policy,{now:()=>now})
 now=1000*60*60*24*30
 for(let i=0;i<100;i++){budget.model('plan');budget.read();budget.repair()}
 assert.equal(budget.remaining(),Infinity)
 assert.equal(budget.generationReserve(),1)
 assert.equal(JSON.parse(JSON.stringify(budget.snapshot())).deadline,null)
 assert.equal(budget.snapshot().modelCalls,100)
})

test('expanded single calls and workspace retain finite resource protections',()=>{
 const settings=generationSettings({extendedGeneration:true,buildMode:'deep'})
 const options=generationCallOptions(settings,{buildPhase:'unit',maxTokens:8192,maxReasoningCharacters:18000})
 assert.equal(options.maxTokens,32768);assert.equal(options.maxReasoningCharacters,undefined)
 assert.equal(options.reasoningEffort,'low')
 const layout=generationLayout('square','page',settings)
 assert.equal(appendGenerationContent('x'.repeat(24000),'x',layout).length,24001)
 assert.throws(()=>appendGenerationContent('x'.repeat(120000),'x',layout),{code:'GENERATION_CAPACITY'})
 assert.doesNotMatch(layout.instruction,/总正文至多约1200字/)
 const workspace=createBuildWorkspace(settings)
 workspace.write([{name:'main.cardspec',content:source+' '.repeat(25000)}])
 assert.throws(()=>workspace.write([{name:'big.cardspec',content:'x'.repeat(48001)}]),/size/)
})

test('extended generation repairs beyond eight attempts without dropping validation',async()=>{
 let calls=0
 const budget=createGenerationBudget(generationPolicy('',{extendedGeneration:true}))
 const result=await generateCard({input:{prompt:'完成任务'},view:{extendedGeneration:true},budget,signal:new AbortController().signal,debugRunner:runner,
  streamUpstream:async(m,o)=>{budget.model();calls++;assert.equal(o.extendedGeneration,true);o.onPiece({content:calls<=10?`<card><button onPress="missing${calls}">操作</button></card>`:source})}})
 assert.equal(calls,11);assert.equal(result.spec.context.extendedGeneration,true)
 assert.equal(result.spec.generationDebug.tests.at(-1).status,'passed')
})

test('extended testing remains discoverable after old model quota and advertises matching capacity',async()=>{
 const budget=createGenerationBudget(generationPolicy('',{extendedGeneration:true}))
 for(let i=0;i<30;i++)budget.model()
 const debug=createDebugSession({context:()=>({extendedGeneration:true}),budget,runner})
 const research=createResearchSession({budget,timeoutMs:Infinity})
 let round=0
 const result=await research.run(async(m,o)=>{
  if(!round++){
   assert.equal(o.tools.find(t=>t.function.name==='card_test').function.parameters.properties.source.maxLength,120000)
   return {message:{role:'assistant',tool_calls:[{id:'a',type:'function',function:{name:'card_test',arguments:JSON.stringify({source})}}]}}
  }
  return {message:{role:'assistant',content:source}}
 },[],{debugSession:debug,signal:new AbortController().signal})
 assert.equal(result,source)
})

test('disconnect cancels unbounded initial generation; no Infinity timer fires',async()=>{
 const res=new EventEmitter(),frames=[]
 res.writeHead=()=>{};res.flushHeaders=()=>{};res.write=s=>frames.push(s);res.end=()=>{res.writableEnded=true}
 let signal
 await handleCardSpec({},res,{extendedGeneration:true,toolsEnabled:false,messages:[{role:'user',content:'测试取消'}]}, {
  keyLoaded:true,model:'test',streamUpstream:async(m,o)=>{
   signal=o.signal;assert.equal(signal.aborted,false)
   await new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true});setTimeout(()=>res.emit('close'),15)})
  }
 })
 assert.equal(signal.aborted,true)
 assert.ok(frames.some(s=>s.includes('"status":"cancelled"')))
 assert.ok(frames.some(s=>s.includes('"timeoutMs":null')))
})
