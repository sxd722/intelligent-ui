import test from 'node:test'
import assert from 'node:assert/strict'
import {composeTask} from '../shared/cardspec/task-composition.mjs'
import {evidenceSlice} from '../shared/cardspec/evidence-view.mjs'
import {behaviorFootprint,lostBehaviors} from '../server/cardspec/requirements.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {toolFieldDiagnostics} from '../shared/cardspec/tool-field-diagnostics.mjs'
import {compactDatasetHistory} from '../server/research/dataset-context.mjs'
import {assertSnapshot} from '../shared/cardspec/debug-assertions.mjs'
import {taskOutputSnapshot} from '../shared/cardspec/task-behavior.mjs'
import {makeScope,createStore} from '../shared/cardspec/store.mjs'
const tool='opencli.bilibili.search'
const rows=[{bvid:'BVone',title:'性能很好',url:'https://www.bilibili.com/video/BVone'},{bvid:'BVtwo',title:'噪音太大',url:'https://www.bilibili.com/video/BVtwo'}]
const raw={tool,status:'success',input:{query:'测试'},value:{items:rows}}
const analysis={tool:'dataset.analyze',status:'success',value:{items:rows.map((r,i)=>({...r,analysisLabel:i?'负面':'正面',analysisQuote:r.title})),analysis:{dataset:{tool}}}}
const view=(bindings={raw,analysis})=>composeTask({main:'raw'},{annotations:'analysis'},bindings)
test('one collection drives classification counts, filtering and exact source identity',()=>{
 const v=view();assert.equal(v.items[0].classification.label,'正面')
 const selected=evidenceSlice(v.items,{category:'负面'});assert.equal(selected.total,2);assert.equal(selected.groups.reduce((a,g)=>a+g.count,0),2);assert.equal(selected.items.length,1);assert.equal(selected.items[0].url,rows[1].url)
 assert.equal(evidenceSlice(v.items,{category:'负面',query:'性能'}).items.length,0)
 assert.equal(evidenceSlice(v.items,{source:'different'}).total,0)
})
test('changed originals, other providers, forged quotes and conflicting labels cannot inherit classification',()=>{
 for(const a of [{...analysis,current:false},{...analysis,value:{...analysis.value,analysis:{dataset:{tool:'opencli.xiaohongshu.search'}}}},{...analysis,value:{...analysis.value,items:analysis.value.items.map(r=>({...r,analysisQuote:'invented'}))}}])assert(view({raw,analysis:a}).items.every(r=>!r.classification))
 const changed={...raw,value:{items:[{...rows[0],title:'同ID内容已改变'},rows[1]]}};assert.equal(view({raw:changed,analysis}).items[0].classification,null)
 assert(view({raw:{...raw,value:{items:[{...rows[0],title:'另一条内容'}]}},analysis}).issues.some(i=>i.code==='CLASSIFICATION_SNAPSHOT_MISMATCH'))
 const conflict={...analysis,value:{...analysis.value,items:analysis.value.items.map(r=>({...r,analysisLabel:'不同'}))}}
 assert(composeTask({main:'raw'},{annotations:['analysis','conflict']},{raw,analysis,conflict}).items.every(r=>!r.classification))
 assert.throws(()=>composeTask({main:'raw'},{annotations:'raw'},{raw}),/dataset.analyze/)
})
test('component substitution does not depend on DOM event spelling, inert deletion still fails',()=>{
 const parse=s=>compileCard('<card>'+s+'</card>',{final:true}).spec
 const button=parse('<state id="n" type="string" initial="a"/><button onPress="pick">选择</button><action id="pick"><set target="n" value="b"/></action>')
 const segmented=parse('<state id="n" type="string" initial="a"/><segmented options={["a","b"]} value={state.n} onChange="pick"/><action id="pick"><set target="n" value={event.value}/></action>')
 assert.equal(lostBehaviors(behaviorFootprint(button),segmented).length,0)
 assert(lostBehaviors(behaviorFootprint(button),parse('<text>完成</text>')).length)
 assert(lostBehaviors(['event:onApply'],parse('<task-board items={[]}/>')).length)
})
test('response envelope statistics cannot be guessed from tool disclosure summaries',()=>{
 const r=compileCard('<card><binding id="a" tool="dataset.analyze" input={{items:[],instruction:"classify"}}/><derive id="n" value={(bindings.a.value.classificationCounts??[]).find(c=>c.label==="positive")?.value??0}/><stat label="统计" value={derived.n}/></card>',{final:true,context:{expressionDialect:'js-v1'}})
 assert(r.complete);const issues=toolFieldDiagnostics(r.spec,[{tool:'dataset.analyze',input:{items:[],instruction:'classify'},value:{items:[],source:'test',fetchedAt:'2026-11-11',truncated:false}}]);assert(issues.some(d=>d.code==='tool_response_field_missing'&&d.severity==='error'))
})
test('context compaction retains the native interaction recipe',()=>{
 const hostView={consumer:'<task-board/>',declarations:['<binding/>']},history=[{role:'tool',content:JSON.stringify({dataset:'D1',path:'context.datasets.D1',items:[{title:'x'.repeat(5000)}],hostView})},{role:'tool',content:'{}'}]
 assert(compactDatasetHistory(history).savedCharacters>0);assert.deepEqual(JSON.parse(history[0].content).hostView,hostView)
})
test('unknown result assertions are test errors, large actual output changes remain observable',()=>{
 assert.equal(assertSnapshot({changedResults:['missing']},{results:{}},{results:{known:1}}).classification,'test_plan')
 const r=compileCard('<card><state id="q" type="string" initial=""/><data id="rows" value={["'+Array.from({length:50},(_,i)=>'a'.repeat(100)+i).join('","')+'","b"]}/><derive id="shown" value={data.rows.filter(x=>x.includes(state.q))}/><each items={derived.shown} as="r" itemKey={r}><text>{r}</text></each></card>',{final:true,context:{expressionDialect:'js-v1'}})
 assert(r.complete,JSON.stringify(r.diagnostics));const store=createStore(),before=taskOutputSnapshot(r.spec,makeScope(r.spec,store));store.values.q='b';const after=taskOutputSnapshot(r.spec,makeScope(r.spec,store));assert(before.shown.digest);assert(assertSnapshot({changedResults:['shown']},{results:before},{results:after}).passed)
})
