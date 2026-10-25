import test from 'node:test'
import assert from 'node:assert/strict'
import {projectComposition} from '../shared/cardspec/compositions.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'

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
test('a lone view switch stays available without taking the first content page',()=>{
 const p=projectComposition([{type:'title',id:'title'},{type:'segmented',id:'view'},{type:'if',id:'body',children:[{type:'region'}]}],'rebel')
 assert.equal(p.controls[0].id,'view');assert.equal(p.body[0].id,'body')
})
test('conditional action groups retain their scope in the fixed action area',()=>{
 const group={id:'actions',type:'row',children:[{type:'if',props:{test:{type:'literal',value:true}},children:[{type:'button'}]}]}
 const p=projectComposition([{id:'heading',type:'title'},{id:'visual',type:'collection'},group],'academy')
 assert.equal(p.footer[0],group);assert.equal(p.footer[0].children[0].type,'if')
})
