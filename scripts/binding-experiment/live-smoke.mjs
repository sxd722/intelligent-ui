// Uses the existing host only. No OpenCLI instances, process management, or bridge operations.
import {readFile,writeFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {CASES} from './cases.mjs'
import {normalize} from './engine.mjs'
const dir='artifacts/tool-binding-qa/deepseek-v4-flash-20261102-v2',c=CASES.find(c=>c.id==='weather'),map=JSON.parse(await readFile(dir+'/maps.json','utf8')).maps.weather.A4,started=Date.now(),record={tool:c.tool,input:c.input,scope:'One live read-only weather smoke; not full S3 or card end-to-end acceptance',frames:[]};
try{
const r=await fetch('http://127.0.0.1:8787/api/tools/invoke',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:8787'},body:JSON.stringify({tool:c.tool,input:c.input,target:'binding',cause:'generation',requestId:randomUUID(),pageId:'binding-experiment-smoke',sessionId:'binding-experiment-smoke'}),signal:AbortSignal.timeout(45000)});record.httpStatus=r.status;const body=await r.text();if(!r.ok)throw Error(body.slice(0,250));for(const line of body.split('\n'))if(line.startsWith('data:')){try{record.frames.push(JSON.parse(line.slice(5)))}catch{}}
const result=record.frames.find(f=>f.type==='result')?.result;if(!result)throw Error(record.frames.find(f=>f.type==='error')?.error||'No result event');record.raw=result.value;record.normalizedA2=normalize(result.value.items,c.map);record.normalizedA4=normalize(result.value.items,map);record.passed=record.normalizedA2.length>0&&record.normalizedA2.every(r=>r.title&&r.id&&(r.metric===null||typeof r.metric==='number'));
}catch(e){record.passed=false;record.error=e.message}
record.elapsedMs=Date.now()-started;await writeFile(dir+'/live-weather.json',JSON.stringify(record,null,2));console.log(JSON.stringify({tool:record.tool,passed:record.passed,count:record.raw?.items?.length,ms:record.elapsedMs,error:record.error}));
