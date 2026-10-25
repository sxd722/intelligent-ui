import test from 'node:test'
import assert from 'node:assert/strict'
import { compileCard } from '../shared/cardspec/compiler.mjs'
import { INTERACTION_FIXTURES } from '../shared/cardspec/interaction-fixtures.mjs'
import { TEST_CONTEXT } from '../shared/cardspec/fixtures.mjs'
import { validatePlanNavigation } from '../server/cardspec/planning.mjs'
const compile=source=>compileCard(source,{final:true,context:TEST_CONTEXT})
const wrap=body=>`<card>${body}</card>`
test('navigation and companion examples compile without special business rules',()=>{
  for(const [name,source] of Object.entries(INTERACTION_FIXTURES)) assert.deepEqual(compile(source).diagnostics,[],name)
})
test('planner enforces one controller declaration per owner and leaves independent owners alone',()=>{
  assert.doesNotThrow(()=>validatePlanNavigation({navigation:[{ownerId:'a',kind:'page',controls:'builtin'},{ownerId:'b',kind:'month',controls:'external',controllerId:'monthNav'}]}))
  for(const navigation of [[{ownerId:'a',kind:'page',controls:'builtin',controllerId:'extra'}],[{ownerId:'a',kind:'page',controls:'external'}],[{ownerId:'a',kind:'page',controls:'builtin'},{ownerId:'a',kind:'page',controls:'builtin'}]]) assert.throws(()=>validatePlanNavigation({navigation}))
})
test('single nested navigation owners are rejected for lists, calendars and carousels',()=>{
  for(const inner of ['<region id="inner" overflow="paginate"><text id="t">a</text></region>','<calendar id="inner" month="2027-02"/>','<carousel id="inner"><carousel-item id="item"><text id="t">a</text></carousel-item></carousel>']) {
    const result=compile(wrap(`<region id="outer" overflow="paginate"><box id="wrap">${inner}</box></region>`))
    assert.ok(result.diagnostics.some(d=>d.code==='navigation_nested'))
  }
  assert.ok(compile(wrap('<region id="a" overflow="paginate"><text id="t">a</text></region><region id="b" overflow="paginate"><text id="u">b</text></region>')).complete)
})
test('external navigation requires one valid target and explicit ownership',()=>{
  for(const [body,code] of [
    ['<navigation id="nav" target="missing"/>','navigation_target'],
    ['<carousel id="owner"/><navigation id="nav" target="owner"/>','navigation_duplicate'],
    ['<carousel id="owner" navigation="external"/>','navigation_missing'],
    ['<carousel id="owner" navigation="external"/><navigation id="nav" target="owner"/><navigation id="nav2" target="owner"/>','navigation_duplicate'],
  ]) assert.ok(compile(wrap(body)).diagnostics.some(d=>d.code===code))
})
test('manual navigation action conflicts are detected structurally; resets and business actions remain valid',()=>{
  const source=INTERACTION_FIXTURES.shortlist.replace('<title id="title">','<action id="advance"><set target="page" value={min(2,state.page+1)}/></action><button id="extra" onPress="advance">任意标签</button><title id="title">')
  assert.ok(compile(source).diagnostics.some(d=>d.code==='navigation_duplicate'))
  assert.ok(compile(source.replace('min(2,state.page+1)','0')).complete)
  const calendar=wrap('<state id="m" type="string" initial="2027-02"/><action id="back"><set target="m" value={addMonths(state.m,-1)}/></action><calendar id="cal" month={state.m}/><button id="extra" onPress="back">任意标签</button>')
  assert.ok(compile(calendar).diagnostics.some(d=>d.code==='navigation_duplicate'))
})
