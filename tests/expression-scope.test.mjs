import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { compileCard } from '../shared/cardspec/compiler.mjs'
import { evaluate, parseExpression } from '../shared/cardspec/expression.mjs'
import { createStore, makeScope, executeAction } from '../shared/cardspec/store.mjs'
import { handleCardSpec } from '../server/cardspec/handler.mjs'

const selection = (predicate = 'item.id==entry.id') => `<card actionMode="snapshot">
<data id="rows" value={[]}/><state id="picks" type="array" initial={[]}/>
<each items={data.rows} as="entry" itemKey={entry.id}>
<pressable onPress="pick" args={{id:entry.id}} selected={count(state.picks,${predicate})>0}><text>{entry.id}</text></pressable>
</each>
<each items={state.picks} as="p" itemKey={p.id}><text>{p.id}</text></each>
<action id="pick"><append target="picks" when={count(state.picks,item.id==args.id)==0} value={{id:args.id}}/><remove target="picks" key={args.id} when={count(state.picks,item.id==args.id)>0}/></action>
</card>`
const compile = source => compileCard(source, { final: true })
const valid = source => { const result = compile(source); assert.equal(result.complete, true, JSON.stringify(result.diagnostics)); return result.spec }
const invalid = (source, name) => { const result = compile(source); assert.equal(result.complete, false); assert.ok(result.diagnostics.some(d => d.code === 'binding' && d.message.includes(`unknown binding ${name} in this scope`)), JSON.stringify(result.diagnostics)) }

test('sibling aliases are rejected even when both collections are initially empty', () => {
  invalid(selection('p.id==entry.id'), 'p')
  valid(selection())
})

test('each aliases belong to itemKey and descendants, not the iterable, siblings or declarations', () => {
  const loop = '<each items={[]} as="entry" itemKey={entry.id}><text>{entry.id}</text></each>'
  invalid(`<card>${loop}<text>{entry.id}</text></card>`, 'entry')
  invalid(`<card><each items={entry.rows} as="entry" itemKey={entry.id}/></card>`, 'entry')
  invalid(`<card>${loop}<derive id="leak" value={entry.id}/></card>`, 'entry')
  invalid(`<card>${loop}<state id="s" type="string" initial=""/><action id="leak"><set target="s" value={entry.id}/></action></card>`, 'entry')
})

test('nested aliases remain available to descendants without leaking to siblings', () => {
  valid('<card><each items={[]} as="group" itemKey={group.id}><each items={group.rows} as="entry" itemKey={entry.id}><text>{group.id + entry.id + index}</text></each><text>{group.id}</text></each></card>')
  invalid('<card><each items={[]} as="group" itemKey={group.id}><each items={[]} as="entry" itemKey={entry.id}/><text>{entry.id}</text></each></card>', 'entry')
})

test('collection predicates introduce item/index only within their predicate', () => {
  for (const fn of ['filter', 'find', 'map', 'sum', 'count']) valid(`<card><data id="x" value={${fn}([],item.id==index)}/><text>OK</text></card>`)
  invalid('<card><text>{count(item.rows,item.id>0)}</text></card>', 'item')
  invalid('<card><text>{count([],item.id>0) + item.id}</text></card>', 'item')
  invalid('<card><if test={false}><text>{index}</text></if></card>', 'index')
  valid('<card><text>{count([],count(item.children,item.id!=null)>0)}</text></card>')
})

test('dynamic or reserved each aliases cannot corrupt the runtime scope', () => {
  for (const alias of ['state', 'data', 'index', 'args', 'bindings']) assert.equal(compile(`<card><each items={[]} as="${alias}" itemKey={item.id}/></card>`).complete, false)
  assert.equal(compile('<card><each items={[]} as={context.alias} itemKey={item.id}/></card>').complete, false)
})

test('selection works for films, products and courses across add/remove transitions', () => {
  for (const prefix of ['movie', 'product', 'course']) {
    const spec = valid(selection()), store = createStore()
    makeScope(spec, store)
    const selected = id => evaluate(parseExpression('count(state.picks,item.id==entry.id)>0'), { ...makeScope(spec, store), entry: { id } })
    const a = prefix+'-a', b = prefix+'-b'
    executeAction(spec, store, 'pick', { args: { id: a } })
    assert.equal(selected(a), true); assert.equal(selected(b), false)
    executeAction(spec, store, 'pick', { args: { id: b } })
    assert.equal(selected(a), true); assert.equal(selected(b), true)
    executeAction(spec, store, 'pick', { args: { id: a } })
    assert.equal(selected(a), false); assert.equal(selected(b), true)
  }
})

test('scope errors reach the existing one-repair pipeline before publication', async () => {
  const res = new EventEmitter(), frames = []
  res.writeHead = () => {}; res.flushHeaders = () => {}
  res.write = data => { const body = data.slice(6).trim(); if (body !== '[DONE]') frames.push(JSON.parse(body)) }
  res.end = () => { res.writableEnded = true }
  let calls = 0
  await handleCardSpec({}, res, { mode: 'direct', messages: [{ role: 'user', content: 'Select candidates' }] }, {
    keyLoaded: true, model: 'fixture', photo: async () => null,
    streamUpstream: async (messages, { onPiece }) => {
      if (++calls === 1) onPiece({ content: selection('p.id==entry.id') })
      else { assert.match(messages.at(-1).content, /unknown binding p in this scope/); onPiece({ content: selection() }) }
    },
  })
  assert.equal(calls, 2)
  assert.equal(frames.find(f => f.type === 'message_stream_complete').status, 'succeeded')
  const specs = frames.flatMap(f => f.o === 'patch' ? f.v : []).filter(op => op.v?.card_spec)
  assert.equal(specs.length, 1)
})
