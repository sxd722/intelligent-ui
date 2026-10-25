import test from 'node:test'
import assert from 'node:assert/strict'
import {getQuickJS} from 'quickjs-emscripten'
import {executeLogic} from '../shared/cardspec/logic-engine.mjs'
import {logicJson,validateLogicSource,logicTickMs} from '../shared/cardspec/logic-contract.mjs'
import {validateLogicView} from '../shared/cardspec/logic-view.mjs'
import {createStore,makeScope} from '../shared/cardspec/store.mjs'
import {createLogicController} from '../src/cardspec/logic-controller.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {LOGIC_FIXTURES,HEAT_SOURCE,ORDER_SOURCE} from '../shared/cardspec/logic-fixtures.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import {collectImages} from '../shared/cardspec/images.mjs'
import {createCardSession} from '../src/cardspec/tool-session.mjs'
const q=await getQuickJS(),exec=(source,state={},event={},input={})=>executeLogic(q,{source,state,event,input})
const wait=()=>new Promise(r=>setTimeout(r,5))

test('non-finite results report their exact state path for repair without leaking sibling values',()=>{
 for(const [body,path,type]of [
  ['return {hidden:"private",g:[[1,NaN]]}','state["g"][0][1]','NaN'],
  ['return {rows:[{value:Infinity}]}','state["rows"][0]["value"]','Infinity'],
  ['return {rows:[undefined]}','state["rows"][0]','undefined'],
  ['return {f:()=>1}','state["f"]','function'],
 ]){
  assert.throws(()=>exec(`function update(){${body}}`),e=>e.message.includes(path)&&e.message.includes(type)&&!e.message.includes('private'))
 }
})

test('QuickJS snapshots omit absent optional fields consistently with restored JSON',()=>{
 const source='function update(state,event,input){return {id:input.id,year:input.year,nested:{present:2,missing:undefined}}}'
 assert.deepEqual(exec(source,{}, {}, {id:'a'}),{id:'a',nested:{present:2}})
 assert.equal(logicJson({id:'a',year:undefined}),'{"id":"a"}')
 for(const source of ['return {items:[undefined]}','return {n:Infinity}','return {f:()=>1}'])assert.throws(()=>exec(`function update(){${source}}`))
 assert.throws(()=>logicJson(undefined));assert.throws(()=>logicJson([undefined]))
})
test('compile/preview never executes JS; local events cannot reach outer actions',async()=>{
 for(const [id,text] of Object.entries(LOGIC_FIXTURES)){
  const r=compileCard(text,{final:true});assert.equal(r.complete,true,JSON.stringify(r.diagnostics));assert.deepEqual(collectImages(r.spec),[])
  await validateRichContent(r)
  // The demonstration intentionally exposes fault/loop controls. The final
  // generation harness now detects these in legacy mode too; compilation did not.
  if(id==='logicHeat'){assert.equal(r.complete,false);assert.match(r.diagnostics.at(-1).message,/event (fault|loop)/)}
  else assert.equal(r.complete,true,JSON.stringify(r.diagnostics))
 }
 const r=compileCard('<card><logic id="x" initial={{n:0}} source="function update(state,event,input){while(true){}}"><text>{local.n}</text><button onPress="go">Go</button></logic></card>',{final:true});assert.equal(r.complete,true)
})
test('logic grammar rejects nested modules, ambient local, malformed source, and network UI',()=>{
 for(const text of [
 '<card><text>{local.n}</text></card>',
 '<card><logic initial={{}} source="function update(state,event,input){return state}"/></card>',
 '<card><logic id="x" initial={{}} source="fetch(1)"/></card>',
 '<card><logic id="x" initial={{}} source="function update(state,event,input){return state}"><link url="https://example.org">外链</link></logic></card>',
 '<card><logic id="x" initial={{}} source="function update(state,event,input){return state}"><image query="secret"/></logic></card>',
 '<card><logic id="x" initial={{}} source="function update(state,event,input){return state}"><logic id="y" initial={{}} source="function update(state,event,input){return state}"/></logic></card>'
 ])assert.equal(compileCard(text,{final:true}).complete,false,text)
 assert.throws(()=>validateLogicSource('async function update(state,event,input){return state}'))
})
test('QuickJS has no network, DOM, worker, storage, process or tool capabilities',()=>{
 const result=exec(`function update(state,event,input){return {types:[typeof fetch,typeof XMLHttpRequest,typeof WebSocket,typeof Worker,typeof window,typeof document,typeof localStorage,typeof process,typeof require,typeof navigator,typeof postMessage,typeof setTimeout,typeof invoke]}}`)
 assert.ok(result.types.every(x=>x==='undefined'))
 assert.throws(()=>exec('function update(state,event,input){return Function("return fetch")()}',{}),/fetch/)
 assert.throws(()=>exec('function update(state,event,input){return fetch("https://example.org")}',{}),/fetch/)
})

test('update parameters follow JavaScript positional semantics without spelling constraints',()=>{
 assert.deepEqual(exec('function update(s,e){if(e.type==="add")s.n++;return s}',{n:1},{type:'add'}),{n:2})
 assert.deepEqual(exec('function update(s){return {...s,n:s.n+1}}',{n:1}),{n:2})
 assert.deepEqual(exec('function update(s,{type},i={}){return {...s,type,n:i.n}}',{n:1},{type:'add'},{n:4}),{n:4,type:'add'})
 assert.equal(logicTickMs('function update(s,e){if(e.type==="tick")s.n++;return s}'),500)
 assert.equal(logicTickMs('function update(s,{type:eventType}){if(eventType==="tick")s.n++;return s}'),500)
 assert.equal(logicTickMs('function update(s,e){return s}'),undefined)
 assert.throws(()=>validateLogicSource('function update(a,b,c,d){return a}'))
})
test('multistep order commits updated calculations and immutable receipts',()=>{
 let s={stage:0,quantity:2,total:0,receipt:null}
 s=exec(ORDER_SOURCE,s,{type:'quantity',value:4},{price:15});s=exec(ORDER_SOURCE,s,{type:'next'},{price:15});assert.equal(s.total,60)
 s=exec(ORDER_SOURCE,s,{type:'next'},{price:15});assert.deepEqual(s.receipt,{quantity:4,total:60})
 s=exec(ORDER_SOURCE,s,{type:'quantity',value:9},{price:15});assert.equal(s.receipt.quantity,4)
})
test('simulator snapshots stay fixed while live values evolve',()=>{
 let s={temperature:20,power:10,steps:0,phase:'准备',series:[],saved:null}
 s=exec(HEAT_SOURCE,s,{type:'tick'});s=exec(HEAT_SOURCE,s,{type:'save'});s=exec(HEAT_SOURCE,s,{type:'tick'})
 assert.equal(s.temperature,30);assert.equal(s.saved.temperature,25);assert.equal(s.steps,2)
 const original=structuredClone(s);assert.throws(()=>exec(HEAT_SOURCE,s,{type:'fault'}));assert.deepEqual(s,original)
})
test('invalid results, infinite loops and memory exhaustion cannot commit',()=>{
 for(const body of ['return undefined','return Promise.resolve(state)','return {n:NaN}','return {f:()=>1}','return {n:1n}','state.self=state;return state','return JSON.parse(\'{"__proto__":{}}\')','while(true){}','state.x="x".repeat(100000000);return state'])assert.throws(()=>exec(`function update(state,event,input){${body}}`),body)
 assert.throws(()=>logicJson({x:'x'.repeat(70000)}));assert.throws(()=>logicJson({x:Infinity}))
 assert.deepEqual(exec('function update(state,event,input){return {ok:true}}'),{ok:true})
})
test('fresh JS context per event prevents hidden global state from escaping snapshots',()=>{
 const code='function update(state,event,input){globalThis.hidden=(globalThis.hidden||0)+1;return {n:hidden}}'
 assert.equal(exec(code).n,1);assert.equal(exec(code).n,1)
})
test('tick handlers get a default host clock without executing or guessing arbitrary code',()=>{
 assert.equal(logicTickMs(HEAT_SOURCE),500);assert.equal(logicTickMs(ORDER_SOURCE),undefined);assert.equal(logicTickMs(HEAT_SOURCE,750),750)
 assert.equal(logicTickMs('function update(state,event,input){switch(event.type){case "tick":state.n++}return state}'),500)
})
test('invalid candidate view cannot replace the last usable local state',async()=>{
 const spec=compileCard(LOGIC_FIXTURES.logicHeat,{final:true}).spec,node=spec.children.find(n=>n.type==='logic'),scope=makeScope(spec,createStore())
 const initial={temperature:20,power:10,steps:0,phase:'ok',saved:null,series:[]}
 const c=createLogicController({source:'unused',initial,run:async()=>({...initial,series:Array.from({length:41},(_,i)=>({id:String(i),label:String(i),value:i}))}),validate:local=>validateLogicView(node.children,{...scope,local})})
 c.dispatch({type:'next'});await wait();assert.equal(c.snapshot().state.series.length,0);assert.match(c.snapshot().error,/40/);c.dispose()
})
test('controller queues events, rolls back errors and restores snapshots',async()=>{
 let saved;const source='function update(state,event,input){state.n++;if(event.type==="fail")throw Error("bad");return state}',options={source,initial:{n:0},run:async p=>executeLogic(q,p),save:x=>{saved=x}}
 const c=createLogicController(options);c.dispatch({type:'add'});c.dispatch({type:'add'});await wait();assert.equal(c.snapshot().state.n,2)
 c.dispatch({type:'fail'});await wait();assert.equal(c.snapshot().state.n,2);assert.match(c.snapshot().error,/bad/)
 c.dispatch({type:'add'});await wait();assert.equal(c.snapshot().state.n,3)
 const restored=createLogicController({...options,saved});assert.equal(restored.snapshot().state.n,3)
 restored.reset();assert.equal(restored.snapshot().state.n,0);c.dispose();restored.dispose()
})
test('changed input, cancellation and unmount discard late responses',async()=>{
 for(const cancel of [c=>c.cancel(),c=>c.setInput({v:2}),c=>c.dispose()]){
  let resolve,saves=0;const c=createLogicController({source:'x',initial:{n:0},run:()=>new Promise(r=>{resolve=r}),save:()=>saves++})
  c.dispatch({type:'add'});cancel(c);resolve({n:999});await wait();assert.equal(c.snapshot().state.n,0);assert.equal(saves,0);c.dispose()
 }
})
test('reactive data arrival rebases uncommitted user actions without dropping them or replaying effects',async()=>{
 let release,first=true;const effects=[],calls=[];
 const c=createLogicController({source:'test',initial:{n:0,version:1},input:{version:1},reactive:true,
  run:async({state,event,input})=>{calls.push(event.type);if(event.type==='choose'&&first){first=false;return new Promise(r=>{release=r})}return {...state,n:state.n+(['choose','save'].includes(event.type)?1:0),version:input.version}},
  afterCommit:x=>effects.push(x.event.type)});
 c.setActive(true);await wait();c.dispatch({type:'choose'});c.dispatch({type:'save'});c.setInput({version:2});await wait();
 assert.deepEqual(c.snapshot().state,{n:2,version:2});assert.deepEqual(effects,['choose','save']);
 release({n:999,version:1});await wait();assert.equal(c.snapshot().state.n,2);assert.equal(calls.filter(x=>x==='choose').length,2);c.dispose();
})
test('an input change from a committed bridge never repeats that bridge',async()=>{
 let effects=0;const c=createLogicController({source:'test',initial:{n:0},input:{v:1},reactive:true,
  run:async({state,event})=>({n:state.n+(event.type==='press'?1:0)}),
  afterCommit:()=>{effects++;c.setInput({v:2})}});
 c.setActive(true);await wait();c.dispatch({type:'press'});await wait();assert.equal(effects,1);assert.equal(c.snapshot().state.n,1);c.dispose();
})
test('module view-state survives session persistence without storing/rerunning workers',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)}
 const spec=compileCard(LOGIC_FIXTURES.logicHeat,{final:true,cardId:'logic-persist'}).spec
 const a=createCardSession(spec,{storage,persistenceKey:'logic'});a.current().viewState.components={'/heat':{logic:{source:HEAT_SOURCE,initialKey:'{}',state:{temperature:35}}}};a.save();a.dispose()
 const b=createCardSession(spec,{storage,persistenceKey:'logic'});assert.equal(b.current().viewState.components['/heat'].logic.state.temperature,35);b.dispose()
})
test('page stack back/forward retains module state with no generation replay',async()=>{
 const root=compileCard(LOGIC_FIXTURES.logicHeat.replace('<card theme="precision">','<card theme="precision"><binding id="more" tool="glm.generate" input={{prompt:"下一页"}} initial={{}}/>'),{final:true,cardId:'root'}).spec
 const child=compileCard(LOGIC_FIXTURES.logicOrder,{final:true,cardId:'child'}).spec
 let calls=0;const s=createCardSession(root,{transport:async()=>{calls++;return {kind:'page',spec:child,resources:{}}}})
 s.setActivity({complete:true,visible:true});s.current().viewState.components={'/heat':{logic:{state:{temperature:40}}}}
 await s.invoke({binding:'more',target:'page'});assert.equal(s.current().id,'child')
 s.navigate(-1);assert.equal(s.current().viewState.components['/heat'].logic.state.temperature,40)
 s.navigate(1);assert.equal(s.current().id,'child');assert.equal(calls,1);s.dispose()
})

