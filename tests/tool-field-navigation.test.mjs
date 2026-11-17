import test from 'node:test'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {toolFieldDiagnostics} from '../shared/cardspec/tool-field-diagnostics.mjs'
import {taskBehaviorDiagnostics} from '../shared/cardspec/task-behavior.mjs'
import {assertSnapshot} from '../shared/cardspec/debug-assertions.mjs'
import {compactDatasetHistory} from '../server/research/dataset-context.mjs'
const record={tool:'hackernews.top',input:{limit:3},value:{items:[{id:'1',title:'A',score:10,url:'https://example.org/a'},{id:'2',title:'B',score:1,url:'https://example.org/b'}]}}
const compile=body=>compileCard(`<card><binding id="news" tool="hackernews.top" input={{limit:3}} load="visible"/>${body}</card>`,{final:true,context:{expressionDialect:'js-v1'}}).spec

test('real binding snapshots expose absent predicate fields through derived aliases without calls or mutation',()=>{
 const spec=compile('<derive id="rows" value={bindings.news.value.items??[]}/><derive id="selected" value={rows.filter(r=>r.sentiment==="positive")}/><text>{selected.length}</text>'),before=JSON.stringify(spec)
 const issues=toolFieldDiagnostics(spec,[record])
 assert(issues.some(d=>d.code==='tool_field_missing'&&d.message.includes('sentiment')))
 assert.equal(JSON.stringify(spec),before)
 for(const field of ['departureTime','rating','category']){
  const s=compile(`<derive id="selected" value={(bindings.news.value.items??[]).filter(r=>r.${field}==="x")}/><text>{selected.length}</text>`)
  assert(toolFieldDiagnostics(s,[record]).some(d=>d.severity==='error'))
 }
})
test('mismatched inputs, empty snapshots, present optional fields and explicit absence guards are not hard errors',()=>{
 const s=compile('<derive id="selected" value={(bindings.news.value.items??[]).filter(r=>r.sentiment==="positive")}/><text>{selected.length}</text>')
 for(const r of [{...record,input:{limit:4}},{...record,value:{items:[]}},{...record,value:{items:[{sentiment:'positive'},{}]}}])assert.equal(toolFieldDiagnostics(s,[r]).filter(d=>d.severity==='error').length,0)
 const lateField={...record,value:{items:[...Array.from({length:64},()=>({id:'unknown'})),{id:'late',sentiment:'positive'}]}}
 assert.equal(toolFieldDiagnostics(s,[lateField]).filter(d=>d.severity==='error').length,0)
 for(const expr of ['r.sentiment!=null&&r.sentiment==="positive"','(r.sentiment??"unknown")==="positive"','!r.sentiment']){
  const guarded=compile(`<derive id="selected" value={(bindings.news.value.items??[]).filter(r=>${expr})}/><text>{selected.length}</text>`)
  assert.equal(toolFieldDiagnostics(guarded,[record]).filter(d=>d.severity==='error').length,0)
 }
})
test('supplied classified rows and genuine source keys remain valid',()=>{
 const s=compile('<derive id="selected" value={(bindings.news.value.items??[]).filter(r=>r.analysisLabel==="positive")}/><text>{selected.length}</text>')
 assert.equal(toolFieldDiagnostics(s,[{...record,value:{items:record.value.items.map(r=>({...r,analysisLabel:'positive'}))}}]).length,0)
})

test('collection rendered identity is distinguished from business id using actual rows',()=>{
 const source=field=>`<state id="sel" type="string" initial=""/><derive id="rows" value={bindings.news.value.items??[]}/><derive id="cur" value={rows.find(r=>r.${field}===state.sel)??null}/><collection items={rows} onSelect="pick"/><action id="pick"><set target="sel" value={event.id}/></action>`
 const actual={...record,value:{items:record.value.items.map((r,i)=>({...r,rowKey:'host-'+i}))}}
 assert(toolFieldDiagnostics(compile(source('id')),[actual]).some(d=>d.code==='tool_selection_identity'))
 assert(!toolFieldDiagnostics(compile(source('rowKey')),[actual]).some(d=>d.code==='tool_selection_identity'))
 assert(!toolFieldDiagnostics(compile(source('id')),[record]).some(d=>d.code==='tool_selection_identity'))
})
test('constant sentiment per source is rejected; source metadata and explicit unknown are valid',()=>{
 for(const field of ['attitude','stance','sentiment','analysisLabel']){
  const s=compile(`<derive id="rows" value={(bindings.news.value.items??[]).map(r=>({id:r.id,${field}:"positive"}))}/><text>{rows.length}</text>`)
  assert(toolFieldDiagnostics(s,[record]).some(d=>d.code==='tool_classification_unproven'))
 }
 for(const body of ['{id:r.id,platform:"HN",stance:"unknown"}','{id:r.id,stance:"未标注"}','{id:r.id,stance:"待分类"}','{id:r.id,stance:r.analysisLabel}','{id:r.id,city:"杭州"}']){
  const s=compile(`<derive id="rows" value={(bindings.news.value.items??[]).map(r=>(${body}))}/><text>{rows.length}</text>`)
  assert(!toolFieldDiagnostics(s,[record]).some(d=>d.code==='tool_classification_unproven'))
 }
})
test('external-source promises cannot be fulfilled by only selecting an item',()=>{
 const broken=compile('<state id="id" type="string" initial=""/><button label="打开原文" onPress="open"/><action id="open"><set target="id" value="1"/></action>')
 assert(taskBehaviorDiagnostics(broken).some(d=>d.code==='navigation_without_destination'))
 const good=compile('<link url="https://example.org/a" label="打开原文"/>')
 assert(!taskBehaviorDiagnostics(good).some(d=>d.code==='navigation_without_destination'))
 const detail=compile('<state id="id" type="string" initial=""/><button label="查看详情" onPress="open"/><action id="open"><set target="id" value="1"/></action><text>{state.id}</text>')
 assert(!taskBehaviorDiagnostics(detail).some(d=>d.code==='navigation_without_destination'))
})
test('navigation assertion requires a new valid attempt with the expected destination',()=>{
 const first={id:'1',valid:true,url:'https://example.org/a'}
 assert.equal(assertSnapshot({navigation:true},{},{state:{openId:'1'}}).passed,false)
 assert.equal(assertSnapshot({navigation:true},{navigation:[first]},{navigation:[first]}).passed,false)
 assert.equal(assertSnapshot({navigation:true},{},{navigation:[{id:'2',valid:false,url:'javascript:bad'}]}).passed,false)
 assert.equal(assertSnapshot({navigation:'https://example.org/a'},{},{navigation:[first]}).passed,true)
 assert.equal(assertSnapshot({navigation:'https://example.org/b'},{},{navigation:[first]}).passed,false)
})
test('HTML href alias retains validation and refuses ambiguous destinations',()=>{
 const c=source=>compileCard(`<card>${source}</card>`,{final:true})
 const ok=c('<link href="https://example.org/a">原文</link>')
 assert.equal(ok.complete,true);assert.equal(ok.spec.children[0].props.url.value,'https://example.org/a')
 assert.equal(c('<link href="https://example.org/a" url="https://example.org/b"/>').complete,false)
 // URL safety is enforced by the renderer, equally for url and its alias.
 assert.deepEqual(c('<link href="javascript:alert(1)"/>').spec.children[0].props.url,c('<link url="javascript:alert(1)"/>').spec.children[0].props.url)
})

test('native event fields are validated for list items as well as buttons, without rewriting logic events',()=>{
 const c=body=>compileCard(`<card><state id="selected" type="string" initial=""/>${body}<action id="pick"><set target="selected" value={event.id}/></action></card>`,{final:true})
 for(const tag of ['button','list-item','chip','pressable'])assert(c(`<${tag} label="选择" onPress="pick" args={{id:"a"}}/>`).diagnostics.some(d=>d.code==='event_field_missing'))
 assert(!c('<collection items={[{id:"a",title:"A"}]} onSelect="pick"/>').diagnostics.some(d=>d.code==='event_field_missing'))
 assert(!compileCard('<card><state id="s" type="string" initial=""/><list-item onPress="pick" args={{id:"a"}}/><action id="pick"><set target="s" value={args.id}/></action></card>',{final:true}).diagnostics.some(d=>d.code==='event_field_missing'))
})
test('dataset compaction preserves identities, contracts, latest result and errors',()=>{
 const old={dataset:'D1',path:'context.datasets.D1',fields:['title','url'],totalObserved:8,bindingRecipe:{tool:'hackernews.top'},items:Array.from({length:8},()=>({title:'x'.repeat(500),url:'https://example.org'}))}
 const contract={role:'tool',content:JSON.stringify({schema:'x'.repeat(3000)})},failed={role:'tool',content:JSON.stringify({...old,error:'not authenticated'})},last={role:'tool',content:JSON.stringify(old)}
 const h=[contract,{role:'tool',content:JSON.stringify(old)},failed,last],before=JSON.stringify([contract,failed,last])
 const result=compactDatasetHistory(h),r=JSON.parse(h[1].content)
 assert(result.savedCharacters>0);assert.equal(r.path,old.path);assert.deepEqual(r.fields,old.fields);assert.deepEqual(r.bindingRecipe,old.bindingRecipe);assert(r.sampleOnly)
 assert.equal(JSON.stringify([contract,failed,last]),before)
 assert.equal(compactDatasetHistory(h).savedCharacters,0)
})
