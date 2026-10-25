import {existsSync} from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
import {observableContent} from '../shared/cardspec/feedback-diagnostics.mjs'
const context={expressionDialect:'js-v1'}
test('JS structural conditions use JS truthiness, including action guards',()=>{
 for(const [value,truthy]of [['0',false],['""',false],['null',false],['undefined',false],['"ready"',true],['[]',true],['{}',true],['-1',true]]){
  const r=compileCard(`<card><state id="n" type="number" initial={0}/><if test={${value}}><text>Shown</text></if><text>{state.n}</text><action id="go"><set target="n" value={1} when={${value}}/></action></card>`,{final:true,context})
  assert.equal(r.complete,true,JSON.stringify(r.diagnostics));const store=createStore();makeScope(r.spec,store)
  assert.equal(observableContent(r.spec,store).includes('Shown'),truthy,value)
  executeAction(r.spec,store,'go',{});assert.equal(store.values.n,truthy?1:0,value)
 }
})
test('legacy conditions remain strict and JS guards retain transactional validation',()=>{
 const legacy=compileCard('<card><if test={"yes"}><text>Visible</text></if></card>',{final:true})
 assert.equal(legacy.complete,false)
 const r=compileCard('<card><state id="n" type="number" initial={0}/><text>{state.n}</text><action id="go"><set target="n" value={1} when={"ready"}/><set target="n" value={"wrong"}/></action></card>',{final:true,context})
 const store=createStore();makeScope(r.spec,store);assert.throws(()=>executeAction(r.spec,store,'go',{}));assert.equal(store.values.n,0)
 const noNetwork=compileCard('<card><if test={fetch("x")}><text>Bad</text></if></card>',{final:true,context});assert.equal(noNetwork.complete,false)
})
test('initial view reports independent sibling faults with exact source lines',()=>{
 const r=compileCard('<card><data id="bad" value="wrong"/>\n<segmented label="Choice" options={{0:"A"}}/>\n<slider label="Value" value={data.bad}/>\n<text>Fine</text></card>',{final:true,context})
 const errors=r.diagnostics.filter(d=>d.code==='binding')
 assert.ok(errors.some(d=>d.message.includes('segmented.options')&&d.line===2))
 assert.ok(errors.some(d=>d.message.includes('slider.value')&&d.line===3))
 assert.equal(r.complete,false)
})
test('preview faults are bounded and inactive branches are not evaluated',()=>{
 const errors=compileCard('<card><data id="bad" value="wrong"/>'+Array.from({length:25},()=>'<slider label="Value" value={data.bad}/>').join('')+'</card>',{final:true,context})
 assert.equal(errors.diagnostics.filter(d=>d.code==='binding').length,16)
 const r=compileCard('<card><data id="bad" value="wrong"/><if test={""}><slider label="Value" value={data.bad}/></if><text>Ready</text></card>',{final:true,context})
 assert.equal(r.complete,true,JSON.stringify(r.diagnostics))
})
test('immutable first R12 train output exposes array faults in its first validation pass',{skip: ["artifacts/javascript-upgrade/flash-baselines-r12/trains.json"].every(existsSync) ? false : "Private historical replay artifacts excluded from source export"}, ()=>{
 const record=JSON.parse(readFileSync('artifacts/javascript-upgrade/flash-baselines-r12/trains.json','utf8'))
 const source=record.trace.filter(e=>e.type==='diagnostics')[0].source
 const r=compileCard(source,{final:true,context:{...context,datasets:Object.fromEntries(record.records.map(r=>[r.id,r.value]))}})
 assert.equal(r.complete,false)
 assert.ok(r.diagnostics.some(d=>d.message.includes('segmented.options expected array')))
 assert.ok(!r.diagnostics.some(d=>d.message.includes('if.test expected boolean')))
})
