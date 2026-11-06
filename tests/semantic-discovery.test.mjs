import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {TOOLS} from '../shared/cardspec/tools.mjs'
import {rankTools,createToolDiscovery} from '../server/tools/semantic-discovery.mjs'
import {generationToolDisclosure} from '../server/cardspec/tool-disclosure.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {assessSelection,DISCOVERY_CASES} from '../server/tools/discovery-cases.mjs'
import {scoreDiscoveryJob} from '../server/tools/discovery-lab.mjs'

const catalog=['opencli.douban.movie-hot','opencli.wttr.forecast','opencli.jd.search','opencli.spotify.pause'].map(id=>({...TOOLS[id],available:true}))
test('semantic-only intent, explicit ID, blocked availability and write classification stay separate',()=>{
 const c=catalog.map(t=>({...t,...(t.id.includes('douban')?{available:false,reason:'need binding'}:{})}))
 const hit=rankTools(c,'今晚看什么',{vectors:[[1,0],[0,1],[0,.3],[0,.1]],queries:[[1,0]],limit:3})
 assert.equal(hit[0].id,'opencli.douban.movie-hot');assert.equal(hit[0].matchedBy,'semantic');assert.equal(hit[0].available,false);assert.equal(hit[0].reason,'need binding')
 assert.equal(rankTools(c,'opencli.wttr.forecast',{vectors:[[1,0],[0,1],[0,.3],[0,.1]],queries:[[1,0]]})[0].id,'opencli.wttr.forecast')
 assert.equal(rankTools(c,'Spotify pause').find(t=>t.id==='opencli.spotify.pause').readOnly,false)
 assert.deepEqual(rankTools(c,'无关',{vectors:[[0,1],[0,1],[0,1],[0,1]],queries:[[1,0]]}),[])
})
test('cached vectors never cache health/permissions, catalog edits invalidate document cache',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'discovery-'));let encodes=0
 const discovery=createToolDiscovery({cacheDir:dir,encoder:{model:'test',encode:async texts=>{encodes++;return texts.map(()=>[1,0])},close(){}}})
 try{
  const first=await discovery.discover(catalog,'今晚看什么');const calls=encodes
  const next=await discovery.discover(catalog.map(t=>({...t,available:false,reason:'changed'})),'今晚看什么')
  assert.equal(encodes,calls);assert.equal(next.tools[0].available,false);assert.equal(next.retrieval.cached,true)
  await discovery.discover(catalog.map(t=>({...t,description:t.description+' revised'})),'今晚看什么');assert.ok(encodes>calls)
  assert.equal(first.retrieval.method,'local-embedding+keyword')
 }finally{discovery.close();await rm(dir,{recursive:true,force:true})}
})
test('encoder failure falls back without hiding tools, and cancellation propagates',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'discovery-'))
 const d=createToolDiscovery({cacheDir:dir,encoder:{model:'missing',encode:async()=>{throw Error('not installed')},close(){}}})
 try{const result=await d.discover(catalog,'豆瓣电影');assert.equal(result.retrieval.method,'keyword-fallback');assert.match(result.retrieval.fallbackReason,/not installed/);assert.ok(result.tools.some(t=>t.id==='opencli.douban.movie-hot'));await assert.rejects(d.discover(catalog,'movie',{signal:AbortSignal.abort()}))}finally{await rm(dir,{recursive:true,force:true})}
})
test('discovery and describe execute no CLI; thin prompt and exact schemas share catalog',async()=>{
 let calls=0;const discover=async(c,q)=>({tools:rankTools(c,q),retrieval:{method:'test',catalogSize:c.length}})
 const ext=createGenerationTools({catalog,discover,invoke:async()=>calls++,allowPlanning:false})
 const found=await ext.execute('cli_discover',{query:'豆瓣电影'})
 assert.ok(found.tools.some(t=>t.id==='opencli.douban.movie-hot'))
 const described=await ext.execute('cli_describe',{id:'opencli.douban.movie-hot'})
 assert.deepEqual(described.input,TOOLS[described.id].inputSchema);assert.equal(calls,0)
 const disclosure=await generationToolDisclosure(catalog,'豆瓣电影',{discover})
 assert.ok(!disclosure.discovery.includes('inputSchema'));assert.ok(disclosure.binding.length<1500)
 assert.ok(!disclosure.discovery.includes('expected'))
 const write=await ext.execute('cli_describe',{id:'opencli.spotify.pause'});assert.equal(write.readOnly,false)
 await assert.rejects(ext.execute('cli_read',{id:'opencli.spotify.pause',input:{}}));assert.equal(calls,0)
})
test('oracle accepts alternatives but rejects unrelated tools and requires both intents',()=>{
 const movie=DISCOVERY_CASES[0];assert.equal(assessSelection(movie,[{id:'opencli.douban.top250'}]).passed,true)
 assert.equal(assessSelection(movie,[{id:'opencli.douban.top250'},{id:'opencli.wttr.current'}]).passed,false)
 assert.equal(assessSelection(DISCOVERY_CASES.find(c=>c.id==='17-multi'),[{id:'opencli.wttr.current'}]).passed,false)
 assert.equal(assessSelection(DISCOVERY_CASES.find(c=>c.id==='18-static'),[]).passed,true)
})
test('scoring separates pre-disclosed schema from tool calls and rejects dependency cycles',()=>{
 const job={caseId:'01-movies',mode:'legacy',initialPrompt:[{role:'system',content:JSON.stringify({id:'opencli.douban.movie-hot',input:TOOLS['opencli.douban.movie-hot'].inputSchema})}],selected:[{id:'opencli.douban.movie-hot',input:{limit:5}}],rounds:[]}
 assert.equal(scoreDiscoveryJob(job).contracts[0].status,'valid');assert.equal(scoreDiscoveryJob(job).contracts[0].contractDisclosed,true)
 assert.equal(scoreDiscoveryJob({...job,selected:[{id:'opencli.douban.movie-hot',input:{invented:true}}]}).contracts[0].status,'invalid')
 const cyclic={...job,selected:[{id:'opencli.douban.search',after:'opencli.douban.subject'},{id:'opencli.douban.subject',after:'opencli.douban.search'}]}
 assert.ok(scoreDiscoveryJob(cyclic).contracts.every(c=>c.status==='invalid'))
})
