import test from 'node:test'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {REGISTRY} from '../shared/cardspec/registry.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
test('unknown static region roles retain content and interactions without a model repair',()=>{
 for(const dialect of ['legacy','js-v1'])for(const role of ['details','body','simulation']){
  const r=compileCard(`<card><state id="n" type="number" initial={0}/><region role="${role}" overflow="scroll"><text>Content stays visible</text><button onPress="add">Add</button></region><action id="add"><increment target="n"/></action></card>`,{final:true,context:{expressionDialect:dialect}})
  assert.equal(r.complete,true,JSON.stringify(r.diagnostics));assert.equal(r.diagnostics.filter(d=>d.code==='presentation_default').length,1)
  const region=r.spec.children[0];assert.equal(region.props.role.value,'content');assert.equal(region.props.overflow.value,'scroll');assert.equal(region.children.length,2)
  const store=createStore();makeScope(r.spec,store);executeAction(r.spec,store,'add');assert.equal(store.values.n,1)
 }
})
test('valid roles are unchanged; behavior, expressions and wrong types are never defaulted',()=>{
 for(const role of ['summary','content','actions']){
  const r=compileCard(`<card><region role="${role}"/></card>`,{final:true});assert.equal(r.complete,true);assert.equal(r.spec.children[0].props.role.value,role);assert.equal(r.diagnostics.length,0)
 }
 for(const source of ['<card><region role={42}/></card>','<card><region overflow="hidden"/></card>','<card><button onPress="missing">Go</button></card>','<card><region role={fetch("x")}/></card>']){
  const r=compileCard(source,{final:true,context:{expressionDialect:'js-v1'}});assert.equal(r.complete,false,source);assert.ok(r.diagnostics.some(d=>d.severity==='error'))
 }
})
test('all controls disclose the same finite JSON argument contract',()=>{
 for(const [name,definition] of Object.entries(REGISTRY))if(definition.props.args)assert.equal(definition.props.args,'json',name)
})
