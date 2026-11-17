import test from 'node:test'
import assert from 'node:assert/strict'
import {componentSelection} from '../shared/cardspec/component-selection.mjs'
import {cardGenerationPrompt} from '../server/cardspec/prompt.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {assertSnapshot,validateExpectation} from '../shared/cardspec/debug-assertions.mjs'
import {journeyCoverage} from '../server/cardspec/journey-coverage.mjs'
import {createBehaviorLedger} from '../shared/cardspec/task-behavior.mjs'
import {createDebugSession} from '../server/cardspec/debug-session.mjs'
import {createResearchSession} from '../server/research/session.mjs'

test('bounded task disclosure preserves escape hatch and respects native mode',()=>{
 for(const goal of ['计数器','推荐电影并比较候选','旅行路线和预算','关系原理与因果','矩阵激活模拟器','原创SVG动画']){
  const a=componentSelection(goal,{renderMode:'native'}),b=componentSelection(goal,{renderMode:'hybrid'})
  assert.ok(a.names.length<=30);assert.ok(!a.names.includes('sandbox'));assert.equal(a.extraModelCalls,0)
  if(goal.includes('SVG'))assert.ok(b.names.includes('sandbox'))
  const prompt=cardGenerationPrompt(null,{adaptive:true,goal})
  assert.match(prompt,/明确选择设计/);assert.match(prompt,/component_describe/);assert.match(prompt,/each是迭代语法/)
 }
 assert.ok(componentSelection('推荐电影').names.includes('collection'))
 assert.ok(componentSelection('关系原理').names.includes('flowchart'))
 assert.ok(!componentSelection('计数器').names.includes('heatmap'))
})
test('new generation warns on omitted design without breaking old cards or host preference',()=>{
 const source='<card><text>内容</text></card>'
 assert.ok(!compileCard(source,{final:true}).diagnostics.some(d=>d.code==='design_choice_missing'))
 const omitted=compileCard(source,{final:true,context:{requireDesignChoice:true}})
 assert.equal(omitted.complete,true);assert.ok(omitted.diagnostics.some(d=>d.code==='design_choice_missing'))
 for(const design of ['default','friendly','cinematic','folio','atlas']){
  const explicit=compileCard(source.replace('<card>',`<card design="${design}">`),{final:true,context:{requireDesignChoice:true}})
  assert.equal(explicit.spec.design,design);assert.ok(!explicit.diagnostics.some(d=>d.code==='design_choice_missing'))
  assert.equal(compileCard(source,{final:true,context:{designPreference:design}}).spec.design,design)
 }
})
test('outcome relations reject mismatched entity/detail, resource loss and missing paths',()=>{
 const compare={relations:[{left:'derived.rows.length',op:'eq',right:'derived.selected.count'}]}
 assert.equal(assertSnapshot(compare,{}, {derived:{rows:[1,2],selected:{count:3}}}).passed,false)
 assert.equal(assertSnapshot(compare,{}, {derived:{rows:[1,2],selected:{count:2}}}).passed,true)
 assert.equal(assertSnapshot(compare,{},{}).passed,false)
 const invariant={relations:[{left:'state.balance',op:'eq',right:'before.state.balance'}]}
 assert.equal(assertSnapshot(invariant,{state:{balance:6}},{state:{balance:5}}).passed,false)
 assert.equal(assertSnapshot(invariant,{state:{balance:6}},{state:{balance:6}}).passed,true)
 assert.equal(assertSnapshot({controls:[{name:'继续',enabled:true}]},{},{controls:[{name:'继续',disabled:true}]}).passed,false)
 assert.equal(assertSnapshot({controls:[{name:'继续',enabled:false}]},{},{controls:[]}).passed,false)
 assert.throws(()=>validateExpectation({relations:[{left:'state.constructor.name',op:'eq',right:'state.x'}]}))
 assert.throws(()=>validateExpectation({relations:[{left:'state.x()',op:'eq',right:'state.x'}]}))
})
test('CUJ requires executed path and outcome; animation and input echoes alone stay unverified',()=>{
 const spec=compileCard('<card><state id="x" type="number" initial={1}/><slider label="数值" value={state.x}/></card>',{final:true}).spec
 const coverage=actions=>journeyCoverage('调整后查看结果',spec,{status:'tested',runs:[{scenario:'normal',width:432,actions}]})
 const step=expect=>({ok:true,changed:true,assertion:{passed:true},step:{op:'fill',requirement:'R1',expect}})
 for(const expect of [{changed:true},{sandboxChanged:'a'},{state:{x:2}}])assert.equal(coverage([step(expect)]).status,'unverified')
 assert.equal(coverage([step({derived:{total:4}})]).status,'checked')
 assert.equal(coverage([{...step({derived:{total:4}}),assertion:{passed:false}}]).status,'failed')
 assert.equal(coverage([{...step({derived:{total:4}}),ok:false}]).status,'unverified')
 assert.equal(coverage([{...step({derived:{total:4}}),step:{op:'check',requirement:'R1',expect:{derived:{total:4}}}}]).status,'unverified')
 assert.equal(coverage([{ok:false,step:{op:'click'}},step({derived:{total:4}})]).status,'unverified')
})
test('failed CUJ result paths cannot vanish on resubmission',()=>{
 const ledger=createBehaviorLedger(),steps=[{op:'click',name:'继续',expect:{controls:[{name:'下一步',enabled:true}]}}]
 ledger.observe(steps,{actions:[{ok:true,assertion:{passed:false}}]})
 assert.equal(ledger.missing([]).length,1)
})
test('missing CUJ evidence stays partial in debug feedback and exposes IDs',async()=>{
 const runner=async()=>({status:'tested',runs:[{scenario:'normal',initial:{errors:[]},final:{errors:[],controls:[],coverage:[]},actions:[],pageErrors:[]}]})
 const d=createDebugSession({context:()=>({userGoal:'选择一个候选查看详情'}),runner})
 const feedback=await d.test({source:'<card design="business"><text>候选</text></card>'})
 assert.equal(feedback.status,'partial');assert.equal(feedback.cuj.status,'unverified');assert.equal(feedback.cuj.remaining[0].id,'R1')
})
test('debug starts through tools without forcing a repeated partial-repair loop',async()=>{
 const runner=async()=>({status:'tested',runs:[{scenario:'normal',initial:{errors:[]},final:{errors:[],controls:[],coverage:[]},actions:[],pageErrors:[]}]})
 const debug=createDebugSession({context:()=>({userGoal:'选择候选'}),runner}),research=createResearchSession({})
 let calls=0
 const source='<card design="friendly"><text>候选</text></card>'
 await research.run(async(_messages,options)=>{
  calls++
  if(calls===1){assert.equal(options.toolChoice,'required');return {message:{tool_calls:[{id:'test',function:{name:'card_test',arguments:JSON.stringify({source})}}]}}}
  assert.equal(options.toolChoice,undefined);return {message:{content:source}}
 },[],{debugSession:debug,requireJourneyTest:true,signal:new AbortController().signal})
 assert.equal(calls,2);assert.equal(debug.snapshot().tests[0].status,'partial')
})
