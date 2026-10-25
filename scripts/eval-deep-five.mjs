import {mkdir,writeFile,appendFile,copyFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {JAVASCRIPT_BASELINES} from './javascript-baseline-cases.mjs'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const root='artifacts/glm-deep-eval-20261025',pub='dist/glm-deep-eval-20261025'
await mkdir(root,{recursive:true});await mkdir(pub,{recursive:true})
const cases=JAVASCRIPT_BASELINES.map(c=>({...c,prompt:c.prompt.replaceAll('2026-10-23','2026-10-30').replaceAll('2026-10-25','2026-11-01')}))
const settings={format:'cardspec',mode:'direct',generationProfile:'adaptive-v1',modelProfile:'deep',renderMode:'hybrid',expressionDialect:'js-v1',toolsEnabled:true,debugGeneration:true,cardSize:'square'}
await writeFile(root+'/manifest.json',JSON.stringify({at:new Date().toISOString(),settings,cases,policy:'One fresh production request per case; keep automatic repairs; no manual source editing; real tools; no purchase or account writes.'},null,2))
for(const path of ['/api/health','/api/tools','/api/tools/connections']){try{const v=await(await fetch('http://127.0.0.1:8787'+path)).json();await writeFile(root+'/'+path.split('/').at(-1)+'.json',JSON.stringify(v,null,2))}catch(e){console.log(e.message)}}
const summary=[]
for(const c of cases){
 const started=Date.now(),frames=[],state={},apply=createDeltaApplier(),payload={...settings,turnId:'deep-eval-20261025-'+c.id,messages:[{role:'user',content:c.prompt}]};let buffer='',error;const decoder=new TextDecoder()
 console.log('START '+c.id);await writeFile(root+'/PROGRESS.json',JSON.stringify({id:c.id,status:'generating',startedAt:new Date().toISOString(),summary},null,2))
 try{const r=await fetch('http://127.0.0.1:8787/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(920000)})
 for await(const bytes of r.body){buffer+=decoder.decode(bytes,{stream:true});let end;while((end=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);for(const line of block.split('\n')){if(!line.startsWith('data:'))continue;const raw=line.slice(5).trim();if(raw==='[DONE]')continue;const f=JSON.parse(raw);frames.push(f);await appendFile(root+'/'+c.id+'.sse.jsonl',JSON.stringify({at:new Date().toISOString(),...f})+'\n');if(!isControlEvent(f))apply.apply(state,f)}}}}
 catch(e){error=e.message}
 const source=state.message?.metadata?.validated_source||state.message?.content?.parts?.[0]||'',record={id:c.id,elapsedMs:Date.now()-started,status:frames.findLast(f=>f.type==='message_stream_complete')?.status||'failed',metadata:frames.findLast(f=>f.type==='server_ste_metadata')?.metadata,error:frames.findLast(f=>f.type==='stream_error')?.error||error,sourceHash:createHash('sha256').update(source).digest('hex')}
 const result={record,prompt:c.prompt,payload,message:state.message,frames};await writeFile(root+'/'+c.id+'.json',JSON.stringify(result,null,2));await writeFile(pub+'/'+c.id+'.json',JSON.stringify({record,prompt:c.prompt,message:state.message},null,2));summary.push(record);await writeFile(root+'/summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify({id:c.id,status:record.status,ms:record.elapsedMs,error:record.error,calls:record.metadata?.generationBudget?.modelCalls}));
}
await writeFile(root+'/PROGRESS.json',JSON.stringify({status:'generation-complete-ui-pending',summary},null,2))
