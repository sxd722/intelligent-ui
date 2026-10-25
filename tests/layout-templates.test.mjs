import test from 'node:test'
import assert from 'node:assert/strict'
import {projectTemplate,templateRole} from '../shared/cardspec/layout-templates.mjs'
import {TEMPLATE_FIXTURES} from '../shared/cardspec/template-fixtures.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'

test('projection is lossless and preserves scoped containers and original order',()=>{
 const nodes=[{id:'t',type:'title'},{id:'c',type:'caption'},{id:'scope',type:'logic',children:[{type:'title'},{type:'chart'}]},{id:'action',type:'button'}]
 for(const id of ['pearl','atlas','rebel']){
  const p=projectTemplate(nodes,id);assert.deepEqual([...p.header,...p.body],nodes);assert.equal(p.body[0],nodes[2]);assert.equal(p.id,id)
 }
 for(const nodes of [[{type:'region',children:[{type:'title'}]}],[{type:'title'}],[{type:'if',children:[{type:'title'}]},{type:'chart'}]]){
  const p=projectTemplate(nodes,'atlas');assert.equal(p.id,'default');assert.equal(p.body,nodes)
 }
 assert.equal(templateRole({type:'logic'}),'content');assert.equal(templateRole({type:'heatmap'}),'visual')
})
test('template fixtures are valid and selected values remain exact across update transactions',()=>{
 for(const [id,source] of Object.entries(TEMPLATE_FIXTURES)){const r=compileCard(source,{final:true});assert.equal(r.complete,true,id+JSON.stringify(r.diagnostics))}
 const spec=compileCard(TEMPLATE_FIXTURES.templateAtlas,{final:true}).spec,store=createStore()
 executeAction(spec,store,'pick',{event:{rowId:'雨',columnId:'d3',value:0.4}})
 assert.equal(makeScope(spec,store).derived.picked,0.4)
 executeAction(spec,store,'step',{});assert.equal(makeScope(spec,store).derived.picked,0.5)
 assert.equal(makeScope(spec,store).state.r,'雨');assert.equal(makeScope(spec,store).state.c,'d3')
 executeAction(spec,store,'step',{});assert.equal(makeScope(spec,store).derived.picked,0.4)
})
