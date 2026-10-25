import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {CASES} from './direct-benchmark-cases.mjs'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const out='artifacts/cardspec-compact-balanced-2026-10-16',publicPath='public/cardspec-compact'
await mkdir(out,{recursive:true});await mkdir(publicPath,{recursive:true})
const health=await fetch('http://127.0.0.1:8787/api/health').then(r=>r.json())
const baseline=JSON.parse(await readFile('public/html-reference/data.json','utf8'))
const {photos,htmlPrompt:system}=baseline.manifest
const manifest={started:new Date().toISOString(),model:health.model,temperature:.4,maxTokens:8192,reasoningEffort:'low',rounds:1,concurrency:2,cardSize:'square',cases:CASES,photos,htmlPrompt:system,cardspec:'Production direct /api/chat, toolsEnabled:false, one existing repair. Same user requests. No CLI calls.',repair:'HTML: at most one repair for incomplete document or JS syntax. Semantic/UI failures remain failures. CardSpec: existing compile/rich validation one repair.'}
await writeFile(out+'/manifest.json',JSON.stringify(manifest,null,2));await writeFile(out+'/html-system-prompt.txt',system)
const records=baseline.records.filter(r=>r.format==='html');
manifest.htmlReference='Frozen outputs from html-reference-2026-10-16';
manifest.profile='compact-balanced-v1';
await writeFile(out+'/manifest.json',JSON.stringify(manifest,null,2));
async function publish(){const data=JSON.stringify({manifest,records},null,2);await writeFile(publicPath+'/data.json',data);try{await mkdir('dist/cardspec-compact',{recursive:true});await writeFile('dist/cardspec-compact/data.json',data)}catch{}await writeFile(out+'/summary.json',JSON.stringify(records.map(({source,spec,resources,...r})=>r),null,2))}
async function runCardSpec(c){
 const started=Date.now(),frames=[],envelope={},applier=createDeltaApplier();let buffer='',terminal,error,metadata={},done=false;const decoder=new TextDecoder()
 try{const r=await fetch('http://127.0.0.1:8787/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({format:'cardspec',mode:'direct',cardSize:'square',toolsEnabled:false,messages:[{role:'user',content:c.prompt}]}),signal:AbortSignal.timeout(310000)});if(!r.ok)throw Error('HTTP '+r.status)
 for await(const bytes of r.body){buffer+=decoder.decode(bytes,{stream:true});let n;while((n=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,n);buffer=buffer.slice(n+2);for(const line of block.split('\n')){if(!line.startsWith('data:'))continue;const raw=line.slice(5).trim();if(raw==='[DONE]'){done=true;continue}const f=JSON.parse(raw);frames.push({ms:Date.now()-started,frame:f});if(f.type==='message_stream_complete')terminal=f.status;if(f.type==='stream_error')error=f.error?.message;if(f.type==='server_ste_metadata')metadata=f.metadata;if(!isControlEvent(f))applier.apply(envelope,f)}}}}
 catch(e){error=e.message}
 const m=envelope.message,repairCount=metadata.repair_count??m?.metadata?.repair_count??0,status=terminal==='succeeded'&&done&&!error?'succeeded':'failed',source=m?.content?.parts?.[0]||''
 const result={id:c.id,area:c.area,format:'cardspec',status,firstPass:status==='succeeded'&&!repairCount,repairCount,elapsed:Date.now()-started,firstTokenMs:metadata.first_content_ms,sourceChars:source.length,error}
 await writeFile(`${out}/${c.id}-cardspec.json`,JSON.stringify({result,prompt:c.prompt,source,message:m,metadata,frames},null,2));return {...result,source,spec:m?.metadata?.card_spec,resources:m?.metadata?.resources}
}
const jobs=CASES.map(c=>({c,format:'cardspec'}))
let publishing=Promise.resolve()
await Promise.all(Array.from({length:2},async()=>{while(jobs.length){const {c,format}=jobs.shift();const r=await runCardSpec(c);records.push(r);publishing=publishing.then(publish);await publishing;console.log(JSON.stringify({id:r.id,format,status:r.status,elapsed:r.elapsed,repair:r.repairCount}))}}))

