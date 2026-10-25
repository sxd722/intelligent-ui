// Exercise the actual host followup/page stack with real model generation.
// Tool records are controlled fixtures; no OpenCLI instance is constructed.
import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {createCardSession} from '../src/cardspec/tool-session.mjs'
import {fixtureValue} from '../shared/cardspec/baselines/fixtures.mjs'
import {TOOLS} from '../shared/cardspec/tools.mjs'
import {loadApiKey} from '../server/env.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {createResearchSession} from '../server/research/session.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {generateCard} from '../server/cardspec/generation.mjs'
import {generationPolicy,createGenerationBudget} from '../server/cardspec/budget.mjs'
const root='artifacts/javascript-upgrade',run='deep-baselines-r5',id='family'
const tag=process.argv.find(v=>v.startsWith('--tag='))?.slice(6)||''
if(tag&&!/^[a-z0-9-]+$/.test(tag))throw Error('Invalid artifact tag')
const modelOverride=process.argv.find(v=>v.startsWith('--model='))?.slice(8)
if(modelOverride&&!['deep','default'].includes(modelOverride))throw Error('Invalid model profile')
const resultName=`family-r5-next-page${tag?'-'+tag:''}.json`
const original=JSON.parse(await readFile(`${root}/${run}/${id}.json`,'utf8'))
const key=loadApiKey();if(!key.ok)throw Error(key.reason)
const server=await readFile('server/index.mjs','utf8'),base=process.env.MODEL_BASE_URL||server.match(/const MODEL_BASE = .*?\|\| '([^']+)'/)[1]
const client=createModelClient({base,key:key.value,model:'glm-5.3-flash'})
const catalog=['opencli.ctrip.search','glm.generate'].map(id=>({...TOOLS[id],available:true}))
const calls=[],trace=[],checks=[];let request,output,budget
const started=Date.now()
const session=createCardSession(original.output.spec,{transport:async(payload,signal)=>{
 if(payload.tool!=='glm.generate')return {kind:'json',value:fixtureValue(payload.tool,payload.input)}
 request=payload
 const policy=generationPolicy(payload.input.prompt,{profile:'adaptive-v1',mode:'direct'});budget=createGenerationBudget(policy)
 const extensions=createGenerationTools({catalog,goal:payload.input.prompt,budget,allowDeck:false,initialRecords:original.output.spec.prefetched,invoke:async p=>({kind:'json',value:fixtureValue(p.tool,p.input)})})
 const research=createResearchSession({extensions,budget,onEvent:e=>trace.push(e),maxRounds:5,maxCalls:12,maxContextChars:18000,timeoutMs:policy.timeoutMs})
 const round=async(messages,opts)=>{const call={messages,startedAt:new Date().toISOString()};calls.push(call);try{const r=await client(messages,opts);Object.assign(call,r);return r}catch(e){call.error=e.message;throw e}}
 const streamUpstream=(messages,opts)=>{if(opts.research)return opts.research.run(round,messages,opts);opts.budget?.model(opts.stage||'generate');return round(messages,opts)}
 output=await generateCard({streamUpstream,catalog,research,budget,input:payload.input,target:payload.target,view:{...payload.view,...(modelOverride?{modelProfile:modelOverride}:{})},signal:AbortSignal.any([signal,AbortSignal.timeout(policy.timeoutMs)]),emit:e=>trace.push(e)})
 return output
}})
session.setActivity({visible:true,complete:true})
const rows=fixtureValue('opencli.ctrip.search').items
session.fire('pick',{event:{checked:true},args:rows[0]});session.fire('pick',{event:{checked:true},args:rows[1]})
const before=structuredClone(session.current().store.values)
await session.followup(original.output.spec.generationPlan.followups[0].prompt)
const check=(name,fn)=>{try{fn();checks.push({name,passed:true})}catch(e){checks.push({name,passed:false,error:e.message})}}
check('actual host sends selected entities and conditions',()=>{assert.equal(request.input.context.state.picks.length,2);assert.equal(request.input.context.state.age,before.age)})
check('valid generated next page is pushed',()=>assert.equal(session.pages.length,2))
if(output){session.navigate(-1);check('back restores original picks without generation',()=>assert.deepEqual(session.current().store.values,before));session.navigate(1);check('forward reuses generated page',()=>assert.equal(session.current().spec.cardId,output.spec.cardId))}
const result={at:new Date().toISOString(),run,id,modelProfile:modelOverride||request?.view?.modelProfile||'default',sourceHash:original.result.sourceHash,status:output?'generated':'failed',elapsedMs:Date.now()-started,error:session.current().error,request,output,checks,calls,trace,budget:budget?.snapshot(),scope:'Real model generation through production host followup and stack; controlled source tools; next-page UI/semantics are separate.'}
session.dispose()
await writeFile(root+'/'+resultName,JSON.stringify(result,null,2))
if(output){
 const path='public/javascript-upgrade/followup-replays.json',saved=JSON.parse(await readFile(path,'utf8'))
 saved.replays=saved.replays.filter(r=>!(r.run===run&&r.id===id));saved.replays.push({run,id,sourceHash:original.result.sourceHash,input:request.input,output,provenance:`Real ${[...new Set(calls.map(c=>c.model).filter(Boolean))].join('/')||result.modelProfile} next-page response through host followup; exact-input replay; controlled source data.`})
 await writeFile(path,JSON.stringify(saved,null,2))
}
console.log(JSON.stringify({status:result.status,elapsedMs:result.elapsedMs,error:result.error,checks}))
