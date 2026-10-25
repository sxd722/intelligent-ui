import test from 'node:test'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
import {experienceDiagnostics} from '../shared/cardspec/experience.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {createResearchSession} from '../server/research/session.mjs'
import {evidenceProfile,evidenceDiagnostics} from '../server/research/evidence-quality.mjs'
import {planningPolicy} from '../server/cardspec/compact-prompt.mjs'

test('deletable collection length is a warning for new row identity, never rewritten',()=>{
 const source=id=>`<card actionMode="snapshot"><state id="rows" type="array" initial={[]}/><state id="serial" type="number" initial={0}/><action id="add"><set target="rows" value={[...state.rows,{id:${id},title:"new"}]}/><increment target="serial" value={1}/></action><action id="remove"><set target="rows" value={state.rows.filter(row=>row.id!==args.id)}/></action><text>Editor</text></card>`
 const bad=compileCard(source('String(state.rows.length)'),{final:true,context:{expressionDialect:'js-v1'}})
 assert.equal(bad.complete,true);assert.ok(bad.diagnostics.some(d=>d.code==='collection_reused_identity'&&d.severity==='warning'))
 const safe=compileCard(source('String(state.serial)'),{final:true,context:{expressionDialect:'js-v1'}})
 assert.equal(safe.complete,true);assert.ok(!safe.diagnostics.some(d=>d.code==='collection_reused_identity'))
})

test('two real selections distinguish static revealed text from linked content without calling tools',()=>{
 const source=detail=>`<card actionMode="snapshot"><state id="selected" type="record" initial={{}}/><chart data={[{id:"a",label:"A",value:5},{id:"b",label:"B",value:8}]} onSelect="pick" selectedId={state.selected.id}/><if test={state.selected.id!==undefined}><text>${detail}</text></if><action id="pick"><set target="selected" value={event}/></action></card>`
 const compile=s=>compileCard(s,{final:true,context:{expressionDialect:'js-v1'}}).spec
 const bad=experienceDiagnostics(compile(source('B = 8')))
 assert.equal(bad.metrics.resultFeedbackActions,1,'revealing static text used to count as successful feedback')
 assert.equal(bad.metrics.selectionComparisons,1);assert.equal(bad.metrics.staticSelectionDetails,1)
 assert.ok(bad.warnings.some(d=>d.code==='experience_selection_detail_static'))
 const good=experienceDiagnostics(compile(source('{state.selected.label} = {state.selected.value}')))
 assert.equal(good.metrics.selectionComparisons,1);assert.equal(good.metrics.staticSelectionDetails,0)
 // An explicit remote result remains pending; static local text is not proof
 // that the asynchronously dispatched outcome would be identical.
 const remote=source('Waiting').replace('<state id="selected"','<binding id="load" tool="hackernews.top" input={{limit:3}} initial={[]} load="manual"/><state id="selected"').replace('<set target="selected" value={event}/>','<set target="selected" value={event}/><invoke binding="load"/>')
 assert.equal(experienceDiagnostics(compile(remote)).metrics.staticSelectionDetails,0)
})

test('literal collection root confusion is detected without rejecting legitimate nested records',()=>{
 const source='<card><data id="rows" value={[{id:"a",price:20}]}/><state id="picked" type="record" initial={{}}/><derive id="total" value={sum(filter(data.rows,item.state.picked[item.id]??false),item.price)}/><stat value={derived.total}/></card>'
 assert.ok(compileCard(source,{final:true}).diagnostics.some(d=>d.code==='expression_shadowed_root'&&d.severity==='error'))
 const valid=source.replace('{id:"a",price:20}','{id:"a",price:20,state:{picked:{a:true}}}')
 assert.ok(compileCard(valid,{final:true}).complete)
 assert.ok(compileCard('<card><data id="rows" value={[{id:"a"}]}/><each items={data.rows} itemKey={item.id}><text>{item.optional??"未知"}</text></each></card>',{final:true}).complete)
})
test('selection, cancellation and reset keep summaries connected without effects',()=>{
 const source='<card actionMode="snapshot"><data id="rows" value={[{id:"a",price:20},{id:"b",price:30}]}/><state id="picked" type="record" initial={{}}/><derive id="total" value={sum(filter(data.rows,state.picked[item.id]??false),item.price)}/><action id="pick"><toggle target="picked" key={args.id}/></action><action id="reset"><set target="picked" value={{}}/></action><each items={data.rows} itemKey={item.id}><button onPress="pick" args={{id:item.id}}>{item.id}</button></each><stat value={derived.total}/></card>'
 const r=compileCard(source,{final:true});assert.equal(r.complete,true);const st=createStore(),effects=[];makeScope(r.spec,st)
 for(const [id,total]of [['a',20],['b',50],['a',30],['b',0]]){executeAction(r.spec,st,'pick',{args:{id},effects});assert.equal(makeScope(r.spec,st).derived.total,total)}
 executeAction(r.spec,st,'reset',{effects});assert.equal(makeScope(r.spec,st).derived.total,0);assert.deepEqual(effects,[])
})
test('detached editor diagnosed; inputs consumed by formulas or save actions remain valid',()=>{
 const body='<state id="kind" type="string" initial="a"/><action id="change"><set target="kind" value={event.value}/></action><select value={state.kind} options={["a","b"]} onChange="change"/>'
 const compile=extra=>compileCard('<card>'+body+extra+'</card>',{final:true})
 assert.ok(compile('<text>固定结果</text>').diagnostics.some(d=>d.code==='interaction_unconsumed_state'))
 assert.ok(!compile('<text>{state.kind=="a"?"结果A":"结果B"}</text>').diagnostics.some(d=>d.code==='interaction_unconsumed_state'))
 assert.ok(!compile('<state id="saved" type="string" initial=""/><action id="save"><set target="saved" value={state.kind}/></action><button onPress="save">保存</button>').diagnostics.some(d=>d.code==='interaction_unconsumed_state'))
})
test('experience metrics distinguish echoed state from content feedback',()=>{
 const s=compileCard('<card><state id="n" type="number" initial={1}/><action id="change"><set target="n" value={event.value}/></action><slider label="参数" value={state.n} min={0} max={10} onChange="change"/><text>固定</text></card>',{final:true}).spec
 const d=experienceDiagnostics(s);assert.ok(d.metrics.changedActions>0);assert.equal(d.metrics.resultFeedbackActions,0);assert.ok(d.warnings.some(w=>w.code==='experience_result_unchanged'))
})
test('creative planning and deterministic implementation use separate temperatures and shared budget',async()=>{
 const ext=createGenerationTools({goal:'设计一个研究工作台',enabled:false}),s=createResearchSession({extensions:ext}),seen=[]
 const round=async(messages,options)=>{seen.push(options);if(options.toolChoice)return {message:{tool_calls:[{id:'p',function:{name:'plan_cards',arguments:JSON.stringify({cards:[{title:'工作台',goal:'研究者选择对象，关联图与结果共同更新'}],followups:[]})}}]},usage:{total_tokens:100}};assert.match(JSON.stringify(messages),/关联图/);return {message:{content:'<card/>'}}}
 const options={temperature:.4,signal:new AbortController().signal}
 await s.run(round,[{role:'user',content:'研究工作台'}],options)
 assert.equal(seen[0].temperature,.85);assert.equal(seen[1].temperature,.4);assert.equal(s.snapshot().calls,0)
 await s.run(round,[{role:'user',content:'修复实现'}],options);assert.equal(seen.filter(o=>o.toolChoice).length,1);assert.equal(s.snapshot().modelCalls,3)
})
test('planning failure falls back once; no model repair loop and no lost generation',async()=>{
 const s=createResearchSession({extensions:createGenerationTools({goal:'研究工作台',enabled:false})});let plans=0
 const result=await s.run(async(_m,o)=>{if(o.toolChoice){plans++;return {message:{content:'not a tool plan'}}}return {message:{content:'usable'}}},[],{temperature:.4})
 assert.equal(result,'usable');assert.equal(plans,1);assert.ok(s.snapshot().trace.some(t=>t.type==='cardplan'&&t.status==='fallback'))
})
test('routing uses task complexity while independent followups remain available',()=>{
 for(const goal of ['研究工作台','给主持人做叙事助手','解释光合作用与呼吸作用的原理','round trip assistant'])assert.equal(planningPolicy(goal).allowPlanning,true)
 for(const goal of ['一个计数器','2028年2月日历','只要简单的任务清单','研究工作台，skip planning'])assert.equal(planningPolicy(goal).allowPlanning,false)
 assert.equal(planningPolicy('计数器').allowFollowups,true)
})
test('evidence separates freshness, mentions and verification; no automatic endorsement',()=>{
 const e={kind:'search',publishedAt:'2020-01-01',excerpt:'Event listed at 2020-02-01',truncated:true}
 const quality=evidenceProfile(e,'2026-10-16T00:00:00Z');assert.equal(quality.authority,'unverified');assert.equal(quality.claimVerification,'not-established');assert.equal(quality.level,'search-snippet')
 const d=evidenceDiagnostics([{...e,quality}],{goal:'current availability',localDate:'2026-10-16'});assert.ok(d.some(d=>d.code==='evidence_time_check'));assert.ok(d.every(d=>d.severity==='warning'))
 assert.ok(!evidenceDiagnostics([{...e,quality}],{goal:'历史研究',localDate:'2026-10-16'}).some(d=>d.code==='evidence_time_check'))
})
test('provider failure trace retains safe classification and request identity',async()=>{
 const s=createResearchSession({providers:{read:async()=>{throw Error('HTTP 429 token=private')}}});let n=0
 await s.run(async()=>++n===1?{message:{tool_calls:[{id:'r123',function:{name:'web_read',arguments:'{"url":"https://example.org"}'}}]}}:{message:{content:'unknown'}},[],{})
 const failure=s.snapshot().trace.find(t=>t.status==='failed');assert.equal(failure.code,'RATE_LIMITED');assert.equal(failure.requestId,'r123');assert.ok(!JSON.stringify(failure).includes('private'))
})
