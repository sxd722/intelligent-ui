import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
import {cases as allCases} from './same-kind-cases.mjs'
const selection=process.argv.find(a=>a.startsWith('--case='))?.split('=')[1],cases=allCases.filter(c=>!selection||c.id===selection)
const root='artifacts/same-kind-qa';await mkdir(root,{recursive:true})
for(const c of cases){
 const baseline=JSON.parse(await readFile(`${root}/${c.id}-baseline.json`,'utf8')),start=Date.now()
 try{const r=await fetch('http://127.0.0.1:8787/api/cards/same-kind/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({baselineId:baseline.id,prompt:c.prompt,modelProfile:'default'}),signal:AbortSignal.timeout(125000)});const body=await r.json();const result={status:r.ok?'passed':'failed',elapsedMs:Date.now()-start,http:r.status,...body};await writeFile(`${root}/${c.id}-reuse.json`,JSON.stringify(result));console.log(c.id,'reuse',result.status,result.elapsedMs,result.error||'') }catch(e){await writeFile(`${root}/${c.id}-reuse.json`,JSON.stringify({status:'failed',elapsedMs:Date.now()-start,error:e.message}));console.log(c.id,e.message)}
}
if(!process.argv.includes('--reuse-only'))for(const c of cases){
 const start=Date.now(),frames=[],state={},apply=createDeltaApplier(),decoder=new TextDecoder();let buffer='',error
 try{const r=await fetch('http://127.0.0.1:8787/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({format:'cardspec',mode:'direct',messages:[{role:'user',content:c.full}],toolsEnabled:c.id==='news',renderMode:'native',cardSize:'square',expressionDialect:'js-v1',modelProfile:'default',generationProfile:'legacy',debugGeneration:true,buildMode:'quick'}),signal:AbortSignal.timeout(150000)});if(!r.ok)throw Error('HTTP '+r.status)
 for await(const chunk of r.body){buffer+=decoder.decode(chunk,{stream:true});let i;while((i=buffer.indexOf('\n\n'))>=0){const event=buffer.slice(0,i);buffer=buffer.slice(i+2);for(const line of event.split('\n'))if(line.startsWith('data:')){const raw=line.slice(5).trim();if(raw==='[DONE]')continue;const f=JSON.parse(raw);frames.push(f);if(!isControlEvent(f))apply.apply(state,f)}}}
 }catch(e){error=e.message}
 const result={status:frames.findLast(f=>f.type==='message_stream_complete')?.status||'incomplete',elapsedMs:Date.now()-start,error:error||frames.findLast(f=>f.type==='stream_error')?.error,frames,state}
 await writeFile(`${root}/${c.id}-scratch.json`,JSON.stringify(result));console.log(c.id,'scratch',result.status,result.elapsedMs,result.error||'')
}
