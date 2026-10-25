import {mkdir,writeFile} from 'node:fs/promises';
import {invokeTool} from '../src/baseline/transport.mjs';
const [tool,json='{}']=process.argv.slice(2);
const catalog=await(await fetch('http://127.0.0.1:8787/api/tools')).json();
if(!catalog.tools?.some(t=>t.id===tool&&(t.readOnly===true||['glm.generate','dataset.analyze'].includes(t.id))))throw Error('Registered readonly tool required');
const input=JSON.parse(json),requestId=crypto.randomUUID(),startedAt=new Date().toISOString();
const trace={tool,input,requestId,startedAt,mode:'live'};
try{trace.result=await invokeTool(tool,input,{requestId,pageId:'trae-skill-probe',sessionId:'trae-skill-20261021',signal:AbortSignal.timeout(120000),fetcher:(u,o)=>fetch('http://127.0.0.1:8787'+u,{...o,headers:{...o.headers,Origin:'http://127.0.0.1:8787'}})});trace.status='success'}catch(e){trace.status='error';trace.error=e.message;process.exitCode=1}
trace.finishedAt=new Date().toISOString();await mkdir('traces',{recursive:true});const file=`traces/${tool}-${requestId}.json`;await writeFile(file,JSON.stringify(trace,null,2));
// Keep completion/status out of long, truncatable result bodies. The trace file
// remains the authoritative complete response; previews must not become inputs.
const preview=(v,depth=0)=>typeof v==='string'?v.slice(0,300)+(v.length>300?'… [read full trace]':''):Array.isArray(v)?v.slice(0,2).map(x=>preview(x,depth+1)):v&&typeof v==='object'?depth>4?'[read full trace]':Object.fromEntries(Object.entries(v).slice(0,30).map(([k,x])=>[k,preview(x,depth+1)])):v;
console.log(JSON.stringify({status:trace.status,tool,file,requestId,startedAt,finishedAt:trace.finishedAt,error:trace.error,itemCount:trace.result?.items?.length,resultKeys:trace.result&&Object.keys(trace.result),previewOnly:true,resultPreview:preview(trace.result),note:'Preview may omit/truncate data. Read file for complete IDs, values and evidence.'},null,2));
