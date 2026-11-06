import {randomUUID} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
// Public station dictionary only. This never opens or claims an Owl tab.
const runs=[]
for(const mode of ['default','default','reload']){
 const started=Date.now(),payload={tool:'opencli.12306.stations',input:{keyword:'杭州'},cache:mode,target:'binding',cause:'user',requestId:randomUUID(),sessionId:randomUUID(),pageId:randomUUID()}
 const r=await fetch('http://127.0.0.1:8787/api/tools/invoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(35000)})
 const frames=(await r.text()).split(/\r?\n/).filter(s=>s.startsWith('data:')).map(s=>JSON.parse(s.slice(5))),error=frames.find(f=>f.type==='error'),result=frames.find(f=>f.type==='result')?.result
 runs.push({mode,elapsedMs:Date.now()-started,cache:result?.cache,itemCount:result?.value?.items?.length,source:result?.value?.source,error:error?.error})
}
await mkdir('artifacts/tool-cache-qa',{recursive:true});await writeFile('artifacts/tool-cache-qa/live.json',JSON.stringify({tool:'opencli.12306.stations',at:new Date().toISOString(),runs},null,2))
console.log(JSON.stringify(runs))
assert.ok(runs.every(r=>!r.error&&r.itemCount>0),'real station lookup must succeed')
assert.equal(runs[1].cache.status,'hit');assert.equal(runs[2].cache.status,'miss');assert.equal(runs[0].cache.fetchedAt,runs[1].cache.fetchedAt)
