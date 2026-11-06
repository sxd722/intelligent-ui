import test from 'node:test'
import assert from 'node:assert/strict'
import {reuseSlots,applyReuseChanges} from '../shared/cardspec/reuse.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {COMPACT_CARD_PROMPT} from '../server/cardspec/compact-prompt.mjs'
import {registryReference} from '../shared/cardspec/registry.mjs'

test('short component index and generation prompt both disclose GPT Image at the actual image node',()=>{
 assert.match(registryReference({compact:true,names:['image']}),/GPT Image/)
 assert.match(COMPACT_CARD_PROMPT,/<image query="gen:/)
 assert.match(COMPACT_CARD_PROMPT,/真实地点/)
})
test('reuse changes illustration description without changing component attributes or source code',()=>{
 const source='<card><image id="hero" query="gen: forest story" alt="illustration" mediaRole="hero"/><text>Forest</text></card>',slot=reuseSlots(source).find(s=>s.kind==='image')
 assert.ok(slot);const changed=applyReuseChanges(source,[{slot:slot.id,value:'gen: ocean story'}]).source
 assert.equal(compileCard(changed,{final:true}).complete,true);assert.match(changed,/id="hero"/);assert.match(changed,/mediaRole="hero"/)
 assert.throws(()=>applyReuseChanges(source,[{slot:slot.id,value:'https://untrusted.example/image.jpg'}]))
})
test('legacy expression cards have inspectable content slots without switching their evaluation dialect',()=>{
 const source='<card><data id="items" value={["a","b"]}/><text>{count(data.items)}</text></card>'
 assert.equal(reuseSlots(source).length,1)
 const changed=applyReuseChanges(source,[{slot:'s0',value:['c','d']}]).source
 assert.equal(compileCard(changed,{final:true,context:{expressionDialect:'legacy'}}).complete,true)
 assert.equal(compileCard(changed,{final:true,context:{expressionDialect:'js-v1'}}).complete,false)
})
