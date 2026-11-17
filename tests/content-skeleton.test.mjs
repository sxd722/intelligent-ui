import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeContentSkeleton,contentRelationDiagnostics,relationPartRoles} from '../shared/cardspec/content-skeleton.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {cardGenerationPrompt} from '../server/cardspec/prompt.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
import {taskOutputSnapshot} from '../shared/cardspec/task-behavior.mjs'

const skeleton={question:'为什么结果不同？',anchors:['事件A','事件B'],relation:'compare',outcome:'选择事件，同屏看两种说法与依据'}
test('host numbers actual grouped steps, not their preamble; apply does not mistake the second caption for a control',()=>{
 assert.deepEqual(relationPartRoles('sequence',['text','box','box','caption']).map(p=>p.step),[null,1,2,null])
 assert.deepEqual(relationPartRoles('sequence',['text','text']).map(p=>p.step),[1,2])
 assert.deepEqual(relationPartRoles('apply',['text','caption','input']).map(p=>p.control),[false,false,true])
})
test('bounded skeleton is optional, normalized and never promotes arbitrary keys',()=>{
 assert.deepEqual(normalizeContentSkeleton({...skeleton,source:'ignored'}),skeleton)
 for(const bad of [{...skeleton,relation:'fake'},{...skeleton,anchors:[]},{...skeleton,question:'x'.repeat(101)}])assert.equal(normalizeContentSkeleton(bad),null)
})
test('existing plan call carries compact content intent; control omits new schema and prompt',async()=>{
 const planned=createGenerationTools({goal:'比较原理与实践',allowPlanning:true,enabled:false})
 await planned.execute('plan_cards',{cards:[{title:'理解',goal:'解释差异',contentSkeleton:skeleton}],followups:[]})
 assert.deepEqual(planned.plan().cards[0].contentSkeleton,skeleton)
 const control=createGenerationTools({contentRelations:'off',allowPlanning:true})
 assert.equal(control.tools().find(t=>t.function.name==='plan_cards').function.parameters.properties.cards.items.properties.contentSkeleton,undefined)
 assert.ok(!cardGenerationPrompt(null,{compact:true,contentRelations:'off'}).includes('magazine|compare'))
 assert.ok(cardGenerationPrompt(null,{compact:true}).includes('magazine|compare'))
})
test('native relationship preserves each scope and actions; never executes or invents content',()=>{
 const result=compileCard(`<card><state id="picked" type="number" initial={0}/><data id="rows" value={[{title:"A",left:"甲",right:"乙"},{title:"B",left:"丙",right:"丁"}]}/><derive id="cur" value={data.rows[state.picked]}/><region presentation="compare"><region><strong>来源一</strong><text>{derived.cur.left}</text></region><region><strong>来源二</strong><text>{derived.cur.right}</text></region><text>{derived.cur.title}</text></region><button onPress="pick">换一个</button><action id="pick"><set target="picked" value={1}/></action></card>`,{final:true})
 assert.equal(result.diagnostics.filter(d=>d.severity==='error').length,0,JSON.stringify(result.diagnostics))
 const store=createStore();const before=JSON.stringify(taskOutputSnapshot(result.spec,makeScope(result.spec,store)))
 executeAction(result.spec,store,'pick');const after=JSON.stringify(taskOutputSnapshot(result.spec,makeScope(result.spec,store)))
 assert.notEqual(before,after);assert.ok(after.includes('丙'));assert.ok(after.includes('丁'))
})
test('incomplete and paginated relation warns without rejecting a usable card',()=>{
 const result=compileCard('<card><region presentation="compare" overflow="paginate"><text>只有一边</text></region></card>',{final:true})
 assert.equal(result.diagnostics.filter(d=>d.severity==='error').length,0)
 assert.equal(contentRelationDiagnostics(result.spec.children).length,2)
})
