import {readFile,writeFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {buildDeepCard} from '../server/cardspec/deep-build.mjs'
import {createDebugSession} from '../server/cardspec/debug-session.mjs'
import {createGenerationBudget,generationPolicy} from '../server/cardspec/budget.mjs'
import {generationCallOptions} from '../server/cardspec/build-policy.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {loadApiKey} from '../server/env.mjs'
const trace=JSON.parse(await readFile(process.argv[2],'utf8')),id=randomUUID()
const context={expressionDialect:'js-v1',renderMode:'hybrid',cardSize:'full',buildMode:'deep'}
// Explicit evidence replay: reuse captured real reads, never reconnect or replay CLI.
const records=process.env.QA_RECORDS?JSON.parse(await readFile(process.env.QA_RECORDS,'utf8')).records:[]
context.datasets=Object.fromEntries(records.map(r=>[r.id,r.value]))
const research=records.length?{records:()=>records,datasets:()=>context.datasets,context:()=>JSON.stringify(records.filter(r=>r.enrichment||!records.some(p=>p.enrichment?.outcomes?.some(o=>o.input?.id===r.input?.id&&p.id!==r.id))).map(r=>({dataset:r.id,path:`context.datasets.${r.id}`,tool:r.tool,fields:Object.keys(r.value.items?.[0]||{}),count:r.value.items?.length,sample:r.value.items?.slice(0,1),enrichment:r.enrichment?.after}))).slice(0,7000)}:undefined
const output=process.env.QA_OUTPUT||'artifacts/build-reliability-qa/resume-result.json'
const policy=generationPolicy(trace.goal,{buildMode:'deep'})
if(process.env.QA_RESUME_CALLS){policy.modelCalls=Math.min(18,Math.max(1,Number(process.env.QA_RESUME_CALLS)));policy.timeoutMs=180000}
const budget=createGenerationBudget(policy),signal=AbortSignal.timeout(budget.remaining())
const round=createModelClient({base:process.env.MODEL_BASE_URL||'https://model-gateway.example.invalid/v1',key:loadApiKey().value,model:'glm-5.3'})
const debug=createDebugSession({context:()=>context,budget,cardId:id})
try{
 const result=await buildDeepCard({cardId:id,input:{prompt:trace.goal},context,research,budget,signal,debug,resume:{...trace,sourceId:process.argv[2]},emit:e=>console.log(JSON.stringify(e)),streamUpstream:async(m,o)=>{budget.model(o.stage);return (await round(m,generationCallOptions({buildMode:'deep',modelProfile:'deep'},o))).message.content}})
 await writeFile(output,JSON.stringify({id,evidenceReplay:!!research,result},null,2))
 console.log(JSON.stringify({id,status:result.status,coverage:result.coverage}))
}catch(e){await writeFile(output,JSON.stringify({id,evidenceReplay:!!research,error:e.message},null,2));console.log(JSON.stringify({id,error:e.message}));process.exitCode=1}
