import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createToolResultCache,toolCachePolicy} from '../server/tools/result-cache.mjs'
import {createToolService} from '../server/tools/service.mjs'
import {TOOLS} from '../shared/cardspec/tools.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createCardSession} from '../src/cardspec/tool-session.mjs'
import {prioritizedBindings} from '../shared/cardspec/binding-schedule.mjs'
const turn=()=>new Promise(r=>setTimeout(r,0)),policy={ttlMs:1000}
const feed={items:[],source:'test',fetchedAt:'2026-10-28T00:00:00Z'}
const value={kind:'json',value:feed}
test('cache canonicalizes parameters, keeps retrieval time, expires, and bypasses on refresh',async()=>{
 let time=100,calls=0;const cache=createToolResultCache({now:()=>time}),execute=async()=>{calls++;return value}
 const req={tool:'feed',scope:'public',policy,execute,input:{a:1,b:2}}
 const first=await cache.get(req);time=400;const hit=await cache.get({...req,input:{b:2,a:1}})
 assert.equal(calls,1);assert.equal(hit.cache.status,'hit');assert.equal(hit.cache.fetchedAt,first.cache.fetchedAt)
 hit.value.items.push({fake:true});assert.equal((await cache.get(req)).value.items.length,0)
 await cache.get({...req,mode:'reload'});assert.equal(calls,2)
 time=1500;await cache.get(req);assert.equal(calls,3)
})
test('concurrent consumers share work; cancelling one does not cancel the others',async()=>{
 const cache=createToolResultCache();let resolve,calls=0,signal
 const request={tool:'feed',input:{},policy,execute:async s=>{calls++;signal=s;return new Promise(r=>resolve=r)}}
 const a=new AbortController(),b=new AbortController()
 const one=cache.get({...request,signal:a.signal}),two=cache.get({...request,signal:b.signal})
 const cancelled=assert.rejects(one,{name:'AbortError'});await turn();a.abort();await cancelled
 assert.equal(signal.aborted,false);resolve(value);assert.equal((await two).cache.status,'coalesced');assert.equal(calls,1)
})
test('aborted or failed calls cannot populate cache; scopes and memory bounds are respected',async()=>{
 const cache=createToolResultCache({maxEntries:2});let calls=0
 const req={tool:'feed',input:{},policy,execute:async()=>{calls++;return value}}
 await cache.get({...req,scope:'a'});await cache.get({...req,scope:'b'});assert.equal(calls,2)
 await cache.get({...req,scope:'c'});assert.equal(cache.stats().entries,2);await cache.get({...req,scope:'a'});assert.equal(calls,4)
 const controller=new AbortController();controller.abort();await assert.rejects(()=>cache.get({...req,signal:controller.signal}));assert.equal(calls,4)
 await assert.rejects(()=>cache.get({...req,tool:'failure',execute:async()=>{throw Error('offline')}}));assert.equal(cache.stats().pending,0)
 cache.clear();assert.equal(cache.stats().entries,0)
})
test('all consumers leaving aborts the request and a late result cannot enter cache',async()=>{
 const cache=createToolResultCache();let resolve,signal;const c=new AbortController()
 const p=cache.get({tool:'feed',input:{},policy,signal:c.signal,execute:async s=>{signal=s;return new Promise(r=>resolve=r)}})
 const rejected=assert.rejects(p,{name:'AbortError'});await turn();c.abort();await rejected;assert.equal(signal.aborted,true)
 resolve(value);await turn();assert.equal(cache.stats().entries,0)
})
test('only read-only CLI data is cacheable, volatile inventory has a short TTL',()=>{
 assert.equal(toolCachePolicy(TOOLS['glm.generate']),null)
 assert.equal(toolCachePolicy({id:'x',provider:'opencli',readOnly:false}),null)
 assert.equal(toolCachePolicy(TOOLS['dataset.analyze']),null)
 assert.equal(toolCachePolicy(TOOLS['opencli.12306.trains']).ttlMs,15000)
 assert.equal(toolCachePolicy(TOOLS['opencli.douban.top250']).scope,'session')
})
test('service shares public reads across request/card IDs, validates cache entries, and honors reload',async()=>{
 let calls=0;const service=createToolService({cli:{invoke:async()=>{calls++;return feed},close(){}},opencli:{close(){}}})
 const request={tool:'autocli.hackernews.top',input:{limit:3},pageId:'a',sessionId:'a',requestId:'1'}
 assert.equal((await service.invoke(request,new AbortController().signal)).cache.status,'miss')
 assert.equal((await service.invoke({...request,pageId:'b',sessionId:'b',requestId:'2'},new AbortController().signal)).cache.status,'hit');assert.equal(calls,1)
 await service.invoke({...request,requestId:'3',cache:'reload'},new AbortController().signal);assert.equal(calls,2);service.close()
 const invalid=createToolService({cli:{invoke:async()=>({items:'invalid'}),close(){}},opencli:{close(){}}})
 await assert.rejects(()=>invalid.invoke(request,new AbortController().signal));assert.equal(invalid.cacheStats().entries,0);invalid.close()
})
test('browser result scope isolates card sessions and changing the connection invalidates reuse',async()=>{
 let connection='a',calls=0;const service=createToolService({cli:{close(){}},opencli:{cacheContext:async()=>connection,invoke:async()=>{calls++;return {...feed,truncated:false}},close(){}}})
 const p={tool:'opencli.douban.top250',input:{},requestId:'1',pageId:'p',sessionId:'s'}
 await service.invoke(p,new AbortController().signal);await service.invoke({...p,requestId:'2'},new AbortController().signal);assert.equal(calls,1)
 await service.invoke({...p,requestId:'3',sessionId:'other'},new AbortController().signal);assert.equal(calls,2)
 connection='b';await service.invoke({...p,requestId:'4'},new AbortController().signal);assert.equal(calls,3);service.close()
})
function compiled(){const c=compileCard(`<card>
 <binding id="extra" tool="autocli.lobsters.hot" input={{}} load="visible"/>
 <binding id="main" tool="autocli.hackernews.top" input={{}} load="visible"/>
 <binding id="other" tool="autocli.devto.top" input={{}} load="visible"/>
 <binding id="detail" tool="autocli.hackernews.search" input={{query:bindings.main.value.source}} load="visible"/>
 <binding id="manual" tool="autocli.devto.top" input={{}} load="manual"/>
 <text priority="supporting">{bindings.extra.value.source}</text>
 <text priority="required">{bindings.detail.value.source}</text>
 </card>`.replaceAll('<binding ','<binding initial={{items:[],source:"",fetchedAt:""}} '),{final:true});assert.equal(c.complete,true,JSON.stringify(c.diagnostics));return c.spec}
test('initial visible loading prioritizes dependencies and core content, caps parallel requests and pumps the queue',async()=>{
 const spec=compiled(),order=prioritizedBindings(spec).map(([id])=>id);assert.ok(order.indexOf('main')<order.indexOf('extra'))
 const requests=[],pending=[];const s=createCardSession(spec,{transport:async p=>{requests.push(p);return new Promise(r=>pending.push(()=>r(value)))}})
 s.setActivity({complete:false,visible:true});assert.equal(requests.length,0)
 s.setActivity({complete:true});assert.equal(requests.length,2);assert.equal(requests[0].tool,'autocli.hackernews.top')
 pending.shift()();await turn();assert.equal(requests[2].tool,'autocli.hackernews.search')
 while(pending.length){pending.shift()();await turn()}
 assert.equal(requests.length,4);assert.equal(s.current().bindings.manual,undefined);s.dispose()
})
test('hidden cards do not drain pending prefetch, manual refresh bypasses host cache and keeps original fetch time',async()=>{
 const requests=[];const s=createCardSession(compiled(),{transport:async p=>{requests.push(p);return {...value,cache:{status:'hit',fetchedAt:'2026-10-28T00:00:00Z',expiresAt:'2026-10-28T00:01:00Z'}}}})
 s.setActivity({complete:true,visible:false});await turn();assert.equal(requests.length,0)
 await s.invoke({binding:'main'});assert.equal(requests[0].cache,undefined);assert.equal(s.current().bindings.main.updatedAt,'2026-10-28T00:00:00Z')
 await s.retry('main');assert.equal(requests[1].cache,'reload');s.dispose()
})
