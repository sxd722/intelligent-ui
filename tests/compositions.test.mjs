import test from 'node:test'
import assert from 'node:assert/strict'
import {projectComposition} from '../shared/cardspec/compositions.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'

test('all style families share geometry and an unflattened wrapped heading',()=>{
 const heading={type:'row',children:[{type:'title'},{type:'caption'}]},body={type:'text'}
 for(const style of ['friendly','atmospheric','academy','folio'])assert.deepEqual(projectComposition([heading,body],style).header,[heading])
 assert.equal(projectComposition([{type:'if',children:[{type:'title'}]},body],'friendly'),null)
})
test('semantic workspace preserves chooser, detail and persistent outcome scopes',()=>{
 const c=compileCard('<card design="atmospheric"><title>Explore</title><chips/><region role="choices"><text>choices</text></region><region role="focus"><text>detail</text></region><region role="result"><text>selection</text></region></card>',{final:true})
 assert.ok(c.complete,JSON.stringify(c.diagnostics))
 const p=projectComposition(c.spec.children,'atmospheric');assert.equal(p.id,'workspace');assert.equal(p.body.length,3);assert.equal(p.footer[0].props.role.value,'result')
})

test('reading paragraphs before an action remain pageable body content',()=>{
 const nodes=[{type:'title',id:'title'},{type:'text',id:'chapter1'},{type:'text',id:'chapter2'},{type:'button',id:'save'},{type:'caption',id:'feedback'}]
 const p=projectComposition(nodes,'parchment')
 assert.deepEqual(p.body.map(n=>n.id),['chapter1','chapter2'])
 assert.deepEqual(p.footer.map(n=>n.id),['save','feedback'])
})
test('whole composition partitions once without flattening scopes or moving non-actions',()=>{
 const nodes=[{id:'t',type:'title'},{id:'logic',type:'logic',children:[{type:'slider'}]},{id:'r',type:'row',children:[{type:'text'}]},{id:'c',type:'slider'},{id:'b',type:'button'}]
 for(const family of ['pearl','atlas','rebel','default']){const p=projectComposition(nodes,family);assert.deepEqual([...p.header,...p.body,...p.controls,...p.footer],nodes);assert.equal(p.body[0],nodes[1]);assert.equal(p.body[1],nodes[2])}
 assert.equal(projectComposition([{type:'region',children:nodes}],'pearl'),null)
})
test('compact visual contracts accept bare and reject misleading proportions',()=>{
 const card=data=>`<card design="pearl" composition="focus"><title>配比</title><chart surface="bare" kind="proportion" label="两部分" data={${JSON.stringify(data)}}/></card>`
 assert.equal(compileCard(card([{id:'a',label:'A',value:20},{id:'b',label:'B',value:80}]),{final:true}).complete,true)
 assert.equal(compileCard(card([{id:'a',label:'A',value:-1}]),{final:true}).complete,false)
 assert.equal(compileCard('<card composition="unknown"><text>x</text></card>',{final:true}).complete,false)
})
test('a lone selector stays adjacent to its result instead of moving to footer',()=>{
 const p=projectComposition([{type:'title',id:'title'},{type:'segmented',id:'view'},{type:'if',id:'body',children:[{type:'region'}]}],'rebel')
 assert.equal(p.controls.length,0);assert.deepEqual(p.body.map(n=>n.id),['view','body'])
})

test('long pages retain controls and local actions in document order',()=>{
 const nodes=[{type:'title',id:'title'},{type:'slider',id:'budget'},{type:'text',id:'estimate'},{type:'button',id:'pick'},{type:'text',id:'detail'},{type:'slider',id:'duration'},{type:'chart',id:'graph'}]
 for(const family of ['default','pearl','academy']){
  const p=projectComposition(nodes,family,'auto',{size:'full'})
  assert.deepEqual(p.body,nodes.slice(1));assert.deepEqual(p.controls,[]);assert.deepEqual(p.footer,[])
 }
})
test('conditional action groups retain their scope in the fixed action area',()=>{
 const group={id:'actions',type:'row',children:[{type:'if',props:{test:{type:'literal',value:true}},children:[{type:'button'}]}]}
 const p=projectComposition([{id:'heading',type:'title'},{id:'visual',type:'collection'},group],'academy')
 assert.equal(p.footer[0],group);assert.equal(p.footer[0].children[0].type,'if')
})
