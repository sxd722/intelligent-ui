import {writeFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {projectToolRows} from '../../shared/cardspec/tool-slots.mjs'
const results=[]
for(const [tool,input]of [['opencli.wttr.current',{location:'Hangzhou'}],['opencli.wttr.forecast',{location:'Hangzhou',days:3}]]){
 const r={tool,input,scope:'Existing local host, read-only smoke, no bridge lifecycle calls',frames:[]},t=Date.now()
 try{const response=await fetch('http://127.0.0.1:8787/api/tools/invoke',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:8787'},body:JSON.stringify({tool,input,target:'binding',cause:'generation',requestId:randomUUID(),pageId:'slots-smoke',sessionId:'slots-smoke'}),signal:AbortSignal.timeout(45000)});r.http=response.status
 for(const line of (await response.text()).split('\n'))if(line.startsWith('data:'))try{r.frames.push(JSON.parse(line.slice(5)))}catch{}
 const result=r.frames.find(f=>f.type==='result')?.result;if(!result)throw Error(JSON.stringify(r.frames.find(f=>f.type==='error')?.error||'Missing result'))
 r.raw=result.value;r.projection=projectToolRows(tool,result.value.items);r.passed=r.projection.ok&&r.projection.items.length>0&&!r.projection.diagnostics.length
 }catch(e){r.passed=false;r.error=e.message}
 r.ms=Date.now()-t;results.push(r);console.log(JSON.stringify({tool,passed:r.passed,ms:r.ms,count:r.raw?.items?.length,error:r.error}))
}
await writeFile('artifacts/tool-binding-qa/deepseek-v4-flash-20261102-v5/live-slots.json',JSON.stringify(results,null,2))
