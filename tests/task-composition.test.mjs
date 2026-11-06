import test from 'node:test'
import assert from 'node:assert/strict'
import {composeTask,projectTaskView,compositionKey} from '../shared/cardspec/task-composition.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {makeScope,createStore,executeAction} from '../shared/cardspec/store.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {TOOLS} from '../shared/cardspec/tools.mjs'
const record=(tool,items,extra={})=>({tool,input:{query:'x'},status:'success',updatedAt:'2026-11-03T00:00:00Z',value:{items,source:tool,fetchedAt:'2026-11-03T00:00:00Z',truncated:false},...extra})
const video=()=>record('opencli.bilibili.search',[{bvid:'BV1',title:'同名内容',play:120,url:'https://www.bilibili.com/video/BV1'}])

test('composition contracts expand on demand without executing a tool or burdening unrelated components',async()=>{
 let calls=0;const id='opencli.bilibili.search',g=createGenerationTools({catalog:[{...TOOLS[id],id,available:true}],invoke:()=>{calls++;throw Error('unexpected execution')}})
 const tool=await g.execute('cli_describe',{id}),component=await g.execute('component_describe',{names:['task-board']}),text=await g.execute('component_describe',{names:['text']})
 assert.equal(tool.composition.kind,'content');assert.match(component.contract,/compose\(\{main:"a"/);assert.doesNotMatch(text.contract,/compose\(/);assert.equal(calls,0)
})
test('content merge keeps source metric semantics, exact dedupe and provenance',()=>{
 const v=composeTask({a:video(),b:record('opencli.xiaohongshu.search',[{id:'x1',title:'同名内容',likes:8,url:'https://www.xiaohongshu.com/explore/x1'},{id:'copy',title:'转载',url:'https://www.bilibili.com/video/BV1#fragment'}])})
 assert.equal(v.items.length,2);assert.equal(v.counts.duplicates,1);assert.equal(v.items[0].provenance.length,2);assert.equal(v.items[0].metrics[0].label,'播放');assert.equal(v.items[1].metrics[0].label,'点赞');assert.equal(v.items[1].metrics[0].value,8)
 assert.equal(v.items.some(i=>i.sentiment||i.heat),false)
})
test('verified social URL yields entity identity; signed links dedupe, exact counts coerce but shorthand stays unknown',()=>{
 const id='6ab2040300000000350279d9',base='https://www.xiaohongshu.com/search_result/'+id
 const v=composeTask({a:record('opencli.xiaohongshu.search',[{title:'测试',likes:'89',url:base+'?xsec_token=one'},{title:'同条记录',likes:'89',url:base+'?xsec_token=two'},{title:'缩写未知',likes:'1.2万',url:'https://example.com/explore/'+id}])})
 assert.equal(v.items.length,2);assert.equal(v.items[0].entityId,id);assert.equal(v.items[0].metrics[0].value,89);assert.equal(v.items[1].entityId,null);assert.equal(v.items[1].metrics[0].value,null)
})
test('invalid source fails locally, stale data excluded while failed refresh retains same-context content',()=>{
 const v=composeTask({a:video(),stale:record('opencli.xiaohongshu.search',[{id:'x',title:'旧对象'}],{current:false}),failed:{...video(),status:'error',error:'offline'},unknown:record('invented',[{}])})
 assert.equal(v.items.length,1);assert.equal(v.roles.stale.length,0);assert.equal(v.partial,true);assert.ok(v.issues.some(i=>i.code==='UNMAPPED_SOURCE'));assert.ok(v.issues.some(i=>i.code==='SOURCE_ERROR'))
})

test('failed new input exposes error without bringing back old-context rows; response drift is local',()=>{
 const v=composeTask({main:video(),failed:{...video(),current:false,status:'error',error:'offline'},drift:record('opencli.wttr.forecast',null)})
 assert.equal(v.roles.failed.length,0);assert.ok(v.issues.some(i=>i.role==='failed'&&i.code==='SOURCE_ERROR'))
 assert.ok(v.issues.some(i=>i.role==='drift'&&i.code==='INVALID_RESPONSE'));assert.equal(v.items.length,1)
})
test('heterogeneous roles remain separate, coordinates require known CRS, observations respect date',()=>{
 const main=record('opencli.ctrip.search',[{id:'a',name:'湖',lat:30,lon:120,coordSystem:'WGS84'},{id:'b',name:'未知坐标系',lat:30,lon:120}]),weather=record('opencli.wttr.forecast',[{date:'2026-11-03',description:'多云',avgTempC:0},{date:'2026-11-04',description:'雨',avgTempC:null}])
 const start=composeTask({places:main,weather}),v=composeTask({places:main,weather},{primary:'places',selectedId:start.items[0].id,date:'2026-11-03'})
 assert.equal(v.mode,'map');assert.equal(v.items.length,2);assert.equal(v.mapItems.length,1);assert.equal(v.unlocated.length,1);assert.equal(v.observations.length,1);assert.equal(v.observations[0].metrics[0].value,0)
 const small=projectTaskView(v,'2x2');assert.equal(small.items.length,1);assert.equal(v.items.length,2);assert.equal(small.remaining,1)
})
test('entity enrichment is explicitly related search, never an identity join on a title',()=>{
 const film=record('opencli.douban.top250',[{id:'m',title:'同名内容',rating:8}]),sources={main:film,videos:video()};const before=composeTask(sources)
 assert.equal(before.related.length,0);const v=composeTask(sources,{selectedId:before.items[0].id});assert.equal(v.related[0].relation,'related-search');assert.notEqual(v.related[0].entityId,v.focus.entityId)
})
test('composition bounded shape, missing metrics remain null and unknown options rejected',()=>{
 assert.throws(()=>composeTask(Object.fromEntries(Array.from({length:9},(_,i)=>[i,video()]))),/eight/)
 assert.throws(()=>composeTask({a:video()},{join:'title'}),/unknown option/)
 const v=composeTask({a:record('opencli.xiaohongshu.search',[{id:'x',title:'缺值',likes:'99赞'}])});assert.equal(v.items[0].metrics[0].value,null)
 assert.throws(()=>projectTaskView(v,'huge'),/invalid size/)
 assert.throws(()=>composeTask({a:[]}),/pass bindings.id/)
 assert.throws(()=>composeTask({a:video()},{primary:'constructor'}),/primary must name/)
 assert.equal(composeTask({a:record('constructor',[])}).issues[0].code,'UNMAPPED_SOURCE')
 assert.equal(projectTaskView(composeTask({a:video()}),'full').items.length,1)
})

test('named binding references resolve the same typed view without exposing response fields',()=>{
 const named=composeTask({a:'result'},{},{result:video()}),inline=composeTask({a:video()});assert.deepEqual(named.sourceBindings,{a:'result'});assert.deepEqual({...named,sourceBindings:{}},inline)
 assert.throws(()=>composeTask({a:'absent'}),/unknown binding/)
 for(const dialect of ['legacy','js-v1']){
 const r=compileCard('<card><binding id="a" tool="opencli.bilibili.search" input={{query:"x"}} initial={{items:[],source:"",fetchedAt:"",truncated:false}}/><derive id="v" value={compose({main:"a"})}/><task-board view={derived.v}/></card>',{final:true,context:{expressionDialect:dialect}})
 assert.equal(r.complete,true,JSON.stringify(r.diagnostics));assert.equal(makeScope(r.spec,createStore(),{bindings:{a:video()}}).derived.v.items.length,1)
 }
})

test('explicit invoke overrides stay current, while new requests and declared edits invalidate old data',()=>{
 const r=compileCard('<card><state id="q" type="string" initial="seed"/><binding id="a" tool="opencli.bilibili.search" input={{query:state.q,limit:3}}/><derive id="v" value={compose({main:"a"})}/><task-board view={derived.v}/></card>',{final:true,context:{expressionDialect:'js-v1'}})
 assert.ok(r.complete);const store=createStore();makeScope(r.spec,store)
 const b={...video(),valueInputKey:JSON.stringify({query:'picked'}),definitionKey:JSON.stringify({query:'seed',limit:3}),inputKey:JSON.stringify({query:'picked'})},bindings={a:b}
 assert.equal(makeScope(r.spec,store,{bindings}).derived.v.items.length,1)
 b.inputKey=JSON.stringify({query:'other'});assert.equal(makeScope(r.spec,store,{bindings}).derived.v.items.length,0)
 b.inputKey=b.valueInputKey;store.values.q='changed';assert.equal(makeScope(r.spec,store,{bindings}).derived.v.items.length,0)
})

test('verified Bilibili score mapping depends on search type, video ID comes only from canonical video URL',()=>{
 const row={title:'视频',score:123,url:'https://www.bilibili.com/video/BV1xN41137LY'}
 const v=composeTask({a:record('opencli.bilibili.search',[row])}).items[0]
 assert.equal(v.entityId,'BV1xN41137LY');assert.equal(v.metrics[0].label,'播放')
 const u=composeTask({a:record('opencli.bilibili.search',[{...row,url:'https://space.bilibili.com/123'}],{input:{type:'user'}})}).items[0]
 assert.equal(u.entityId,null);assert.equal(u.metrics[0].label,'粉丝')
})
test('both expression dialects compile; shared state invalidates only affected result inputs',()=>{
 for(const dialect of ['legacy','js-v1']){
 const r=compileCard('<card><state id="q" type="string" initial="A"/><binding id="a" tool="opencli.bilibili.search" input={{query:state.q}} initial={{items:[],source:"",fetchedAt:"",truncated:false}}/><derive id="v" value={compose({main:bindings.a})}/><task-board view={derived.v}/><action id="change"><set target="q" value="B"/></action></card>',{final:true,context:{expressionDialect:dialect}})
 assert.equal(r.complete,true,JSON.stringify(r.diagnostics));const store=createStore(),bindings={a:{...video(),valueInputKey:compositionKey({query:'A'})}};assert.equal(makeScope(r.spec,store,{bindings}).derived.v.items.length,1)
 executeAction(r.spec,store,'change',{bindings});const v=makeScope(r.spec,store,{bindings}).derived.v;assert.equal(v.items.length,0);assert.equal(v.statuses[0].status,'stale')
 }
})
