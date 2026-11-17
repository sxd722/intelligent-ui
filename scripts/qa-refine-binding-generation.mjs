import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const root='artifacts/refine-background-20261111',base='http://127.0.0.1:8787'
const record=JSON.parse(await readFile(root+'/game.json','utf8'))
const request={messages:[{role:'user',content:record.result.prompt}],format:'cardspec',mode:'direct',generationProfile:'adaptive-v1',expressionDialect:'js-v1',modelProfile:'deepseek-flash',toolsEnabled:true,designMode:'host',debugGeneration:true,buildMode:'quick',cardSize:'auto',renderMode:'native',turnId:randomUUID()}
const started=Date.now(),events=[],apply=createDeltaApplier(),envelope={};let error
await writeFile(root+'/generation-request.json',JSON.stringify(request,null,2));await writeFile(root+'/generation.sse','')
try{
 const response=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(request),signal:AbortSignal.timeout(300000)})
 if(!response.ok)throw Error('HTTP '+response.status)
 let pending='';const decoder=new TextDecoder()
 for await(const chunk of response.body){const str=decoder.decode(chunk,{stream:true});await appendFile(root+'/generation.sse',str);pending+=str;let n;while((n=pending.indexOf('\n'))>=0){const line=pending.slice(0,n);pending=pending.slice(n+1);if(!line.startsWith('data:')||line.slice(5).trim()==='[DONE]')continue;const e=JSON.parse(line.slice(5));events.push(e);if(!isControlEvent(e))apply.apply(envelope,e);if(['research','stream_error','message_stream_complete'].includes(e.type))console.log(JSON.stringify({type:e.type,status:e.status,tool:e.tool,error:e.error}))}}
}catch(e){error=e.message}
const m=envelope.message||{},result={id:'game',title:'影域枪战口碑 · Refine修复验证',prompt:record.result.prompt,elapsedMs:Date.now()-started,error,status:events.findLast(e=>e.type==='message_stream_complete')?.status,source:m.metadata?.validated_source||m.content?.parts?.join('')||'',spec:m.metadata?.card_spec,metadata:m.metadata,events}
await writeFile(root+'/generation.json',JSON.stringify(result,null,2));await mkdir('public/refine-background/runs',{recursive:true});await writeFile('public/refine-background/runs/game.json',JSON.stringify(result));console.log(JSON.stringify({status:result.status,seconds:result.elapsedMs/1000,bindings:Object.values(result.spec?.bindings||{}).map(b=>b.tool),error}))
