import {test} from 'node:test'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
import {TOOL_DEMO,TOOL_PAGE,TOOL_SLOT} from '../shared/cardspec/tool-fixtures.mjs'
import {createCardSession} from '../src/cardspec/tool-session.mjs'
import {commandArgs,normalizeFeed} from '../server/tools/autocli.mjs'
import {createToolService,localToolRequest} from '../server/tools/service.mjs'
import {activeCollectionBindings,collectionBindings} from '../shared/cardspec/tool-collection-state.mjs'
const feed=normalizeFeed('autocli.hackernews.top',[{title:'A',author:'a',url:'https://example.com/a',score:3}])
function spec(source=TOOL_DEMO,id='root'){const r=compileCard(source,{final:true,cardId:id});assert.equal(r.complete,true,JSON.stringify(r.diagnostics));return r.spec}
const turn=()=>new Promise(r=>setTimeout(r,0))

test('result leases follow the displayed conditional source, while retaining stale-input checks',async()=>{
 const source='<card><state id="mode" type="string" initial="hot"/><state id="query" type="string" initial="A"/><state id="picked" type="record" initial={{}}/><binding id="hot" tool="autocli.hackernews.top" input={{limit:3}} initial={{items:[],source:"",fetchedAt:""}}/><binding id="search" tool="autocli.hackernews.search" input={{query:state.query}} initial={{items:[],source:"",fetchedAt:""}}/><derive id="rows" value={state.mode==="search"?bindings.search.value.items:bindings.hot.value.items}/><derive id="filtered" value={derived.rows.filter(row=>row.title!=="")}/><text>Results</text><action id="mode"><set target="mode" value={event.value}/></action><action id="query"><set target="query" value={event.value}/></action><action id="choose"><set target="picked" value={args}/></action></card>'
 const compiled=compileCard(source,{final:true,context:{expressionDialect:'js-v1'}});assert.equal(compiled.complete,true,JSON.stringify(compiled.diagnostics))
 const s=createCardSession(compiled.spec,{transport:async()=>({kind:'json',value:feed})});s.setActivity({complete:true})
 const ast=compiled.spec.derived.filtered,origins=()=>activeCollectionBindings(compiled.spec,ast,s.scope(),{rowsOnly:true})
 assert.deepEqual(new Set(collectionBindings(compiled.spec,ast)),new Set(['hot','search']))
 await s.invoke({binding:'hot'});assert.deepEqual(origins(),['hot'])
 assert.doesNotThrow(()=>s.fire('choose',{args:feed.items[0],sourceLeases:s.sourceLeases(origins())}),'unloaded search must not block visible hot rows')
 s.fire('mode',{event:{value:'search'}});assert.deepEqual(origins(),['search']);await s.invoke({binding:'search'})
 assert.doesNotThrow(()=>s.assertSourcesCurrent(s.sourceLeases(origins())))
 s.fire('query',{event:{value:'B'}});assert.throws(()=>s.assertSourcesCurrent(s.sourceLeases(origins())),/查询条件或结果已改变/)
 s.fire('mode',{event:{value:'hot'}});assert.doesNotThrow(()=>s.assertSourcesCurrent(s.sourceLeases(origins())),'stale inactive search must not block hot rows');s.dispose()
})

test('result actions cannot reuse old query rows; unrelated edits and failed refresh preserve usable snapshots',async()=>{
 const source='<card><state id="query" type="string" initial="A"/><state id="note" type="string" initial=""/><state id="picked" type="record" initial={{}}/><binding id="rows" tool="autocli.hackernews.search" input={{query:state.query}} initial={{items:[],source:"",fetchedAt:""}}/><text>搜索</text><action id="query"><set target="query" value={event.value}/></action><action id="note"><set target="note" value={event.value}/></action><action id="choose"><set target="picked" value={args}/></action></card>'
 let fail=false,calls=0
 const s=createCardSession(spec(source),{transport:async()=>{calls++;if(fail)throw Error('offline');return {kind:'json',value:feed}}})
 s.setActivity({complete:true,visible:true});await s.invoke({binding:'rows'})
 const leases=s.sourceLeases(['rows']),row=feed.items[0]
 s.fire('choose',{args:row,sourceLeases:leases});assert.deepEqual(s.current().store.values.picked,row)
 s.fire('note',{event:{value:'unrelated'}});assert.doesNotThrow(()=>s.assertSourcesCurrent(leases))
 s.fire('query',{event:{value:'B'}})
 assert.throws(()=>s.fire('choose',{args:{...row,title:'stale overwrite'},sourceLeases:leases}),/查询条件或结果已改变/)
 assert.equal(s.current().store.values.picked.title,row.title);assert.equal(calls,1);assert.deepEqual(s.current().bindings.rows.value,feed)
 s.fire('query',{event:{value:'A'}});assert.doesNotThrow(()=>s.assertSourcesCurrent(leases))
 fail=true;await s.invoke({binding:'rows'});assert.equal(s.current().bindings.rows.status,'error');assert.doesNotThrow(()=>s.assertSourcesCurrent(leases),'same-query last success remains useful after failure')
 fail=false;await s.invoke({binding:'rows'});assert.throws(()=>s.assertSourcesCurrent(leases),/查询条件或结果已改变/,'old render closure cannot use a replaced result')
 assert.doesNotThrow(()=>s.fire('choose',{args:row,sourceLeases:s.sourceLeases(['rows'])}));s.dispose()
})
function session(options={}){const s=createCardSession(spec(),options);s.setActivity({complete:true,enabled:true});return s}
test('compiler probes stay pure; invocation captures input; failed local transaction discards effects',()=>{
 const s=spec(),store=createStore(),effects=[];makeScope(s,store)
 executeAction(s,store,'refresh',{effects});assert.equal(effects.length,1);assert.equal(effects[0].tool,'autocli.hackernews.top')
 s.actions.refresh.push({type:'set',target:'note',value:{type:'literal',value:3}})
 const discarded=[];assert.throws(()=>executeAction(s,store,'refresh',{effects:discarded}));assert.equal(store.values.note,'');assert.equal(discarded.length,0)
 assert.equal(compileCard(TOOL_DEMO.replace('load="visible" refresh={60}','load="wat"'),{final:true}).complete,false)
 assert.equal(compileCard(TOOL_DEMO.replace('target="slot:detail"','target="slot:missing"'),{final:true}).complete,false)
})
test('CLI argv are structured, output IDs stable and schema is checked',()=>{
 assert.deepEqual(commandArgs('autocli.hackernews.search',{query:'--delete',sort:'date'}).slice(-2),['--','--delete'])
 assert.throws(()=>commandArgs('autocli.gh.repo',{limit:2}));assert.throws(()=>commandArgs('autocli.hackernews.top',{limit:200}))
 assert.equal(normalizeFeed('autocli.hackernews.top',[{title:'A',author:'a',url:'https://example.com/a',rank:9}]).items[0].id,feed.items[0].id)
 assert.equal(normalizeFeed('autocli.hackernews.top',[{title:'bad',url:'javascript:alert(1)'}]).items[0].url,null)
})
test('visible load is paused, duplicate calls coalesce, unrelated state does not discard result',async()=>{
 let calls=0,resolve;const s=session({transport:async()=>{calls++;return new Promise(r=>{resolve=r})}})
 s.tick();assert.equal(calls,0);s.setActivity({visible:true});s.tick();assert.equal(calls,1)
 s.fire('refresh');assert.equal(calls,1);s.fire('note',{event:{value:'keep'}})
 resolve({kind:'json',value:feed});await turn();assert.equal(s.current().bindings.feed.value.items.length,1);assert.equal(s.current().store.values.note,'keep');s.dispose()
})
test('changing selected input invalidates pending GLM, leaving page cancels late result',async()=>{
 let resolve;const s=session({transport:async p=>p.tool!=='glm.generate'?{kind:'json',value:{...feed,items:[...feed.items,{...feed.items[0],id:'b',title:'B'}]}}:new Promise(r=>{resolve=r})})
 await s.invoke({binding:'feed'});s.fire('next');s.fire('select',{args:{id:'b'}})
 resolve({kind:'page',spec:spec(TOOL_PAGE,'next')});await turn();assert.equal(s.pages.length,1);assert.equal(s.current().bindings.explain.status,'cancelled');s.dispose()
})
test('slot state is isolated; page history restores inputs, branches, and session storage',async()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};let seq=0
 const transport=async p=>p.tool!=='glm.generate'?{kind:'json',value:feed}:p.target.startsWith('slot:')?{kind:'slot',spec:spec(TOOL_SLOT,'slot')}:{kind:'page',spec:spec(TOOL_PAGE,'p'+(++seq))}
 const s=session({transport,storage,persistenceKey:'test'});await s.invoke({binding:'feed'});s.fire('note',{event:{value:'root note'}})
 await s.invoke({binding:'explain',target:'slot:detail'});s.updateSlot('detail','like',{});assert.equal(s.current().slots.detail.store.values.likes,1)
 await s.invoke({binding:'explain',target:'page'});s.fire('note',{event:{value:'page note'}});s.navigate(-1);assert.equal(s.current().store.values.note,'root note');s.navigate(1);assert.equal(s.current().store.values.note,'page note')
 s.save();s.dispose();const restored=session({transport,storage,persistenceKey:'test'});assert.equal(restored.index,1);restored.navigate(-1);assert.equal(restored.current().slots.detail.store.values.likes,1)
 await restored.invoke({binding:'explain',target:'page'});assert.equal(restored.pages.length,2);assert.equal(restored.current().id,'p2');restored.dispose()
})
test('failure preserves last successful value',async()=>{
 let fail=false;const s=session({transport:async()=>{if(fail)throw new Error('offline');return {kind:'json',value:feed}}})
 await s.invoke({binding:'feed'});fail=true;await s.invoke({binding:'feed'});assert.equal(s.current().bindings.feed.status,'error');assert.equal(s.current().bindings.feed.value.items.length,1)
 assert.equal(s.pages.length,1);s.dispose()
})
test('auto chain cannot generate; depth bound stops recursion; disabled module makes no calls',async()=>{
 let calls=0;const s=session({transport:async()=>{calls++;return {kind:'json',value:feed}}})
 await s.invoke({binding:'explain',target:'page'},{cause:'auto'});assert.equal(calls,0)
 await s.invoke({binding:'feed'},{depth:3});assert.equal(calls,0)
 s.setActivity({enabled:false});await s.invoke({binding:'feed'});assert.equal(calls,0);s.dispose()
})
test('server denies nonlocal origin; deduplicates request IDs, schema checks model JSON',async()=>{
 assert.equal(localToolRequest({socket:{remoteAddress:'127.0.0.1'},headers:{host:'127.0.0.1:8787',origin:'https://evil.example'}}),false)
 let calls=0;const service=createToolService({keyLoaded:true,streamUpstream:async(_m,{onPiece})=>{calls++;onPiece({content:'{"answer":42}'})},cli:{available:async()=>({available:true}),close(){}}})
 const p={tool:'glm.generate',target:'binding',input:{prompt:'answer',schema:{type:'object',required:['answer'],properties:{answer:{type:'number'}}}},requestId:'a',pageId:'p',sessionId:'s'}
 const [a,b]=await Promise.all([service.invoke(p,new AbortController().signal),service.invoke(p,new AbortController().signal)]);assert.deepEqual(a,b);assert.equal(calls,1)
 await assert.rejects(()=>service.invoke({...p,input:{...p.input,prompt:'different'}},new AbortController().signal));service.close()
})
test('response callback sees current state rather than request snapshot',async()=>{
 let resolve
 const source=TOOL_DEMO.replace('<action id="note">','<action id="received"><set target="note" value={state.note+"!"}/></action><action id="note">')
 const s=createCardSession(spec(source),{transport:async()=>new Promise(r=>{resolve=r})});s.setActivity({complete:true})
 const pending=s.invoke({binding:'feed',onSuccess:'received'});s.fire('note',{event:{value:'latest'}});resolve({kind:'json',value:feed});await pending
 assert.equal(s.current().store.values.note,'latest!');s.dispose()
})
test('polling respects clock, pauses offscreen and does not restart explicitly cancelled loads',async()=>{
 let time=0,calls=0;const s=session({now:()=>time,transport:async()=>{calls++;return {kind:'json',value:feed}}})
 s.setActivity({visible:true});await turn();assert.equal(calls,1)
 time=59000;s.tick();await turn();assert.equal(calls,1)
 time=61000;s.tick();await turn();assert.equal(calls,2)
 s.setActivity({visible:false});time=130000;s.tick();await turn();assert.equal(calls,2)
 s.setActivity({visible:true});await turn();assert.equal(calls,3);s.dispose()
 const pending=session({transport:async(_p,signal)=>{calls++;return new Promise((_r,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted'))))}})
 pending.setActivity({visible:true});pending.cancel();await turn();const n=calls;pending.tick();await turn();assert.equal(calls,n);pending.dispose()
})
test('history retains twenty pages',async()=>{
 let seq=0;const s=session({transport:async p=>p.tool==='glm.generate'?({kind:'page',spec:spec(TOOL_PAGE,'p'+(++seq))}):({kind:'json',value:feed})})
 await s.invoke({binding:'feed'})
 await s.invoke({binding:'explain',target:'page'})
 for(let i=0;i<22;i++)await s.invoke({binding:'more',target:'page'})
 assert.equal(s.pages.length,20);assert.equal(s.index,19);assert.match(s.notice,/20/);s.dispose()
})

test('invoke input override is captured, retry keeps it, and changed input discards stale output',async()=>{
 const source=TOOL_DEMO.replace('<invoke binding="explain" target="page"/>','<invoke binding="explain" target="page" input={{prompt:"Explain "+state.note}}/>')
 let fail=true,resolve;const requests=[]
 const s=createCardSession(spec(source),{transport:async p=>{requests.push(p);if(fail)throw new Error('offline');return new Promise(r=>{resolve=r})}});s.setActivity({complete:true})
 s.fire('note',{event:{value:'first request'}});s.fire('next');await turn();assert.equal(requests[0].input.prompt,'Explain first request')
 fail=false;const pending=s.retry('explain');assert.equal(requests[1].input.prompt,'Explain first request')
 s.fire('note',{event:{value:'changed request'}});resolve({kind:'page',spec:spec(TOOL_PAGE,'late')});await pending
 assert.equal(s.pages.length,1);assert.equal(s.current().bindings.explain.status,'cancelled');s.dispose()
})

test('automatic refresh pauses during GLM generation; incomplete cards never auto load',async()=>{
 let time=0,reads=0,resolve
 const s=createCardSession(spec(),{now:()=>time,transport:async p=>p.tool==='glm.generate'?new Promise(r=>{resolve=r}):(reads++,{kind:'json',value:feed})})
 s.setActivity({visible:true,complete:false});assert.equal(reads,0)
 s.setActivity({complete:true});await turn();assert.equal(reads,1)
 const pending=s.invoke({binding:'explain',target:'slot:detail'});time=61000;s.tick();assert.equal(reads,1)
 resolve({kind:'slot',spec:spec(TOOL_SLOT,'slot')});await pending;assert.ok(s.current().slots.detail)
 s.tick();await turn();assert.equal(reads,2);s.dispose()
})

test('failed response transaction keeps prior binding and never dispatches its effects',async()=>{
 let calls=0
 // Inject an invalid response transaction after compile to exercise runtime rollback.
 const compiled=spec();compiled.actions.received=[...compiled.actions.refresh,{type:'set',target:'note',value:{type:'literal',value:[]}}]
 const s=createCardSession(compiled,{transport:async()=>{calls++;return {kind:'json',value:feed}}});s.setActivity({complete:true})
 await s.invoke({binding:'feed'});const previous=structuredClone(s.current().bindings.feed.value)
 await s.invoke({binding:'feed',onSuccess:'received'});await turn()
 assert.equal(calls,2);assert.equal(s.current().store.values.note,'');assert.deepEqual(s.current().bindings.feed.value,previous);assert.equal(s.current().bindings.feed.status,'error');s.dispose()
})

test('callback chains can refresh the same binding and stop after three actual calls',async()=>{
 const compiled=spec();compiled.actions.again=[{...compiled.actions.refresh[0],onSuccess:'again'}]
 let calls=0;const s=createCardSession(compiled,{transport:async()=>{calls++;return {kind:'json',value:feed}}});s.setActivity({complete:true})
 await s.invoke({binding:'feed',onSuccess:'again'});await turn();await turn()
 assert.equal(calls,3);assert.match(s.current().error,/三次/);s.dispose()
})

test('slot and page success callbacks commit parent state before atomic replacement',async()=>{
 const compiled=spec();compiled.actions.received=[{type:'set',target:'note',value:{type:'literal',value:'received'}}]
 const s=createCardSession(compiled,{transport:async p=>p.tool==='glm.generate'?({kind:p.target==='page'?'page':'slot',spec:spec(p.target==='page'?TOOL_PAGE:TOOL_SLOT,'generated')}):({kind:'json',value:feed})});s.setActivity({complete:true})
 await s.invoke({binding:'feed'})
 await s.invoke({binding:'explain',target:'slot:detail',onSuccess:'received'});assert.equal(s.current().store.values.note,'received');assert.ok(s.current().slots.detail)
 s.fire('note',{event:{value:'reset'}});await s.invoke({binding:'explain',target:'page',onSuccess:'received'});s.navigate(-1);assert.equal(s.current().store.values.note,'received');s.dispose()
})

test('unclosed nested arrays produce precise delimiter diagnostics without swallowing sibling declarations',()=>{
 const result=compileCard('<card schemaVersion="1"><data id="a" value={[{x:[1,2]} /><state id="n" type="number" initial={0}/><text>Ready</text></card>',{final:true})
 assert.equal(result.complete,false);assert.ok(result.diagnostics.some(d=>d.message.includes('missing ]} before')))
})
