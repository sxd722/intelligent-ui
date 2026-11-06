// Revalidate and repair a saved build using the same host state machine. This
// is a repair experiment, never counted as a fresh generation success.
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {loadApiKey} from '../server/env.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {buildDeepCard} from '../server/cardspec/deep-build.mjs'
import {createDebugSession} from '../server/cardspec/debug-session.mjs'
import {generationPolicy,createGenerationBudget} from '../server/cardspec/budget.mjs'
const sourceId=process.argv[2];if(!/^[a-f0-9-]{36}$/.test(sourceId||''))throw Error('existing trace UUID required')
const old=JSON.parse(await readFile(`artifacts/deep-build/${sourceId}/trace.json`,'utf8'))
const key=loadApiKey();if(!key.ok)throw Error('model key unavailable')
const health=await(await fetch('http://127.0.0.1:8787/api/health')).json()
const model=createModelClient({base:health.upstream,key:key.value,model:health.model})
const budget=createGenerationBudget(generationPolicy(old.goal,{buildMode:'deep'})),cardId=randomUUID(),context={buildMode:'deep',renderMode:'hybrid',expressionDialect:'js-v1',cardSize:'auto',localDate:new Date().toISOString().slice(0,10)},started=Date.now(),usage=[]
const emit=f=>{if(f.type==='build_progress'||f.type==='debug'&&f.status!=='running')console.log(JSON.stringify({ms:Date.now()-started,type:f.type,status:f.status,message:f.message,codes:f.diagnostics?.map(d=>d.code)}))}
const debug=createDebugSession({budget,context:()=>context,cardId,emit}),signal=AbortSignal.timeout(600000)
let result,error
try{result=await buildDeepCard({cardId,input:{prompt:old.goal},context,debug,budget,signal,emit,resume:{...old,sourceId},streamUpstream:async(messages,o)=>{budget.model(o.stage);const r=await model(messages,{...o,onUsage:u=>usage.push(u)});return r.message.content}})}catch(e){error={message:e.message,code:e.code}}
const root=`artifacts/deep-build-qa/repair-${sourceId}`;await mkdir(root,{recursive:true})
try{const previous=JSON.parse(await readFile(root+'/result.json','utf8'));await writeFile(root+'/result-'+previous.cardId+'.json',JSON.stringify(previous,null,2))}catch{}
await writeFile(root+'/result.json',JSON.stringify({sourceId,cardId,scope:'Saved candidate repair, not fresh generation; no live CLI reads',elapsedMs:Date.now()-started,result,error,usage,budget:budget.snapshot()},null,2))
console.log(JSON.stringify({sourceId,cardId,status:result?'succeeded':'failed',error,elapsedMs:Date.now()-started,calls:budget.snapshot().modelCalls}))
