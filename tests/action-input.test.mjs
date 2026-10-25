import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { compileCard } from '../shared/cardspec/compiler.mjs'
import { parseExpression } from '../shared/cardspec/expression.mjs'
import { createStore, makeScope, executeAction } from '../shared/cardspec/store.mjs'
import { handleCardSpec } from '../server/cardspec/handler.mjs'

const selection = (type, value = 'event.id') => `<card><state id="selection" type="string" initial=""/><action id="choose"><set target="selection" value={${value}}/></action><${type} id="choice" label="Select" onPress="choose" args={{"id":"second"}}/></card>`

test('all press controls diagnose missing event input and identify supplied args', () => {
  for (const type of ['button', 'chip', 'pressable']) {
    const broken = compileCard(selection(type), { final: true })
    assert.equal(broken.complete, false)
    const message = broken.diagnostics.find(d => d.code === 'binding').message
    for (const fragment of ['choice.onPress', 'action choose', 'expected string, received null', 'event.id is missing', 'available event fields: none', 'use args.id']) assert.ok(message.includes(fragment), message)
    const fixed = compileCard(selection(type, 'args.id'), { final: true })
    assert.equal(fixed.complete, true, JSON.stringify(fixed.diagnostics))
    const store = createStore(); makeScope(fixed.spec, store)
    executeAction(fixed.spec, store, 'choose', { args: { id: 'second' }, event: {} })
    assert.equal(store.values.selection, 'second')
  }
})

test('optional fallbacks and legitimate event IDs keep their semantics', () => {
  for (const value of ['event.id ?? args.id', 'true ? args.id : event.id']) assert.equal(compileCard(selection('pressable', value), { final: true }).complete, true)
  const source = '<card><state id="selected" type="string" initial=""/><action id="pick"><set target="selected" value={event.id}/></action><chart id="chart" label="Sample" kind="bar" data={[{"id":"one","label":"One","value":1}]} onSelect="pick"/></card>'
  assert.equal(compileCard(source, { final: true }).complete, true)
})

test('missing input diagnostics are per step and preserve atomic rollback', () => {
  const spec = compileCard(selection('button', 'args.id'), { final: true }).spec
  spec.actions.choose = [
    { type: 'set', target: 'selection', value: parseExpression('event.optional ?? "updated"') },
    { type: 'set', target: 'selection', value: parseExpression('args.missing') },
  ]
  const store = createStore(); makeScope(spec, store)
  assert.throws(() => executeAction(spec, store, 'choose', { event: { value: 1 }, args: {} }), error => {
    assert.match(error.message, /args.missing is missing/)
    assert.doesNotMatch(error.message, /event.optional|use event.missing/)
    return true
  })
  assert.equal(store.values.selection, '')
})

test('automatic repair receives actionable input diagnosis and publishes fixed spec', async () => {
  const res = new EventEmitter(), frames = []
  res.writeHead = () => {}; res.flushHeaders = () => {}
  res.write = data => { const body = data.slice(6).trim(); if (body !== '[DONE]') frames.push(JSON.parse(body)) }
  res.end = () => { res.writableEnded = true }
  let calls = 0
  await handleCardSpec({}, res, { mode: 'direct', messages: [{ role: 'user', content: 'Selectable list' }] }, {
    keyLoaded: true, model: 'fixture', photo: async () => null,
    streamUpstream: async (messages, { onPiece }) => {
      if (++calls === 1) onPiece({ content: selection('pressable') })
      else {
        assert.match(messages.at(-1).content, /event.id is missing.*use args.id/)
        onPiece({ content: selection('pressable', 'args.id') })
      }
    },
  })
  assert.equal(calls, 2)
  assert.equal(frames.find(f => f.type === 'message_stream_complete').status, 'succeeded')
  const specs = frames.flatMap(f => f.o === 'patch' ? f.v : []).filter(op => op.v?.card_spec).map(op => op.v.card_spec)
  assert.equal(specs.length, 1)
  const store = createStore(); makeScope(specs[0], store)
  executeAction(specs[0], store, 'choose', { args: { id: 'working' } })
  assert.equal(store.values.selection, 'working')
})
