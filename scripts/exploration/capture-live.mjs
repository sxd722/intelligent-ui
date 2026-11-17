import fs from 'node:fs/promises'
import {randomUUID,createHash} from 'node:crypto'
import {redact} from '../../server/rsi-journal.mjs'
const root='experiments/round1-20261117';await fs.mkdir(root+'/data',{recursive:true})
const records=[];let blocked=0
async function read(tool,input){
 const request={tool,input,requestId:randomUUID(),pageId:'study-capabilities',sessionId:'study-round1',target:'binding',cause:'user',cache:'reload'}
 const started=Date.now(),frames=[];let result,error
 try{const res=await fetch('http://127.0.0.1:8787/api/tools/invoke',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:8787'},body:JSON.stringify(request),signal:AbortSignal.timeout(45000)});const text=await res.text();for(const line of text.split('\n'))if(line.startsWith('data:')){const f=JSON.parse(line.slice(5));frames.push(f);if(f.type==='result')result=f.result;if(f.type==='error')error=f.error}if(!res.ok)error='HTTP '+res.status;if(!result&&!error)error='no result'}catch(e){error=e.message}
 const record={tool,input,requestId:request.requestId,mode:'live-read',at:new Date().toISOString(),elapsedMs:Date.now()-started,result,error,frames};records.push(record)
 await fs.writeFile(root+'/data/live-attempts.json',JSON.stringify(redact(records),null,2));console.log(JSON.stringify({tool,input,status:error?'failed':'success',elapsedMs:record.elapsedMs}));if(error)blocked++;return result?.value
}
for(const query of ['bioluminescence','biofluorescence']){if(blocked>=2)break;const value=await read('opencli.wikipedia.search',{query,limit:4,lang:'en'});const title=value?.items?.[0]?.title;if(title&&blocked<2)await read('opencli.wikipedia.page',{title,lang:'en',paragraphs:4})}
await fs.writeFile(root+'/data/snapshot.json',JSON.stringify({mode:'recorded-live',records:records.filter(r=>r.result).map(({tool,input,result,at})=>({tool,input,result,at})),snapshotHash:createHash('sha256').update(JSON.stringify(records.map(r=>r.result||null))).digest('hex')},null,2))
