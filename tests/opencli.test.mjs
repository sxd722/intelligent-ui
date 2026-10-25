import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {TOOLS,selectToolIds,toolReference,validateJson} from '../shared/cardspec/tools.mjs'
import {openCliInput,normalizeOpenCli,createOpenCli} from '../server/tools/opencli.mjs'
import {createWriteOperations} from '../server/tools/write-operations.mjs'
import {createToolService} from '../server/tools/service.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {OPENCLI_MUSIC,OPENCLI_WEATHER} from '../shared/cardspec/opencli-fixtures.mjs'
import {createCardSession} from '../src/cardspec/tool-session.mjs'
const turn=()=>new Promise(r=>setTimeout(r,0))
function spec(source=OPENCLI_MUSIC){const r=compileCard(source,{final:true,cardId:'test-opencli'});assert.equal(r.complete,true,JSON.stringify(r.diagnostics));return r.spec}
test('curated contracts compile; typed input cannot inject CLI options, paths or arbitrary tools',()=>{
 spec();spec(OPENCLI_WEATHER)
 assert.deepEqual(openCliInput('opencli.jd.search',{query:'--delete; echo hi'}),{limit:10,query:'--delete; echo hi'})
 assert.throws(()=>openCliInput('opencli.jd.search',{query:'x',shell:'powershell'}))
 assert.throws(()=>openCliInput('opencli.yollomi.restore',{image:'file:///secrets'}))
 assert.throws(()=>openCliInput('opencli.yollomi.restore',{image:'https://127.0.0.1/a'}))
 assert.equal(openCliInput('opencli.yollomi.restore',{image:'https://example.com/a.jpg'})['no-download'],true)
 assert.throws(()=>openCliInput('opencli.spotify.volume',{level:101}))
 assert.equal(compileCard(OPENCLI_MUSIC.replace('tool="opencli.spotify.play"','tool="opencli.spotify.play" load="visible" refresh={60}'),{final:true}).complete,false)
})
test('source-shaped results retain nulls, stable keys, safe links and explicit truncation',()=>{
 const a=normalizeOpenCli('opencli.jd.search',[{sku:'1',title:'A',url:'javascript:alert(1)'}])
 assert.equal(a.items[0].price,null);assert.equal(a.items[0].url,null)
 assert.equal(a.items[0].rowKey,normalizeOpenCli('opencli.jd.search',[{sku:'1',title:'Changed'}]).items[0].rowKey)
 assert.equal(normalizeOpenCli('opencli.jd.search',Array.from({length:105},()=>({sku:'1'}))).truncated,true)
 assert.equal(normalizeOpenCli('opencli.jd.search',[{sku:'1',title:'a'.repeat(20001)}]).truncated,true)
 assert.equal(new Set(normalizeOpenCli('opencli.jd.search',[{sku:'1'},{sku:'1'}]).items.map(i=>i.rowKey)).size,2)
 assert.throws(()=>normalizeOpenCli('opencli.jd.search',[JSON.parse('{"__proto__":{}}')]))
 assert.throws(()=>normalizeOpenCli('opencli.jd.search','not rows'))
})
test('only relevant available groups enter the model context',()=>{
 const ids=selectToolIds(Object.keys(TOOLS),'查一下上海天气')
 assert.ok(ids.includes('opencli.wttr.current'));assert.ok(!ids.includes('opencli.jd.add-cart'))
 assert.ok(!toolReference(true,ids).includes('"id":"opencli.spotify.play"'))
})
test('namespace diagnostics identify existing declarations without changing semantics',()=>{
 const r=compileCard('<card schemaVersion="1"><state id="quantity" type="number" initial={2}/><derive id="total" value={state.quantity*3}/><text>{state.total}</text></card>',{final:true})
 assert.equal(r.complete,false);assert.ok(r.diagnostics.some(d=>d.message.includes('use derived.total in ALL expressions')))
 assert.ok(!toolReference(true,['glm.generate']).includes('OpenCLI工具返回'))
})
test('writes need exact one-time preview; durable operation ID blocks restart replay',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'opencli-ops-'))
 try{
  const service=createWriteOperations(dir),p={tool:'opencli.spotify.play',input:{query:'A'},sessionId:'s',pageId:'p',requestId:'r'};let calls=0
  await assert.rejects(()=>service.execute(p,async()=>calls++),/确认/)
  const ticket=service.prepare(p)
  await assert.rejects(()=>service.execute({...p,input:{query:'B'},confirmationToken:ticket.token},async()=>calls++),/确认/)
  await service.execute({...p,confirmationToken:ticket.token},async()=>calls++)
  const restarted=createWriteOperations(dir),next=restarted.prepare(p)
  await assert.rejects(()=>restarted.execute({...p,confirmationToken:next.token},async()=>calls++),/已提交/)
  assert.equal(calls,1)
 }finally{await rm(dir,{recursive:true,force:true})}
})
test('write callbacks cannot chain writes; polling is pure and confirmation precedes dispatch',async()=>{
 let calls=0,confirm=0;const s=createCardSession(spec(),{authorizeWrite:async()=>{confirm++;return 'ticket'},transport:async()=>{calls++;return {kind:'json',value:normalizeOpenCli('opencli.spotify.play',[{status:'playing'}])}}})
 s.setActivity({visible:true,complete:true});s.tick();assert.equal(calls,0)
 await s.invoke({binding:'play'},{cause:'auto'});await s.invoke({binding:'play'},{depth:1});assert.equal(confirm,0)
 await s.invoke({binding:'play'});assert.equal(confirm,1);assert.equal(calls,1);s.dispose()
})
test('in-flight write is not replaced by changed input; unknown outcome has no direct retry',async()=>{
 let calls=0,resolve;const s=createCardSession(spec(),{authorizeWrite:async()=> 'ticket',transport:async()=>{calls++;return new Promise(r=>{resolve=r})}});s.setActivity({complete:true})
 const pending=s.invoke({binding:'play'});await turn();s.fire('query',{event:{value:'new'}});await s.invoke({binding:'play'});assert.equal(calls,1)
 resolve({kind:'json',value:normalizeOpenCli('opencli.spotify.play',[{status:'playing'}])});await pending;assert.equal(s.current().bindings.play.status,'success')
 const second=s.invoke({binding:'play'});await turn();s.cancel();resolve({kind:'json',value:normalizeOpenCli('opencli.spotify.play',[])});await second
 assert.equal(s.current().bindings.play.blockedRetry,true);await s.retry('play');assert.equal(calls,2);s.dispose()
})
test('server routes curated providers and rejects automatic or unconfirmed writes',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'opencli-service-'));let calls=0
 const fake={status:async()=>({}),available:async()=>({available:true}),invoke:async()=>{calls++;return normalizeOpenCli('opencli.spotify.play',[{status:'playing'}])},close(){}}
 const s=createToolService({keyLoaded:false,cli:{available:async()=>({available:true}),close(){}},opencli:fake,writeOperations:createWriteOperations(dir)})
 const p={tool:'opencli.spotify.play',input:{query:'test'},requestId:'r1',pageId:'p',sessionId:'s',cause:'user'}
 try{
  await assert.rejects(()=>s.invoke({...p,cause:'auto'},new AbortController().signal))
  await assert.rejects(()=>s.invoke(p,new AbortController().signal));assert.equal(calls,0)
  const approved={...p,requestId:'r2'},preview=await s.prepare(approved)
  await s.invoke({...approved,confirmationToken:preview.token},new AbortController().signal);assert.equal(calls,1)
  assert.equal((await s.catalog()).filter(t=>t.provider==='opencli').length,Object.values(TOOLS).filter(t=>t.provider==='opencli').length)
 }finally{s.close();await rm(dir,{recursive:true,force:true})}
})
