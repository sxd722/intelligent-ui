import test from 'node:test'
import assert from 'node:assert/strict'
import {createBuildWorkspace} from '../server/cardspec/build-workspace.mjs'
import {compileCard,splitBuildFragment} from '../shared/cardspec/compiler.mjs'
import {createStore,executeAction,makeScope} from '../shared/cardspec/store.mjs'
import {buildInterface} from '../server/cardspec/build-feedback.mjs'
import {buildDataflowDiagnostics} from '../server/cardspec/build-dataflow.mjs'
const context={expressionDialect:'js-v1',renderMode:'hybrid'}
test('module-owned declarations link at card scope and remain live after conditional navigation',()=>{
 const w=createBuildWorkspace()
 w.write([{name:'main.cardspec',content:'<card><state id="view" type="string" initial="list"/><state id="selected" type="string" initial=""/><if test={state.view==="list"}><include module="list.cardspec"/></if><if test={state.view==="detail"}><include module="detail.cardspec"/></if></card>'}])
 w.write([{name:'list.cardspec',content:'<fragment><button onPress="pick">Choose</button><action id="pick"><set target="selected" value="entity-1"/><set target="view" value="detail"/></action></fragment>'},{name:'detail.cardspec',content:'<text>{state.selected}</text><button onPress="back">Back</button><action id="back"><set target="view" value="list"/></action>'}],{checkSyntax:true})
 const assembled=w.assemble(),r=compileCard(assembled.source,{final:true,context})
 assert.equal(r.complete,true,JSON.stringify(r.diagnostics))
 assert.match(buildInterface(w.interfaceSource()).actions.pick,/selected/)
 const store=createStore();makeScope(r.spec,store);executeAction(r.spec,store,'pick',{});assert.equal(store.values.view,'detail');executeAction(r.spec,store,'back',{});assert.equal(store.values.selected,'entity-1');assert.equal(store.values.view,'list')
 const at=assembled.source.indexOf('<action id="pick"');assert.equal(assembled.ranges.find(r=>at>=r.start&&at<r.end).name,'list.cardspec')
})
test('linking does not extract markup inside strings or hoist loop-scoped actions',()=>{
 const parts=splitBuildFragment('<data id="snippet" value={"<action id=\\"x\\"/>"}/><each items={[]} as="x"><action id="unsafe"/></each>')
 assert.equal(parts.declarations.length,1);assert.match(parts.view,/<action id="unsafe"/)
 const logic=splitBuildFragment('<logic id="simulation" initial={{}} source="return state"/><text>Simulation</text>')
 assert.equal(logic.declarations.length,0);assert.match(logic.view,/<logic/)
 const compiled=compileCard('<card>'+parts.declarations[0].source+parts.view+'</card>',{final:true,context})
 assert.ok(compiled.diagnostics.some(d=>d.message==='unknown component action'))
})
test('duplicate declaration IDs remain errors rather than last-writer-wins',()=>{
 const w=createBuildWorkspace();w.write([{name:'main.cardspec',content:'<card><state id="n" type="number" initial={1}/><include module="view.cardspec"/></card>'},{name:'view.cardspec',content:'<state id="n" type="number" initial={2}/><text>{state.n}</text>'}])
 const r=compileCard(w.assemble().source,{final:true,context});assert.equal(r.complete,false)
})
test('linked declaration errors identify their owning file, not EOF/main',()=>{
 const w=createBuildWorkspace();w.write([{name:'main.cardspec',content:'<card><include module="detail.cardspec"/></card>'},{name:'detail.cardspec',content:'<derive id="item" value={derived.missing}/><text>Detail</text>'}])
 const a=w.assemble(),r=compileCard(a.source,{final:true,context}),error=r.diagnostics.find(d=>d.message==='unknown derived.missing')
 assert.ok(error);assert.equal(a.ranges.find(range=>error.offset>=range.start&&error.offset<range.end).name,'detail.cardspec');assert.match(error.context.text,/<derive/)
})
test('flatMap scopes nested callbacks but never leaks them outside the callback',()=>{
 const r=compileCard('<card><data id="rows" value={[{tags:["a","b"]},{tags:["c"]}]}/><derive id="facets" value={Array.from(new Set(data.rows.flatMap(row=>row.tags.map(tag=>tag))))}/><text>{derived.facets.join(",")}</text></card>',{final:true,context})
 assert.equal(r.complete,true,JSON.stringify(r.diagnostics));const store=createStore();assert.deepEqual(makeScope(r.spec,store).derived.facets,['a','b','c'])
 assert.equal(compileCard('<card><text>{row.tags}</text></card>',{final:true,context}).complete,false)
})
test('entity media chooses host asset source over a redundant stock query',()=>{
 const r=compileCard('<card><image assetRef="asset.v1.test.proof" query="https://example.com/poster.jpg" alt="Entity"/></card>',{final:true,context})
 assert.equal(r.complete,true,JSON.stringify(r.diagnostics));assert.equal(r.spec.children[0].props.query,undefined);assert.ok(r.diagnostics.some(d=>d.code==='image_source_normalized'))
 assert.equal(compileCard('<card><image query="https://example.com/poster.jpg"/></card>',{final:true,context}).complete,false)
})
test('one view navigation owner, without suppressing buttons with meaningful side effects',()=>{
 const source='<card><state id="view" type="string" initial="list"/><state id="n" type="number" initial={0}/><segmented id="tabs" label="Views" value={state.view} options={[{value:"list",label:"List"},{value:"detail",label:"Detail"}]}/><button id="duplicate" onPress="go">Go</button><action id="go"><set target="view" value="detail"/></action></card>'
 assert.ok(buildDataflowDiagnostics(source,{context}).some(d=>d.code==='view_navigation_redundant'))
 assert.ok(!buildDataflowDiagnostics(source.replace('<set target="view"','<increment target="n"/><set target="view"'),{context}).some(d=>d.code==='view_navigation_redundant'))
})
test('co-visible equivalent return actions are diagnosed, exclusive views are not',()=>{
 const start='<card><state id="view" type="string" initial="detail"/>',back='<button onPress="back">Back</button>',action='<action id="back"><set target="view" value="list"/></action></card>'
 const duplicate=start+'<if test={state.view==="detail"}>'+back+back+'</if>'+action
 assert.ok(buildDataflowDiagnostics(duplicate,{context}).some(d=>d.code==='view_navigation_duplicate'))
 const exclusive=start+'<if test={state.view==="detail"}>'+back+'</if><if test={state.view==="compare"}>'+back+'</if>'+action
 assert.ok(!buildDataflowDiagnostics(exclusive,{context}).some(d=>d.code==='view_navigation_duplicate'))
})

test('shared action consumers must provide directly required args, optional fallback is allowed',()=>{
 const source='<card><state id="n" type="number" initial={1}/><state id="view" type="boolean" initial={false}/><if test={state.view}><slider id="amount" label="Amount" value={state.n} onChange="set"/></if><action id="set"><set target="n" value={args.value}/></action></card>'
 assert.ok(buildDataflowDiagnostics(source,{context}).some(d=>d.code==='build_action_args_missing'))
 assert.ok(!buildDataflowDiagnostics(source.replace('value={args.value}','value={args.value ?? event.value}'),{context}).some(d=>d.code==='build_action_args_missing'))
 assert.ok(!buildDataflowDiagnostics(source.replace('onChange="set"','onChange="set" args={{value:2}}'),{context}).some(d=>d.code==='build_action_args_missing'))
})
