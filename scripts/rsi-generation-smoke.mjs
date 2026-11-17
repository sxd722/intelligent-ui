import {readFile,writeFile} from 'node:fs/promises'
const old=JSON.parse(await readFile('artifacts/rsi-adaptive/runs/189acaa5-08b0-40d9-848b-6b20e3942d56.json','utf8'))
const id='qa-live-lovecraft-'+Date.now(),start=Date.now(),payload={messages:[{role:'user',content:old.goal}],format:'cardspec',mode:'direct',modelProfile:'deepseek-flash',toolsEnabled:true,cardSize:'full',renderMode:'hybrid',debugGeneration:true,extendedGeneration:false,expressionDialect:'js-v1',buildMode:'quick',turnId:id}
await writeFile('artifacts/shared-action-rsi-qa/live-request.json',JSON.stringify({id,payload},null,2))
const response=await fetch('http://127.0.0.1:8787/api/chat',{method:'POST',headers:{'Content-Type':'application/json','X-RSI-Record-Id':id},body:JSON.stringify(payload),signal:AbortSignal.timeout(360000)})
const raw=await response.text();await writeFile('artifacts/shared-action-rsi-qa/live-stream.txt',raw)
const frames=raw.split('\n').filter(x=>x.startsWith('data: ')&&x!=='data: [DONE]').flatMap(x=>{try{return [JSON.parse(x.slice(6))]}catch{return []}})
const summary={id:response.headers.get('X-RSI-Record-Id'),elapsedMs:Date.now()-start,status:response.status,terminal:frames.filter(x=>['message_stream_complete','stream_error','server_ste_metadata'].includes(x.type))}
await writeFile('artifacts/shared-action-rsi-qa/live-summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary))
