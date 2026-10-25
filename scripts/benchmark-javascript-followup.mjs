// Real GLM JSON continuation using the unmodified R4 generated action input.
// CLI records are controlled fixtures; no OpenCLI instance is constructed.
import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
import {observableContent} from '../shared/cardspec/feedback-diagnostics.mjs'
import {fixtureValue} from '../shared/cardspec/baselines/fixtures.mjs'
import {loadApiKey} from '../server/env.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {generateCard} from '../server/cardspec/generation.mjs'
import {generationPolicy,createGenerationBudget} from '../server/cardspec/budget.mjs'
const root='artifacts/javascript-upgrade',run='deep-baselines-r4',id='family'
const original=JSON.parse(await readFile(`${root}/${run}/${id}.json`,'utf8'))
const compiled=compileCard(original.output.source,{final:true,context:original.output.spec.context})
assert.equal(compiled.complete,true,JSON.stringify(compiled.diagnostics))
const spec=compiled.spec,store=createStore(),bindings={result:{status:'success',value:fixtureValue('opencli.ctrip.search')}}
makeScope(spec,store,{bindings})
const fire=(action,args={},event={},effects=[])=>executeAction(spec,store,action,{args,event,bindings,effects})
fire('togglePick',bindings.result.value.items[0]);fire('togglePick',bindings.result.value.items[1])
const effects=[];fire('startPlan',{}, {},effects)
assert.equal(effects.length,1);const input=effects[0].input
assert.deepEqual(input.context.places.map(p=>p.id),['p1','p2'])
const key=loadApiKey();if(!key.ok)throw Error(key.reason)
const server=await readFile('server/index.mjs','utf8'),base=process.env.MODEL_BASE_URL||server.match(/const MODEL_BASE = .*?\|\| '([^']+)'/)[1]
const client=createModelClient({base,key:key.value,model:'glm-5.3-flash'}),calls=[],trace=[],checks=[]
const budget=createGenerationBudget(generationPolicy(input.prompt,{profile:'adaptive-v1',mode:'direct'})),started=Date.now()
const streamUpstream=async(messages,opts)=>{
 opts.budget?.model(opts.stage||'generate')
 const call={messages,startedAt:new Date().toISOString()};calls.push(call)
 const result=await client(messages,opts);Object.assign(call,result);return result
}
let output,error
try{output=await generateCard({streamUpstream,budget,input,target:'binding',view:{modelProfile:'deep',expressionDialect:'js-v1',generationMode:'direct',generationProfile:'adaptive-v1'},signal:AbortSignal.timeout(900000),emit:e=>trace.push(e)})}catch(e){error=e.message}
const check=(name,fn)=>{try{fn();checks.push({name,passed:true})}catch(e){checks.push({name,passed:false,error:e.message})}}
if(output){
 bindings.plan={status:'success',value:output.value}
 check('four distinct half-days',()=>assert.deepEqual([...new Set(output.value.plan.map(p=>p.slot))].sort(),['周六上午','周六下午','周日上午','周日下午'].sort()))
 check('only selected places, each at most once',()=>{const ids=output.value.plan.flatMap(p=>p.placeIds);assert.ok(ids.every(id=>['p1','p2'].includes(id)));assert.equal(new Set(ids).size,ids.length)})
 fire('confirmPlan')
 check('confirm saves independent result',()=>assert.deepEqual(store.values.fixedPlan,output.value))
 const savedView=observableContent(spec,store,{bindings})
 fire('togglePick',bindings.result.value.items[0]);fire('setBudget',{}, {value:900})
 check('saved plan display independent of edited selection/budget',()=>assert.equal(observableContent(spec,store,{bindings}),savedView))
 check('saved JSON survives serialization',()=>assert.deepEqual(JSON.parse(JSON.stringify(store.values.fixedPlan)),output.value))
}
const result={at:new Date().toISOString(),run,id,sourceHash:createHash('sha256').update(original.output.source).digest('hex'),status:output?'generated':'failed',elapsedMs:Date.now()-started,input,output,error,checks,calls,trace,budget:budget.snapshot(),scope:'Real model JSON from original generated action; controlled source records. UI and live CLI tested separately.'}
await writeFile(root+'/family-r4-followup.json',JSON.stringify(result,null,2))
if(output)await writeFile('public/javascript-upgrade/followup-replays.json',JSON.stringify({replays:[{run,id,sourceHash:result.sourceHash,input,output,provenance:'Real GLM-5.3 response; exact-input replay; controlled source data.'}]},null,2))
console.log(JSON.stringify({status:result.status,elapsedMs:result.elapsedMs,checks,error}))
