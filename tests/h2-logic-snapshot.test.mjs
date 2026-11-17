import test from 'node:test'
import assert from 'node:assert/strict'
import {getQuickJS} from 'quickjs-emscripten'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createLogicSnapshotBus,logicSnapshotsEnabled} from '../shared/cardspec/logic-snapshot.mjs'
import {createLogicController} from '../src/cardspec/logic-controller.mjs'
import {executeLogic} from '../shared/cardspec/logic-engine.mjs'
import {logicJson} from '../shared/cardspec/logic-contract.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'

const source='function update(s,e,i){if(e.type==="init"||e.type==="input")s.factor=i.factor;if(e.type==="tick")s.n+=s.factor;if(e.type==="add")s.n++;return s}'
const initial={n:0,factor:1},input={factor:2},experiment={logicSnapshots:'readonly-v1'}
const wait=()=>new Promise(r=>setTimeout(r,12))
const fixture=()=>`<card><logic id="engine" label="独立计数" initial={{n:0,factor:1}} input={{factor:2}} reactive={true} tickMs={500} source={${JSON.stringify(source)}}><text>{local.n}</text><button onPress="add">增加</button></logic><sandbox id="graphic" brief="数值位置" height={160} logicSnapshot="engine" source={${JSON.stringify('export default function App({data}){return <svg viewBox="0 0 200 80"><circle cx={20+data.logicSnapshot.state.n*5} cy={40} r={10}/><text x={10} y={20}>{data.logicSnapshot.state.n}</text></svg>}')}}/></card>`

test('H2 snapshot is opt-in; ordinary registry and baseline compiler cannot use it',async()=>{
 assert.equal(logicSnapshotsEnabled({}),false)
 const baseline=compileCard(fixture(),{final:true,context:{renderMode:'hybrid'}})
 assert.equal(baseline.complete,false)
 assert.ok(baseline.diagnostics.some(d=>d.message.includes('logicSnapshot is not supported')))
 const enabled=compileCard(fixture(),{final:true,context:{renderMode:'hybrid',experiment}})
 assert.equal(enabled.complete,true,JSON.stringify(enabled.diagnostics))
 await validateRichContent(enabled)
 assert.equal(enabled.complete,true,JSON.stringify(enabled.diagnostics))
 assert.ok(enabled.spec.sandboxModules.graphic)
 for(const replacement of ['logicSnapshot="missing"','logicSnapshot={"engine"+""}']){
  const invalid=compileCard(fixture().replace('logicSnapshot="engine"',replacement),{final:true,context:{renderMode:'hybrid',experiment}})
  assert.equal(invalid.complete,false)
  assert.ok(invalid.diagnostics.some(d=>d.code==='logic_snapshot'))
 }
 const nested=fixture().replace('</logic><sandbox','<sandbox').replace('/></card>','/></logic></card>')
 assert.equal(compileCard(nested,{final:true,context:{renderMode:'hybrid',experiment}}).complete,false)
})

test('snapshot bus freezes copied JSON, validates identity, and rejects retired versions',()=>{
 const bus=createLogicSnapshotBus(),a=bus.register('engine',{source,initial}),value={source,initialKey:logicJson(initial),state:{n:2,factor:2},ready:true,error:''}
 let updates=0;const unsubscribe=bus.subscribe('engine',()=>updates++)
 assert.equal(a.publish(value),true);const first=bus.read('engine')
 value.state.n=999;assert.equal(first.state.n,2)
 assert.throws(()=>{first.state.n=3},TypeError)
 assert.equal(a.publish({...value,state:{n:2,factor:2}}),false)
 assert.equal(a.publish({...value,source:source+' '}),false)
 assert.throws(()=>a.publish({...value,state:{bad:()=>1}}),/JSON/)
 assert.equal(updates,1)
 const b=bus.register('engine',{source:source+' ',initial})
 assert.equal(bus.read('engine'),null)
 assert.equal(a.publish(value),false);a.close();assert.equal(bus.read('engine'),null)
 assert.equal(b.publish({...value,source:source+' ',state:{n:4,factor:2}}),true)
 const next=bus.read('engine');assert.notEqual(next.sourceVersion,first.sourceVersion);assert.ok(next.epoch>first.epoch)
 assert.equal(next.revision,1);assert.equal(next.initialVersion,first.initialVersion)
 b.close();assert.equal(bus.read('engine'),null);unsubscribe()
})

test('existing init/input/tick lifecycle publishes readonly state without root actions or tools; restore preserves state',async()=>{
 const q=await getQuickJS(),bus=createLogicSnapshotBus(),lease=bus.register('engine',{source,initial})
 let saved,effects=0
 const options={source,initial,input,reactive:true,run:async payload=>executeLogic(q,payload),save:value=>{saved=value},afterCommit:()=>effects++,notify:value=>lease.publish(value)}
 const controller=createLogicController(options)
 lease.publish(controller.snapshot());assert.equal(bus.read('engine').ready,false)
 controller.setActive(true);await wait();assert.equal(bus.read('engine').ready,true);assert.equal(bus.read('engine').state.factor,2);assert.equal(effects,0)
 controller.dispatch({type:'tick'});await wait();assert.equal(bus.read('engine').state.n,2);assert.equal(effects,0)
 const revision=bus.read('engine').revision
 controller.setInput({factor:3});await wait();assert.equal(bus.read('engine').state.factor,3);assert.equal(effects,0)
 controller.dispatch({type:'tick'});await wait();assert.equal(bus.read('engine').state.n,5);assert.ok(bus.read('engine').revision>revision);assert.equal(effects,0)
 controller.setActive(false);const paused=bus.read('engine');await wait();assert.equal(bus.read('engine'),paused);assert.equal(effects,0)
 controller.dispose();lease.close()
 const restoredLease=bus.register('engine',{source,initial}),restored=createLogicController({...options,saved,notify:v=>restoredLease.publish(v)})
 restored.setActive(true);await wait();assert.equal(bus.read('engine').state.n,5);assert.equal(effects,0)
 restored.dispatch({type:'add'});await wait();assert.equal(bus.read('engine').state.n,6);assert.equal(effects,1)
 restored.dispose();restoredLease.close()
})

test('canceled or late prior-instance work cannot publish a new snapshot',async()=>{
 const bus=createLogicSnapshotBus(),lease=bus.register('engine',{source,initial});let resolve,effects=0
 const controller=createLogicController({source,initial,input,reactive:true,run:()=>new Promise(r=>{resolve=r}),notify:s=>lease.publish(s),afterCommit:()=>effects++})
 controller.setActive(true);controller.setActive(false);const paused=bus.read('engine')
 resolve({n:500,factor:2});await wait()
 assert.equal(bus.read('engine'),paused);assert.equal(bus.read('engine').state.n,0);assert.equal(effects,0)
 controller.dispose();lease.close()
})
