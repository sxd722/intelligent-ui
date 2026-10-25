import {mkdir,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const base='https://your-site.example.invalid'
const dir='artifacts/p0-cloud-qa';await mkdir(dir,{recursive:true})
const health=await(await fetch(base+'/api/health')).json()
console.log('health',JSON.stringify({toolsMode:health.toolsMode,cardSandbox:health.cardSandbox}))
const started=Date.now()
const response=await fetch(base+'/api/chat',{method:'POST',headers:{'content-type':'application/json',origin:base},signal:AbortSignal.timeout(180000),body:JSON.stringify({format:'cardspec',mode:'direct',generationProfile:'adaptive-v1',expressionDialect:'js-v1',debugGeneration:true,toolsEnabled:true,renderMode:'native',messages:[{role:'user',content:'制作一个最简单的计数器，增加和重置两个按钮。先用card_test检查源码，再用card_commit提交同一候选。不需要图片或外部工具。'}]})})
const body=await response.text()
const events=body.split('\n').filter(s=>s.startsWith('data: ')&&s!=='data: [DONE]').map(s=>JSON.parse(s.slice(6)))
const spec=events.flatMap(e=>Array.isArray(e.v)?e.v:[]).map(o=>o.v?.card_spec).filter(Boolean).at(-1)
const result={status:response.status,elapsedMs:Date.now()-started,health,events,debug:spec?.generationDebug}
await writeFile(dir+'/online.json',JSON.stringify(result,null,2))
assert.equal(response.status,200)
assert.equal(events.find(e=>e.type==='message_stream_complete')?.status,'succeeded',JSON.stringify(events.filter(e=>e.type==='stream_error')))
assert.equal(spec?.generationDebug?.mode,'compile-only')
assert.equal(spec.generationDebug.runner,'cloud-compile-only')
assert.equal(spec.generationDebug.committed?.status,'partial')
console.log(JSON.stringify({status:'passed',elapsedMs:result.elapsedMs,committed:spec.generationDebug.committed,mode:spec.generationDebug.mode}))
