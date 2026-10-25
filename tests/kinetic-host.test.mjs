import test from 'node:test'
import assert from 'node:assert/strict'
import {interpolateGraphics} from '../shared/cardspec/graphic-motion.mjs'
import {KINETIC_FIXTURES} from '../shared/cardspec/kinetic-fixtures.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
import {paintPearl,paintParticles} from '../src/cardspec/host-effects.js'
test('graphic transitions preserve IDs after reordering and never interpolate missing values',()=>{
 const a=[{id:'a',x:0,value:20},{id:'b',x:10,value:null}],b=[{id:'b',x:20,value:8},{id:'a',x:8,value:40},{id:'new',x:55,value:3}]
 assert.deepEqual(interpolateGraphics(a,b,['x','value'],.5),[{id:'b',x:15,value:8},{id:'a',x:4,value:30},{id:'new',x:55,value:3}])
 const mid=interpolateGraphics(a,b,['x'],.5)
 assert.equal(interpolateGraphics(mid,[{id:'a',x:100}],['x'],.5)[0].x,52)
 assert.deepEqual(interpolateGraphics(a,b,['x','value'],1),b)
})
test('native kinetic fixtures compile and state transactions work without sandbox or tools',()=>{
 for(const [id,source]of Object.entries(KINETIC_FIXTURES)){const result=compileCard(source,{final:true});assert.equal(result.complete,true,id+JSON.stringify(result.diagnostics));assert.equal(source.includes('<sandbox'),false)}
 const spec=compileCard(KINETIC_FIXTURES.kineticPearl,{final:true}).spec,store=createStore()
 executeAction(spec,store,'adjust',{event:{value:73}});executeAction(spec,store,'save',{})
 assert.equal(makeScope(spec,store).state.saved,73)
})
test('host painters have bounded geometry, clear alpha and do not need model code',()=>{
 let fills=0,clears=0
 const gradient=()=>({addColorStop(){}})
 const ctx={clearRect(){clears++},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){fills++},arc(){},stroke(){},save(){},restore(){},translate(){},scale(){},fillRect(){},createRadialGradient:gradient,createLinearGradient:gradient}
 paintPearl(ctx,320,300,123);assert.ok(fills<5000);assert.equal(clears,1)
 fills=0;paintParticles(ctx,320,300,123);assert.equal(fills,22)
})
