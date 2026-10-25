import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createBoundBrowser} from '../server/tools/opencli-bound.mjs'
import {TOOLS,selectToolIds,validateJson} from '../shared/cardspec/tools.mjs'
import {openCliInput,normalizeOpenCli} from '../server/tools/opencli.mjs'
const turn=()=>new Promise(r=>setTimeout(r,0))
function fixture(){let n=0;const calls=[];return {calls,host:createBoundBrowser(async(op,lease)=>{calls.push(op);return op==='bind'?{profile:lease.profile,session:'s'+(++n),daemonPid:123,page:'target'}:{}})}}
test('restoring an unbound mode makes no browser calls and cannot fall back to an owned window',async()=>{
 const {host,calls}=fixture();await host.release();assert.deepEqual(calls,[])
 assert.equal(host.status({}).mode,'bound');assert.equal(host.status({}).bound,false)
 await assert.rejects(()=>host.run(()=>{}),/绑定已失效/)
})
test('bound calls serialize; unbind releases lease without closing a user window',async()=>{
 const {host,calls}=fixture();await host.bind('p');let finish;const order=[]
 const a=host.run(async()=>{order.push('a');await new Promise(r=>finish=r);order.push('a-end')})
 const b=host.run(async()=>order.push('b'));await turn();assert.deepEqual(order,['a']);finish();await Promise.all([a,b]);assert.deepEqual(order,['a','a-end','b'])
 await host.release();assert.deepEqual(calls,['bind','unbind']);await assert.rejects(()=>host.run(()=>{}),/绑定已失效/)
})
test('cancelled consumer drains its read before the next adapter and preserves the lease',async()=>{
 const {host,calls}=fixture();await host.bind('p');const c=new AbortController();let finish,ran=false
 const a=host.run(async()=>{await new Promise(r=>finish=r);throw Error('empty response')},c.signal)
 const aCheck=assert.rejects(a,/empty response/);const b=host.run(async()=>{ran=true})
 await turn();c.abort();await turn();assert.equal(ran,false);finish();await Promise.all([aCheck,b]);assert.equal(ran,true);assert.deepEqual(calls,['bind'])
 assert.equal(host.status({daemonPid:123,profile:'p'}).bound,true)
})
test('daemon restart or profile change does not fall back to a different page',async()=>{
 const {host}=fixture();await host.bind('p');assert.equal(host.status({daemonPid:123,profile:'p'}).bound,true)
 assert.equal(host.status({daemonPid:124,profile:'p'}).bound,false);await assert.rejects(()=>host.run(()=>{}),/绑定已失效/)
 await host.bind('p');assert.equal(host.status({daemonPid:123,profile:'another'}).bound,false)
})
test('failed bind cannot leave the previous lease usable',async()=>{
 let fail=false;const host=createBoundBrowser(async op=>{if(op==='bind'){if(fail)throw Error('wrong page');return {profile:'p',daemonPid:1}}})
 await host.bind('p');fail=true;await assert.rejects(()=>host.bind('p'),/wrong page/);await assert.rejects(()=>host.run(()=>{}),/绑定已失效/)
})
test('upstream timed-out navigation retires binding before another adapter can run',async()=>{
 const {host,calls}=fixture();await host.bind('p')
 await assert.rejects(()=>host.run(async()=>{throw Error('Browser navigate command timed out after 25s; it may still complete in the browser.')}),/timed out/)
 await assert.rejects(()=>host.run(()=>assert.fail('must not run')),/绑定已失效/)
 assert.deepEqual(calls,['bind','unbind'])
})
test('expanded schemas preserve real numeric IDs and bounded paging, with no empty enums',()=>{
 assert.equal(openCliInput('opencli.tvmaze.show',{id:12345}).id,12345)
 assert.equal(openCliInput('opencli.tvmaze.show',{id:'12345'}).id,12345)
 assert.throws(()=>openCliInput('opencli.tvmaze.show',{id:'12;34'}))
 assert.equal(openCliInput('opencli.apple-podcasts.episodes',{id:1291579828}).id,'1291579828')
 assert.equal(normalizeOpenCli('opencli.apple-podcasts.search',[{id:1291579828}]).items[0].id,'1291579828')
 assert.throws(()=>openCliInput('opencli.douban.top250',{limit:1000}))
 assert.equal(openCliInput('opencli.wikipedia.page',{title:'Moon',paragraphs:0}).paragraphs,0)
 for(const t of Object.values(TOOLS).filter(t=>t.provider==='opencli'&&!t.unsupportedReason)){
  for(const [key,p] of Object.entries(t.inputSchema.properties)){
   assert.ok(!p.enum||p.enum.length>0,t.id+'.'+key)
   const def=t.defaults[t.mapping[key]];if(def!==undefined)validateJson(def,p,t.id+'.'+key)
  }
 }
})
test('large catalog stays bounded and relevant, including named sites and exact commands',()=>{
 const all=Object.keys(TOOLS)
 for(const goal of ['小宇宙播客','Steam 游戏','汽车之家车型','英文单词词典','豆瓣 top250','东财股票行情','维基百科']){
  const ids=selectToolIds(all,goal);assert.ok(ids.some(id=>id.startsWith('opencli.')),goal);assert.ok(ids.filter(id=>id.startsWith('opencli.')).length<=18)
 }
 assert.ok(selectToolIds(all,'opencli.douban.top250').includes('opencli.douban.top250'))
 assert.ok(selectToolIds(all,'制作单词学习卡，用 OpenCLI 词典查 serendipity，可改词，展示释义和发音。').includes('opencli.dictionary.search'))
 assert.ok(!selectToolIds(all,'制作单词学习卡，用 OpenCLI 词典查 serendipity').includes('opencli.bilibili.history'))
 assert.ok(!selectToolIds(all,'上海天气').includes('opencli.steam.search'))
})
