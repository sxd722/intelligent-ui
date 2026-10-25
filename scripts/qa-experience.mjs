// Isolated in-process HTTP harness: no OpenCLI runtime, lease or browser calls.
import http from 'node:http'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {handleCardSpec} from '../server/cardspec/handler.mjs'
import {CARD_DSL_PROMPT} from '../server/cardspec/prompt.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {loadApiKey} from '../server/env.mjs'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
import {EXPERIENCE_CASES} from './experience-cases.mjs'
const mode=process.env.QA_MODE||'direct',out=process.env.QA_OUT||'artifacts/experience-qa/baseline'
await mkdir(out,{recursive:true})
const catalogFile='artifacts/experience-qa/catalog.json'
let catalog
try{catalog=JSON.parse(await readFile(catalogFile,'utf8'))}catch{
 const j=await(await fetch('http://127.0.0.1:8787/api/tools')).json();catalog=Array.isArray(j)?j:j.tools
 await writeFile(catalogFile,JSON.stringify(catalog,null,2))
}
const model=process.env.MODEL_NAME||'glm-5.3-flash',key=loadApiKey(),round=createModelClient({base:process.env.MODEL_BASE_URL||'https://model-gateway.example.invalid/v1',key:key.value,model})
const calls=[]
const streamUpstream=async(messages,o)=>{const r=await round(messages,o);calls.push({at:new Date().toISOString(),usage:r.usage});return r.message.content}
const server=http.createServer(async(req,res)=>{try{let body='';for await(const c of req)body+=c;await handleCardSpec(req,res,JSON.parse(body),{streamUpstream,model,keyLoaded:key.ok,toolCatalog:async()=>catalog,photo:null})}catch(e){res.end(e.message)}})
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port
const selected=process.env.QA_CASES?.split(','),cases=EXPERIENCE_CASES.filter(c=>!selected||selected.includes(c.id)),rounds=Number(process.env.QA_ROUNDS||2)
await writeFile(`${out}/prompt.txt`,CARD_DSL_PROMPT)
await writeFile(`${out}/manifest.json`,JSON.stringify({mode,model,rounds,concurrency:3,research:'disabled in both arms; deterministic capability catalog; no tools executed',promptHash:createHash('sha256').update(CARD_DSL_PROMPT).digest('hex'),cases},null,2))
const jobs=Array.from({length:rounds},(_,r)=>cases.map(c=>({...c,round:r+1}))).flat(),results=[]
try{await Promise.all(Array.from({length:3},async()=>{while(jobs.length){const c=jobs.shift(),frames=[],envelope={},apply=createDeltaApplier(),start=Date.now();let error
 try{const res=await fetch(base,{method:'POST',body:JSON.stringify({messages:[{role:'user',content:c.prompt}],format:'cardspec',mode,cardSize:c.cardSize,toolsEnabled:true}),signal:AbortSignal.timeout(190000)});let pending='';const decoder=new TextDecoder();for await(const chunk of res.body){pending+=decoder.decode(chunk,{stream:true});let i;while((i=pending.indexOf('\n'))>=0){const line=pending.slice(0,i).trim();pending=pending.slice(i+1);if(!line.startsWith('data:'))continue;const data=line.slice(5).trim();if(data==='[DONE]')continue;const frame=JSON.parse(data);frames.push({ms:Date.now()-start,frame});if(!isControlEvent(frame))apply.apply(envelope,frame)}}}catch(e){error=e.message}
 const meta=envelope.message?.metadata,repairCount=meta?.repair_count??(frames.some(f=>f.frame.type==='stream_note'&&/修复 CardSpec/.test(f.frame.note))?1:0),status=frames.findLast(f=>f.frame.type==='message_stream_complete')?.frame.status||'failed'
 const result={id:c.id,round:c.round,mode,status,repairCount,firstPass:status==='succeeded'&&!repairCount,elapsed:Date.now()-start,error,cardSize:c.cardSize}
 await writeFile(`${out}/${c.id}-r${c.round}.json`,JSON.stringify({result,prompt:c.prompt,message:envelope.message,source:envelope.message?.content?.parts?.[0],frames},null,2));results.push(result);console.log(JSON.stringify(result));await writeFile(`${out}/summary.json`,JSON.stringify(results,null,2))
}}))}finally{server.close();await writeFile(`${out}/usage.json`,JSON.stringify(calls,null,2))}
