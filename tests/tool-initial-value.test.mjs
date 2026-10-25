import {existsSync} from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {TOOLS,toolInitialValue,validateJson,toolReference} from '../shared/cardspec/tools.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
const context={expressionDialect:'js-v1'}
const source=(tool,initial='')=>`<card><binding id="rows" tool="${tool}" ${initial}/><text>{bindings.rows.status}</text></card>`
test('catalog list initial values are schema-valid empty envelopes, not fabricated facts',()=>{
 for(const [id,tool]of Object.entries(TOOLS)){
  const value=toolInitialValue(id)
  if(!tool.outputSchema){assert.equal(value,undefined);continue}
  assert.deepEqual(validateJson(value,tool.outputSchema),value,id)
  assert.deepEqual(value.items,[]);assert.equal(value.source,'');assert.equal(value.fetchedAt,'')
  assert.ok(Object.keys(value).every(k=>['items','source','fetchedAt','truncated'].includes(k)))
 }
 assert.equal(toolInitialValue('unknown.tool'),undefined)
})
test('js-v1 omitted initial stays idle and default factories allocate independent envelopes',()=>{
 for(const id of ['autocli.hackernews.top','opencli.ctrip.search','dataset.analyze']){
  const r=compileCard(source(id),{final:true,context});assert.equal(r.complete,true,JSON.stringify(r.diagnostics))
  const scope=makeScope(r.spec,createStore());assert.equal(scope.bindings.rows.status,'idle');assert.equal(scope.bindings.rows.updatedAt,null)
  assert.deepEqual(scope.bindings.rows.value.items,[])
  const first=toolInitialValue(id);first.items.push({bad:true});assert.deepEqual(toolInitialValue(id).items,[])
 }
})
test('legacy and explicit invalid initial remain strict; write policies do not relax',()=>{
 assert.equal(compileCard(source('opencli.ctrip.search'),{final:true}).complete,false)
 assert.equal(compileCard(source('opencli.ctrip.search','initial={{items:[]}}'),{final:true,context}).complete,false)
 const write=Object.values(TOOLS).find(t=>t.readOnly===false)
 assert.ok(write)
 const r=compileCard(source(write.id,'load="visible"'),{final:true,context})
 assert.ok(r.diagnostics.some(d=>d.message.includes('write tools require manual')))
})
test('omitted initial does not bypass tool input validation or failed-transaction effects',()=>{
 const r=compileCard('<card actionMode="snapshot"><binding id="rows" tool="opencli.ctrip.search" input={{query:"杭州"}}/><state id="n" type="number" initial={0}/><text>{state.n}</text><action id="go"><set target="n" value={1}/><invoke binding="rows" input={{query:""}}/></action></card>',{final:true,context})
 const store=createStore();makeScope(r.spec,store);assert.throws(()=>executeAction(r.spec,store,'go',{}));assert.equal(store.values.n,0)
})
test('JS disclosure has one binding convention and no hidden legacy array matching',()=>{
 const js=toolReference(true,['opencli.douban.movie-hot','glm.generate'],{expressionDialect:'js-v1'})
 assert.match(js,/可省略initial/);assert.doesNotMatch(js,/initial统一用|initial 必须完整|append保存|remove key=/)
 assert.match(js,/state.picks.filter/)
 const legacy=toolReference(true,['opencli.douban.movie-hot'])
 assert.match(legacy,/initial 必须完整/);assert.match(legacy,/append保存/)
})
test('immutable family R12 first response no longer fails for missing envelope boilerplate',{skip: ["artifacts/javascript-upgrade/flash-baselines-r12/family.json"].every(existsSync) ? false : "Private historical replay artifacts excluded from source export"}, ()=>{
 const r=JSON.parse(readFileSync('artifacts/javascript-upgrade/flash-baselines-r12/family.json','utf8'))
 const raw=r.trace.filter(e=>e.type==='diagnostics')[0].source
 const result=compileCard(raw,{final:true,context})
 assert.ok(!result.diagnostics.some(d=>d.message.includes('CLI binding requires initial')||d.message==='$: expected object'))
})
