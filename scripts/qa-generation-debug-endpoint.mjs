import {writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const started=Date.now()
const response=await fetch('http://127.0.0.1:8787/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'做一个简洁计数器，显示当前值，增加和重置按钮。无需查询资料。'}],format:'cardspec',mode:'direct',generationProfile:'adaptive-v1',expressionDialect:'js-v1',toolsEnabled:false,debugGeneration:true,cardSize:'square',renderMode:'native'}),signal:AbortSignal.timeout(180000)})
assert.equal(response.status,200)
const raw=await response.text(),events=raw.split('\n').filter(s=>s.startsWith('data:')).map(s=>{try{return JSON.parse(s.slice(5))}catch{return {raw:s}}})
await writeFile('artifacts/generation-debug-qa/endpoint.json',JSON.stringify({elapsedMs:Date.now()-started,events},null,2))
const audits=[]
function visit(o){if(!o||typeof o!=='object')return;if(o.generationDebug)audits.push(o.generationDebug);for(const v of Object.values(o))visit(v)}
visit(events)
assert.ok(audits.length,'endpoint did not deliver debug audit')
assert.equal(audits.at(-1).tests.at(-1).status,'passed')
console.log(JSON.stringify({endpoint:'8787/api/chat',elapsedMs:Date.now()-started,status:'passed',tests:audits.at(-1).tests.map(t=>t.status)}))
