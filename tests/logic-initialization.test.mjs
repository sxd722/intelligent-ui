import test from 'node:test'
import assert from 'node:assert/strict'
import {getQuickJS} from 'quickjs-emscripten'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import {executeLogic} from '../shared/cardspec/logic-engine.mjs'
import {createLogicController} from '../src/cardspec/logic-controller.mjs'
import {validateLogicView} from '../shared/cardspec/logic-view.mjs'
import {evaluate} from '../shared/cardspec/expression.mjs'
import {createStore,makeScope} from '../shared/cardspec/store.mjs'
const source='function update(s,e){if(e.type==="add")s.n++;if(e.type==="bad")throw Error("failed");s.rows=[{id:"a",label:"A"}];s.columns=[{id:"v",label:"value"}];s.matrix=[[s.n*2]];return s}'
const document=(fn=source,reactive=true)=>`<card><logic id="demo" initial={{n:2}} reactive={${reactive}} source={${JSON.stringify(fn)}}><heatmap label="Computed" rows={local.rows} columns={local.columns} values={local.matrix}/><button onPress="add">Add</button></logic><text>Outside module</text></card>`
const compile=(text=document(),dialect='js-v1')=>compileCard(text,{final:true,context:{expressionDialect:dialect}})
const vm=await getQuickJS(),wait=()=>new Promise(r=>setTimeout(r,10))

test('reactive JS seed need not duplicate computed view fields; final validation still evaluates them',async()=>{
 const result=compile();assert.equal(result.complete,true,JSON.stringify(result.diagnostics))
 await validateRichContent(result);assert.equal(result.complete,true,JSON.stringify(result.diagnostics))
 assert.ok(result.logicProbes[0].probes>0)
})
test('bad initialized fields and runtime capability violations fail final generation',async()=>{
 for(const fn of ['function update(s){return s}','function update(s){fetch("https://example.com");return s}']){
  const result=compile(document(fn));assert.equal(result.complete,true)
  await validateRichContent(result);assert.equal(result.complete,false)
  assert.ok(result.diagnostics.some(d=>d.severity==='error'&&d.code==='rich_content'))
 }
})
test('nonreactive modules require an initially valid view; both reactive dialects initialize before view checks',async()=>{
 assert.equal(compile(document(source,false)).complete,false)
 const legacy=compile(document(),'legacy');assert.equal(legacy.complete,true)
 await validateRichContent(legacy);assert.equal(legacy.complete,true,JSON.stringify(legacy.diagnostics));assert.ok(legacy.logicProbes[0].probes>0)
 assert.equal(compile(document().replace('values={local.matrix}','madeUp={local.matrix}')).complete,false)
})
test('controller exposes only initialized/validated views, restores choices, and isolates later failure',async()=>{
 const spec=compile().spec,node=spec.children[0],scope=makeScope(spec,createStore());let saved,effects=0
 const options={source,initial:{n:2},reactive:true,run:async p=>executeLogic(vm,p),validate:state=>validateLogicView(node.children,{...scope,local:state}),save:s=>saved=s,afterCommit:()=>effects++}
 const controller=createLogicController(options)
 assert.equal(controller.snapshot().ready,false)
 controller.setActive(true);await wait()
 assert.equal(controller.snapshot().ready,true);assert.deepEqual(controller.snapshot().state.matrix,[[4]]);assert.equal(effects,0)
 controller.dispatch({type:'add'});await wait();assert.equal(controller.snapshot().state.n,3)
 controller.dispatch({type:'bad'});await wait();assert.equal(controller.snapshot().ready,true);assert.deepEqual(controller.snapshot().state.matrix,[[6]])
 assert.match(controller.snapshot().error,/failed/)
 const restored=createLogicController({...options,saved});assert.equal(restored.snapshot().ready,false)
 restored.setActive(true);await wait();assert.equal(restored.snapshot().state.n,3);assert.deepEqual(restored.snapshot().state.matrix,[[6]])
 restored.reset();assert.equal(restored.snapshot().ready,false);await wait();assert.deepEqual(restored.snapshot().state.matrix,[[4]])
 controller.dispose();restored.dispose()
})
test('initialization failure or late canceled completion never exposes an incomplete view or effects',async()=>{
 let release,effects=0
 const controller=createLogicController({source,initial:{n:2},reactive:true,run:()=>new Promise(r=>release=r),validate:()=>{throw Error('invalid matrix')},afterCommit:()=>effects++})
 controller.setActive(true);release({n:2});await wait()
 assert.equal(controller.snapshot().ready,false);assert.match(controller.snapshot().error,/invalid matrix/)
 controller.reset();controller.setActive(false);release({n:999});await wait()
 assert.equal(controller.snapshot().ready,false);assert.equal(controller.snapshot().state.n,2);assert.equal(effects,0)
 controller.dispose()
})
