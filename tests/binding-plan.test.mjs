import test from 'node:test'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {bindingRecipe,bindingPlanDiagnostics} from '../server/cardspec/binding-plan.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {generationToolDisclosure} from '../server/cardspec/tool-disclosure.mjs'
import {createResearchSession} from '../server/research/session.mjs'
import {generateCard} from '../server/cardspec/generation.mjs'
import {TOOLS} from '../shared/cardspec/tools.mjs'
import {createCardSession} from '../src/cardspec/tool-session.mjs'

const id='opencli.ctrip.search',input={query:'湘湖',limit:3},catalog=[{...TOOLS[id],available:true}]
const intent={purpose:'搜索景点→更新候选',load:'manual'},signal=new AbortController().signal
const envelope=name=>({items:[{id:'poi-1',rowKey:'poi-1',name,address:'湖边',score:4.5}],source:'controlled-fixture',fetchedAt:new Date().toISOString(),truncated:false})
const compile=body=>{const r=compileCard('<card>'+body+'</card>',{final:true,context:{expressionDialect:'js-v1'}});assert.ok(r.complete,JSON.stringify(r.diagnostics));return r.spec}
const binding=`<binding id="places" tool="${id}" input={{query:"湘湖",limit:3}} load="manual"/>`
const actions='<button onPress="refresh">更新</button><action id="refresh"><invoke binding="places"/></action>'
const live=binding+'<text>{bindings.places.value.items.map(x=>x.name).join(",")}</text>'+actions
const plan=[{tool:id,...intent,available:true}]

test('describe records live intent without any network; recipe is stable and does not increase model turns',async()=>{
 let calls=0;const ext=createGenerationTools({catalog,invoke:async()=>{calls++;return {value:envelope('初始')}}})
 const described=await ext.execute('cli_describe',{id,binding:intent},signal)
 assert.equal(calls,0);assert.equal(described.bindingRecipe.load,'manual');assert.equal(ext.bindingPlan().length,1)
 const read=await ext.execute('cli_read',{id,input,binding:intent},signal)
 assert.equal(calls,1);assert.equal(read.bindingRecipe.load,'manual')
 const cached=await ext.execute('cli_read',{id,input:{limit:3,query:'湘湖'},binding:intent},signal)
 assert.equal(calls,1);assert.deepEqual(cached.bindingRecipe,read.bindingRecipe)
 assert.equal(compile(read.bindingRecipe.declaration+'<text>结果</text>').bindings[read.bindingRecipe.id].tool,id)
})
test('ordinary evidence reads do not create live commitments',async()=>{
 const ext=createGenerationTools({catalog,invoke:async()=>({value:envelope('资料')})})
 await ext.execute('cli_read',{id,input},signal);assert.deepEqual(ext.bindingPlan(),[])
})
test('recipe escapes markup in tool inputs without losing the literal value',()=>{
 const r=bindingRecipe(id,{query:'</binding><button>" & 中文'}),s=compile(r.declaration+'<text>结果</text>')
 assert.equal(s.bindings[r.id].tool,id)
})
test('missing binding and frozen rows fail a declared live need; a working consumer passes',()=>{
 assert.equal(bindingPlanDiagnostics(compile('<text>行程</text>'),plan)[0].code,'binding_plan_missing')
 assert.equal(bindingPlanDiagnostics(compile(binding+'<text>固定行程</text>'+actions),plan)[0].code,'binding_plan_unconsumed')
 assert.deepEqual(bindingPlanDiagnostics(compile(live),plan),[])
})
test('compose consumer works without a prescribed UI layout',()=>{
 const spec=compile(binding+'<task-board label="探索" view={compose({main:"places"},{primary:"main"})}/>'+actions)
 assert.deepEqual(bindingPlanDiagnostics(spec,plan),[])
})
test('manual binding needs an invocation; unavailable connections remain a visible gap, not endless repair',()=>{
 assert.ok(bindingPlanDiagnostics(compile(binding+'<text>{bindings.places.value.items.length}</text>'),plan).some(d=>d.code==='binding_plan_unreachable'))
 assert.equal(bindingPlanDiagnostics(compile('<text>请连接</text>'),[{...plan[0],available:false,reason:'需登录'}])[0].severity,'warning')
})
test('blocked provider is recorded as unavailable instead of forcing repeated repair',async()=>{
 const ext=createGenerationTools({catalog,invoke:async()=>{throw Object.assign(Error('需登录'),{code:'AUTH_REQUIRED'})}})
 await assert.rejects(ext.execute('cli_read',{id,input,binding:intent},signal),/需登录/)
 assert.equal(ext.bindingPlan()[0].available,false)
 const contract=await ext.execute('cli_describe',{id,binding:intent},signal);assert.equal(contract.available,false)
 await assert.rejects(ext.execute('cli_read',{id,input,binding:intent},signal),/需登录/);assert.ok(ext.bindingPlan().every(p=>!p.available))
})
test('disabled tools do not expose binding discovery or permit execution',async()=>{
 const ext=createGenerationTools({catalog,enabled:false})
 assert.ok(!ext.tools().some(t=>t.function.name==='cli_read'))
 await assert.rejects(ext.execute('cli_describe',{id,binding:intent},signal),/关闭/)
})
test('disclosure persists exact candidates, availability, query and concise prompt',async()=>{
 const d=await generationToolDisclosure(catalog,'周末出去玩',{discover:async()=>({tools:[{id,purpose:'找景点',available:true,readOnly:true}],instruction:'按需展开',retrieval:{catalogSize:192}})})
 assert.equal(d.audit.query,'周末出去玩');assert.equal(d.audit.candidates[0].id,id);assert.equal(d.audit.discoveryPrompt,d.discovery)
})
test('generation repairs omitted live binding, preserving shared plan across model turns',async()=>{
 const ext=createGenerationTools({catalog});await ext.execute('cli_describe',{id,binding:intent},signal)
 const research=createResearchSession({extensions:ext}),responses=['<card><text>固定行程</text></card>','<card>'+live+'</card>'];let n=0
 const r=await generateCard({catalog,research,input:{prompt:'搜索景点并刷新'},signal,view:{expressionDialect:'js-v1'},streamUpstream:async(_m,o)=>o.onPiece({content:responses[n++]})})
 assert.equal(n,2);assert.equal(r.repairCount,1);assert.equal(r.spec.toolBindingPlan[0].tool,id)
 assert.ok(r.spec.toolDiscovery.candidates);assert.equal(r.spec.bindings.places.tool,id)
})
test('prefetch seeds the live binding; refresh changes content, failure and restoration keep data',async()=>{
 const s=compile(live);s.prefetched=[{id:'D1',tool:id,input,value:envelope('初始'),updatedAt:new Date().toISOString()}]
 const cache=new Map(),storage={getItem:k=>cache.get(k),setItem:(k,v)=>cache.set(k,v)},options={storage,persistenceKey:'binding-plan'};let count=0,fail=false
 const session=createCardSession(s,{...options,transport:async()=>{count++;if(fail)throw Error('offline');return {kind:'json',value:envelope('更新后')}}})
 session.setActivity({visible:true,complete:true});assert.equal(count,0);assert.equal(session.scope().bindings.places.value.items[0].name,'初始')
 await session.invoke({binding:'places'});assert.equal(session.scope().bindings.places.value.items[0].name,'更新后')
 fail=true;await session.invoke({binding:'places'});assert.equal(session.scope().bindings.places.value.items[0].name,'更新后');assert.equal(session.current().bindings.places.status,'error')
 session.save();session.dispose();const restored=createCardSession(s,options);assert.equal(restored.scope().bindings.places.value.items[0].name,'更新后');restored.dispose()
})

test('batch describe is discovery: a shared intent must not force every candidate into the UI',async()=>{
 const ids=[id,'opencli.wttr.forecast'],ext=createGenerationTools({catalog:ids.map(id=>({...TOOLS[id],available:true}))})
 const result=await ext.execute('cli_describe',{ids,binding:intent},signal)
 assert.equal(result.contracts.length,2);assert.equal(ext.bindingPlan().length,0);assert.ok(result.bindingPolicy)
 await ext.execute('cli_describe',{id,binding:intent},signal);assert.equal(ext.bindingPlan().length,1)
})
test('different static queries cannot satisfy the same live commitment',()=>{
 const spec=compile(live)
 const issues=bindingPlanDiagnostics(spec,[{...plan[0],input:{query:'上海',limit:3}}])
 assert.ok(issues.some(d=>d.code==='binding_plan_missing'))
})

test('an unreferenced action cannot make a manual connection reachable',()=>{
 const spec=compile(binding+'<text>{bindings.places.value.items.length}</text><action id="dead"><invoke binding="places"/></action>')
 assert.ok(bindingPlanDiagnostics(spec,plan).some(d=>d.code==='binding_plan_unreachable'))
})

test('visible load cannot substitute for a promised user refresh',()=>{
 const spec=compile(binding.replace('manual','visible')+'<text>{bindings.places.value.items.length}</text><action id="dead"><invoke binding="places"/></action>')
 assert.ok(bindingPlanDiagnostics(spec,[{...plan[0],purpose:'手动刷新景点'}]).some(d=>d.code==='binding_plan_refresh_missing'))
})
