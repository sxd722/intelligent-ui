import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compileCard } from '../shared/cardspec/compiler.mjs'
import { evaluate, parseExpression, monthCells, dateKey } from '../shared/cardspec/expression.mjs'
import { makeScope, createStore, executeAction } from '../shared/cardspec/store.mjs'
import { FIXTURES, calendar, TEST_CONTEXT } from '../shared/cardspec/fixtures.mjs'
import { parse } from '../server/compiler/parse.mjs'
import { compile as compileDil } from '../server/compiler/codegen.mjs'
const compile = (src, final = true) => compileCard(src, { final, context: TEST_CONTEXT, cardId: 'test' })

test('all seven unrelated scenarios compile and evaluate', () => {
  for (const [name, source] of Object.entries(FIXTURES)) {
    const result = compile(source)
    // Presentation warnings (e.g. a standalone stage recorder) are not failures.
    assert.deepEqual(result.diagnostics.filter(d=>d.severity==='error'), [], name)
    assert.equal(result.complete, true, name)
    makeScope(result.spec, createStore())
  }
})
test('every character prefix remains safe to compile; unfinished syntax is not text', () => {
  for (const source of [FIXTURES.counter, '<card><text id="t">正常文字 {"}"} &lt; 结束</text></card>']) {
    for (let i = 0; i <= source.length; i++) {
      const r = compile(source.slice(0, i), false)
      assert.ok(!r.diagnostics.some((d) => d.code === 'syntax'), `prefix ${i}: ${JSON.stringify(r.diagnostics)}`)
      const walk = (nodes) => { for (const n of nodes || []) { if (n.type === 'run' && n.value.type === 'literal') assert.ok(!/<\/?(?:card|text|region|input)/.test(n.value.value)); walk(n.children) } }
      walk(r.spec?.children)
    }
  }
  assert.equal(compile('<card><text id="t">正常文字</te').complete, false)
})
test('expression parser handles quoted braces and rejects arbitrary execution', () => {
  assert.equal(evaluate(parseExpression('"}" + "{"'), {}), '}{')
  assert.equal(evaluate(parseExpression('max(2, 3*4) == 12 ? "yes" : "no"'), {}), 'yes')
  for (const s of ['window.alert(1)', '(()=>1)()', 'data.constructor()', 'fetch("/")', 'new Function("x")']) assert.throws(() => parseExpression(s))
  assert.throws(() => evaluate(parseExpression('state["constructor"]'), { state: {} }))
})
test('registration enforces attributes, IDs, accessibility and references', () => {
  for (const src of ['<card><box id="b" gap={3}/></card>', '<card><unknown id="x"/></card>', '<card><text id="t"/><text id="t"/></card>', '<card><input id="i"/></card>', '<card><text id="t">{window.location}</text></card>', '<card><button id="b" onPress="missing">click</button></card>']) {
    assert.ok(compile(src).diagnostics.some((d) => d.severity === 'error'), src)
  }
})
test('state survives new spec revisions; actions commit atomically', () => {
  const spec = compile(FIXTURES.counter).spec, store = createStore()
  makeScope(spec, store); executeAction(spec, store, 'add'); executeAction(spec, store, 'noteChange', { event: { value: '保持输入' } })
  makeScope({ ...spec, revision: 100 }, store)
  assert.equal(store.values.count, 1); assert.equal(store.values.note, '保持输入')
  const invalid = { ...spec, actions: { fail: [{ type: 'set', target: 'count', value: parseExpression('2') }, { type: 'set', target: 'note', value: parseExpression('false') }] } }
  assert.throws(() => executeAction(invalid, store, 'fail'))
  assert.equal(store.values.count, 1)
})
test('calendar has correct 4/5/6 weeks and leap day; two-step month action uses draft', () => {
  for (const [month, count] of [['2027-02',28],['2026-10',35],['2026-08',42],['2028-02',35]]) assert.equal(monthCells(month).length, count)
  assert.ok(monthCells('2028-02').includes('2028-02-29'))
  const spec = compile(calendar()).spec, store = createStore(); makeScope(spec, store)
  executeAction(spec, store, 'month', { event: { month: '2028-02', date: '2028-02-29' } })
  assert.equal(store.values.month, '2028-02'); assert.equal(store.values.date, '2028-02-29')
})
test('trusted date respects Shanghai midnight', () => {
  assert.equal(dateKey('2026-10-12T15:59:59Z', 'Asia/Shanghai'), '2026-10-12')
  assert.equal(dateKey('2026-10-12T16:00:00Z', 'Asia/Shanghai'), '2026-10-13')
})
test('list updates use stable item IDs; filters and counts use bound item', () => {
  const spec = compile(FIXTURES.travel).spec, store = createStore(); makeScope(spec, store)
  executeAction(spec, store, 'check', { args: { id: 'passport' }, event: { checked: true } })
  executeAction(spec, store, 'category', { event: { value: '行李' } })
  assert.equal(makeScope(spec, store).derived.visible[0].id, 'coat')
  executeAction(spec, store, 'category', { event: { value: '全部' } })
  assert.equal(store.values.checked.passport, true)
})
test('initial render checks expression types, collection identity and inactive branches', () => {
  const bad = compile('<card><data id="item" value={{"x":1}}/><if id="condition" test={data.item}><text id="t">content</text></if></card>')
  assert.ok(bad.diagnostics.some((d) => d.message.includes('expected boolean')))
  assert.equal(compile('<card><row id="r" wrap="true"><button id="b" disabled label="disabled"/></row></card>').complete, true)
  assert.equal(compile('<card><if id="i" test={false}><text id="t">{data.missing}</text></if></card>').complete, false)
  assert.equal(compile('<card><data id="optional" value={null}/><if id="i" test={data.optional!=null}><text id="t">{data.optional.title}</text></if></card>').complete, true)
  const mismatched = '<card><state id="budget" type="string" initial=""/><action id="edit"><set target="budget" value={event.value}/></action><input id="i" inputType="number" label="预算" value={state.budget} onChange="edit"/></card>'
  assert.ok(compile(mismatched).diagnostics.some((d) => d.message.includes('state type violation')))
  assert.equal(compile(mismatched.replace('value={event.value}', 'value={event.text}')).complete, true)
})
test('legacy DIL retains JS path without allocating a React component per revision', () => {
  const source = '{@body const [count,setCount]=DIL.useState(0); const sample = "}";}\n<text>{sample} {count}</text><button onClick={() => setCount(count+1)}>增加</button>'
  const parsed = parse(source), result = compileDil(parsed)
  assert.deepEqual(parsed.diagnostics, [])
  assert.ok(result.code.includes('DIL.render((()=>'))
  assert.ok(!result.code.includes('DIL.jsx(()=>'))
  assert.doesNotThrow(() => new Function('DIL', 'AsyncImage', result.code))
  const partial = compileDil(parse('<text>完整文字</te'))
  assert.ok(!JSON.stringify(partial.constants).includes('</te'))
})
