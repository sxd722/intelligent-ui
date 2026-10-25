import test from 'node:test'
import assert from 'node:assert/strict'
import {getQuickJS} from 'quickjs-emscripten'
import {executeLogic} from '../shared/cardspec/logic-engine.mjs'
import {createLogicController} from '../src/cardspec/logic-controller.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {countdownState} from '../shared/cardspec/time.mjs'
import {validateWidget} from '../shared/cardspec/widgets.mjs'
import {CAPABILITY_FIXTURES} from '../shared/cardspec/capability-fixtures.mjs'
import {createCardSession} from '../src/cardspec/tool-session.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
const wait=async()=>{await new Promise(r=>setTimeout(r,20))}
const q=await getQuickJS()
test('reactive computation stays dormant during preview; recomputes input and preserves selection',async()=>{
 let calls=0,bridges=0,saved
 const c=createLogicController({source:'function update(state,event,input){state.total=input.n*2;if(event.type==="pick")state.pick=event.value;return state}',initial:{total:0,pick:'a'},input:{n:2},reactive:true,run:async p=>{calls++;return executeLogic(q,p)},save:s=>saved=s,afterCommit:()=>bridges++})
 c.setInput({n:3});await wait();assert.equal(calls,0)
 c.setActive(true);await wait();assert.equal(c.snapshot().state.total,6);assert.equal(bridges,0)
 c.dispatch({type:'pick',value:'b'});await wait();assert.equal(bridges,1)
 c.setInput({n:5});await wait();assert.deepEqual(c.snapshot().state,{total:10,pick:'b'});assert.equal(bridges,1)
 c.setActive(false);c.setInput({n:8});await wait();assert.equal(c.snapshot().state.total,10)
 c.setActive(true);await wait();assert.equal(c.snapshot().state.total,16);assert.equal(saved.state.pick,'b');c.dispose()
})
test('failed, cancelled and obsolete calculations cannot call the host',async()=>{
 let bridge=0,resolve
 const c=createLogicController({source:'x',initial:{n:0},run:()=>new Promise(r=>resolve=r),validate:s=>{if(s.n<0)throw Error('bad view')},afterCommit:()=>bridge++})
 c.dispatch({type:'open'});resolve({n:-1});await wait();assert.equal(bridge,0);assert.equal(c.snapshot().state.n,0)
 c.dispatch({type:'open'});c.setInput({n:2});resolve({n:9});await wait();assert.equal(bridge,0);assert.equal(c.snapshot().state.n,0);c.dispose()
})
test('logic bridge is an explicit literal map; automatic event names cannot trigger actions',()=>{
 const card=actions=>`<card><state id="n" type="number" initial={0}/><action id="host"><increment target="n"/></action><logic id="calc" initial={{n:0}} actions={${actions}} source="function update(state,event,input){return state}"><button onPress="open">Open</button></logic></card>`
 assert.equal(compileCard(card('{open:"host"}'),{final:true}).complete,true)
 for(const map of ['{input:"host"}','{init:"host"}','{tick:"host"}','{open:"missing"}','state.n'])assert.equal(compileCard(card(map),{final:true}).complete,false)
})
test('heatmap dimensions, nulls, signed values and edge weights are validated',()=>{
 const p={label:'m',rows:[{id:'r',label:'R'}],columns:[{id:'a',label:'A'},{id:'b',label:'B'}],values:[[-2,null]]}
 validateWidget('heatmap',p)
 assert.throws(()=>validateWidget('heatmap',{...p,values:[[1]]}))
 assert.throws(()=>validateWidget('heatmap',{...p,values:[[NaN,1]]}))
 assert.throws(()=>validateWidget('heatmap',{...p,columns:[p.columns[0],p.columns[0]]}))
 const graph={nodes:[{id:'a',label:'A',value:-1},{id:'b',label:'B',value:2}],edges:[{from:'a',to:'b',value:-.8}]}
 validateWidget('flowchart',graph)
 assert.throws(()=>validateWidget('flowchart',{...graph,edges:[{from:'a',to:'b',value:Infinity}]}))
})
test('countdown uses absolute instants and resynchronizes across midnight and suspension',()=>{
 const target='2026-10-24T00:00:00+08:00',end=Date.parse(target)
 assert.equal(countdownState(target,end-1000).seconds,1)
 assert.equal(countdownState(target,end+3600000).status,'expired')
 assert.equal(countdownState('2026-10-24T00:00',end).status,'invalid')
 assert.equal(countdownState('',end).status,'unknown')
 assert.equal(countdownState('2026-10-23T16:00:00Z',end-1000).seconds,1)
 assert.equal(countdownState('2026-02-30T00:00:00Z',end).status,'invalid')
 assert.equal(countdownState('2028-02-29T00:00:00Z',end).status,'pending')
})

test('all generic capability fixtures compile without running JavaScript or tools',()=>{
 for(const [id,source]of Object.entries(CAPABILITY_FIXTURES)){
  const result=compileCard(source,{final:true});assert.equal(result.complete,true,id+JSON.stringify(result.diagnostics))
 }
})

test('successful explicit logic events reach the existing tool transaction; automatic recompute never does',async()=>{
 const source=`<card><binding id="feed" tool="autocli.hackernews.top" input={{limit:2}} initial={{items:[],source:"Hacker News",fetchedAt:""}} load="manual"/><state id="count" type="number" initial={0}/><action id="load"><set target="count" value={event.result.n}/><invoke binding="feed"/></action><logic id="local" reactive={true} initial={{n:0}} input={{n:2}} actions={{load:"load"}} source="function update(state,event,input){state.n=input.n;return state}"><button onPress="load">Load</button></logic></card>`
 const compiled=compileCard(source,{final:true});assert.equal(compiled.complete,true,JSON.stringify(compiled.diagnostics))
 let calls=0;const s=createCardSession(compiled.spec,{transport:async()=>{calls++;return {kind:'json',value:{items:[],source:'Hacker News',fetchedAt:''}}}});s.setActivity({complete:true,visible:true,enabled:true})
 const c=createLogicController({source:'function update(state,event,input){state.n=input.n;return state}',initial:{n:0},input:{n:2},reactive:true,run:async p=>executeLogic(q,p),afterCommit:({event,result,input})=>s.fire('load',{event:{...event,result,input},args:{}})})
 c.setActive(true);await wait();assert.equal(calls,0)
 c.dispatch({type:'load'});await wait();assert.equal(calls,1);assert.equal(s.current().store.values.count,2)
 c.setInput({n:4});await wait();assert.equal(calls,1);assert.equal(s.current().store.values.count,2)
 // A late host validation failure must not emit a tool effect or partial host state.
 compiled.spec.actions.load.push({type:'set',target:'count',value:{type:'literal',value:'bad'}})
 c.dispatch({type:'load'});await wait();assert.equal(calls,1);assert.equal(s.current().store.values.count,2)
 c.dispose();s.dispose()
})

test('reactive restore and reset preserve view state and use current input without host effects',async()=>{
 let saved,bridges=0;const options={source:'function update(state,event,input){state.n=input.n;if(event.type==="pick")state.pick=event.value;return state}',initial:{n:0,pick:'a'},input:{n:5},reactive:true,run:async p=>executeLogic(q,p),save:s=>saved=s,afterCommit:()=>bridges++}
 const c=createLogicController(options);c.setActive(true);await wait();c.dispatch({type:'pick',value:'b'});await wait();c.dispose()
 const restored=createLogicController({...options,saved});assert.equal(restored.snapshot().state.pick,'b');restored.setActive(true);await wait();assert.equal(bridges,1)
 restored.reset();await wait();assert.deepEqual(restored.snapshot().state,{n:5,pick:'a'});assert.equal(bridges,1);restored.dispose()
})

test('missing record identity cannot silently write a null key or commit earlier steps',()=>{
 const source='<card><state id="checked" type="record" initial={{}}/><state id="n" type="number" initial={0}/><checkbox label="记录" checked={false} onChange="check" args={{id:"a"}}/><action id="check"><increment target="n"/><set target="checked" key={event.value.id} value={event.checked}/></action></card>'
 const result=compileCard(source,{final:true});assert.equal(result.complete,false);assert.match(JSON.stringify(result.diagnostics),/key must resolve/)
 const store=createStore();makeScope(result.spec,store);assert.throws(()=>executeAction(result.spec,store,'check',{event:{checked:true},args:{id:'a'}}),/key must resolve/);assert.equal(store.values.n,0);assert.deepEqual(store.values.checked,{})
 const fixed=compileCard(source.replace('event.value.id','args.id'),{final:true});assert.equal(fixed.complete,true)
})
