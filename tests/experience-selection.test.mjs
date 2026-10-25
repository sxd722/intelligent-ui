import test from 'node:test'
import assert from 'node:assert/strict'
import {toggleSelection,compositionRows,selectRecords,geoPoints,experienceSelection,experienceSelectedRecords} from '../shared/cardspec/composition.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {registryReference} from '../shared/cardspec/registry.mjs'
import {cardGenerationPrompt} from '../server/cardspec/prompt.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
import {CARD_JS_LANGUAGE_CORE,CARD_LANGUAGE_CORE} from '../server/cardspec/language-core.mjs'

test('externally filtered items retain full selected snapshots for apply, limits and restoration',()=>{
 const all=[{rowKey:'a',name:'Park'},{rowKey:'b',name:'Museum'},{rowKey:'c',name:'Garden'}]
 const ids=['a','b'],chosen=experienceSelectedRecords(all,ids)
 const filtered=[all[0],all[2]],restored=JSON.parse(JSON.stringify(chosen))
 assert.deepEqual(experienceSelectedRecords(filtered,ids,restored),all.slice(0,2))
 assert.deepEqual(experienceSelectedRecords([],ids,restored),all.slice(0,2))
 assert.deepEqual(toggleSelection(ids,'c',true,2),ids,'hidden choices count toward limit')
 assert.deepEqual(experienceSelectedRecords(filtered,['a'],restored),[all[0]],'explicit deselection removes cached snapshot')
 assert.deepEqual(experienceSelectedRecords(filtered,[],restored),[],'external clear is authoritative')
 assert.deepEqual(experienceSelectedRecords([{rowKey:'b',name:'Different query'}],['b'],restored),[all[1]],'saved row must not be silently reinterpreted')
 assert.deepEqual(experienceSelectedRecords([],['unknown']),[],'unknown row is never fabricated')
})

test('JS authoring removes records by their explicit identity without legacy implicit id matching',()=>{
 const action=CARD_JS_LANGUAGE_CORE.match(/<action id="remove">.*?<\/action>/)[0]
 const result=compileCard(`<card><state id="chosen" type="array" initial={[{rowKey:"a",name:"A"},{rowKey:"b",name:"B"}]}/><text>{state.chosen.length}</text>${action}</card>`,{final:true,context:{expressionDialect:'js-v1'}})
 assert.equal(result.complete,true,JSON.stringify(result.diagnostics))
 const store=createStore();makeScope(result.spec,store)
 executeAction(result.spec,store,'remove',{args:{rowKey:'a'}})
 assert.deepEqual(store.values.chosen,[{rowKey:'b',name:'B'}])
 executeAction(result.spec,store,'remove',{args:{rowKey:'missing'}})
 assert.equal(store.values.chosen.length,1)
 assert.ok(!CARD_JS_LANGUAGE_CORE.includes('支持set/toggle/increment/append/update/remove'))
 assert.ok(CARD_LANGUAGE_CORE.includes('update/remove按数组对象id查找key'),'legacy contract is unchanged')
})

test('apply-only selection edits a restorable draft; controlled selection waits for its callback',()=>{
 const props={selectedIds:['a'],onApply:'save'},initial=experienceSelection(props,{selected:[]})
 assert.deepEqual(initial.ids,['a'])
 const draft={selected:toggleSelection(initial.ids,'b'),selectionSource:initial.source,query:'park'}
 assert.deepEqual(experienceSelection({...props,selectedIds:['a']},draft).ids,['a','b'],'unrelated render does not discard draft')
 assert.deepEqual(experienceSelection(props,JSON.parse(JSON.stringify(draft))).ids,['a','b'],'restored page keeps unconfirmed draft')
 assert.deepEqual(experienceSelection({...props,selectedIds:[]},draft).ids,[],'external clearing resets draft')
 assert.deepEqual(experienceSelection({...props,selectedIds:['c']},draft).ids,['c'],'external replacement resets draft')
 assert.deepEqual(experienceSelection({...props,onSelect:'change'},draft).ids,['a'],'controlled owner stays authoritative')
 assert.deepEqual(experienceSelection({onApply:'save'},draft).ids,['a','b'])
 assert.deepEqual(experienceSelection({selectedIds:[0],onApply:'save'},{selected:[]}).ids,['0'])
 // Loaded rows may arrive after the selection: keep identities until materialized.
 const waiting={selected:initial.ids,selectionSource:initial.source}
 assert.deepEqual(experienceSelection({...props,items:[]},waiting).ids,['a'])
 assert.deepEqual(selectRecords([{id:'a',title:'loaded'}],experienceSelection(props,waiting).ids),[{id:'a',title:'loaded'}])
})

test('bounded multi-select preserves existing choices across filter and permits removal at capacity',()=>{
 const rows=[{id:'a',name:'Alpha',type:'park'},{id:'b',name:'Beta',type:'museum'},{id:'c',name:'Gamma',type:'park'}]
 let ids=toggleSelection([],'a',true,2);ids=toggleSelection(ids,'b',true,2)
 assert.deepEqual(toggleSelection(ids,'c',true,2),['a','b'])
 assert.deepEqual(compositionRows(rows,{facets:{type:'park'}}).map(r=>r.id),['a','c'])
 assert.deepEqual(selectRecords(rows,ids),rows.slice(0,2))
 ids=toggleSelection(ids,'a',true,2);ids=toggleSelection(ids,'c',true,2);assert.deepEqual(ids,['b','c'])
 assert.deepEqual(toggleSelection(['a','b'],'c'),['a','b','c'])
 assert.deepEqual(toggleSelection(['a'],'b',false,1),['b'])
})
test('selection limit and compact disclosure use the shared component contract',()=>{
 for(const limit of [1,4,50])assert.equal(compileCard(`<card><experience preset="planner" maxSelected={${limit}}/></card>`,{final:true}).complete,true)
 for(const limit of [0,-1,1.5,51])assert.equal(compileCard(`<card><experience preset="planner" maxSelected={${limit}}/></card>`,{final:true}).complete,false)
 const prompt=registryReference({compact:true,names:['experience']})
 assert.match(prompt,/maxSelected/);assert.match(prompt,/每页3项/);assert.match(prompt,/完整event.items/)
})
test('raw tool coordinate aliases require no identity-losing projection; missing coordinates remain selectable',()=>{
 const rows=[{rowKey:'a',lat:30,lon:120},{rowKey:'b',lat:31,lng:121},{rowKey:'c',latitude:0,longitude:0},{rowKey:'d',name:'Unknown'},{rowKey:'e',lat:null,lon:120}]
 const points=geoPoints(rows)
 assert.deepEqual(points.map(p=>p.id),['a','b','c'])
 assert.equal(points[0].item,rows[0])
 assert.deepEqual(selectRecords(rows,['d','e']),rows.slice(3))
 const contract=registryReference({compact:true,names:['map','experience']})
 assert.match(contract,/lat\/lon/);assert.match(contract,/保留候选/)
})

test('disclosed selection example compiles and saves complete records independently of later selection',()=>{
 const prompt=cardGenerationPrompt(null,{adaptive:true,expressionDialect:'js-v1',goal:'候选筛选与多选'})
 const snippet=prompt.match(/【多选短例】[^\n]*?(<experience.*?<\/action>)/)?.[1]
 assert.ok(snippet)
 const source=`<card><data id="rows" value={[{id:"a",name:"Alpha"},{id:"b",name:"Beta"}]}/><state id="chosen" type="array" initial={[]}/>${snippet}</card>`
 const r=compileCard(source,{final:true,context:{expressionDialect:'js-v1'}});assert.equal(r.complete,true,JSON.stringify(r.diagnostics))
 const store=createStore();makeScope(r.spec,store)
 const selected=[{id:'b',name:'Beta',price:null}]
 executeAction(r.spec,store,'keep',{event:{items:selected,ids:['b']}})
 selected[0].name='Changed';assert.deepEqual(store.values.chosen,[{id:'b',name:'Beta',price:null}])
 assert.ok(!cardGenerationPrompt(null,{adaptive:true,goal:'一个计数器'}).includes('【多选短例】'))
})
