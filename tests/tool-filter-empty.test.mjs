import test from 'node:test'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createStore,makeScope} from '../shared/cardspec/store.mjs'
import {evaluate} from '../shared/cardspec/expression.mjs'
import {filteredCollectionSources,collectionBindings} from '../shared/cardspec/tool-collection-state.mjs'
import {normalizeOpenCli} from '../server/tools/opencli.mjs'
import {isPartialToolResult,toolReference} from '../shared/cardspec/tools.mjs'

test('first-page results stay partial below requested limit; legacy cached results get the same scope',()=>{
 const value=normalizeOpenCli('opencli.ctrip.hotel-search',[{hotelId:'1',name:'酒店',price:null}],{limit:15})
 assert.equal(value.truncated,true);assert.equal(value.items[0].price,null)
 assert.equal(isPartialToolResult('opencli.ctrip.hotel-search',{truncated:false}),true)
 assert.equal(isPartialToolResult('opencli.wttr.current',{truncated:false}),false)
 assert.match(toolReference(true,['opencli.ctrip.hotel-search']),/city resolution does not apply/)
})

test('camelCase business IDs are opaque strings across lookup and detail tools, quantities stay numeric',()=>{
 const v=normalizeOpenCli('opencli.ctrip.hotel-suggest',[{id:477,cityId:477,name:'武汉',score:4.8}],{limit:5})
 assert.equal(v.items[0].id,'477');assert.equal(v.items[0].cityId,'477');assert.equal(v.items[0].score,4.8)
 const h=normalizeOpenCli('opencli.ctrip.hotel-search',[{hotelId:123,reviewCount:24,price:320}],{limit:15}).items[0]
 assert.equal(h.hotelId,'123');assert.equal(h.reviewCount,24);assert.equal(h.price,320)
})

test('empty filtered aliases expose recoverable source rows, not static or loading/error/empty lists',()=>{
 for(const tool of ['opencli.ctrip.hotel-search','opencli.apple-podcasts.search']){
  const c=compileCard(`<card><binding id="rows" tool="${tool}" initial={{items:[],source:"",fetchedAt:"",truncated:false}}/><state id="q" type="string" initial="未匹配"/><derive id="filtered" value={filter(bindings.rows.value.items,includes(string(item.name),state.q))}/><derive id="shown" value={derived.filtered}/><each items={derived.shown} itemKey={item.rowKey}><text>{item.name}</text></each></card>`,{final:true})
  assert.equal(c.complete,true,JSON.stringify(c.diagnostics))
  const ast=c.spec.children[0].props.items,bindings={rows:{status:'success',value:{items:[{rowKey:'1',name:'A'}]}}}
  const scope=makeScope(c.spec,createStore(),{bindings}),items=evaluate(ast,scope)
  assert.deepEqual(filteredCollectionSources(c.spec,ast,items,bindings),[{id:'rows',count:1}])
  assert.deepEqual(filteredCollectionSources(c.spec,ast,bindings.rows.value.items,bindings),[])
  for(const status of ['idle','loading','error','cancelled'])assert.deepEqual(filteredCollectionSources(c.spec,ast,[],{rows:{...bindings.rows,status}}),[])
  assert.deepEqual(filteredCollectionSources(c.spec,ast,[],{rows:{status:'success',value:{items:[]}}}),[])
  assert.deepEqual(collectionBindings(c.spec,{type:'ref',name:'local'}),[])
  assert.deepEqual(collectionBindings({derived:{loop:{type:'get',object:{type:'ref',name:'derived'},key:{type:'literal',value:'loop'}}}},{type:'get',object:{type:'ref',name:'derived'},key:{type:'literal',value:'loop'}}),[])
 }
})
