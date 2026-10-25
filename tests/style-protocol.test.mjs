import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { compileCard } from '../shared/cardspec/compiler.mjs'
import { collectImages, photoKey } from '../shared/cardspec/images.mjs'
import { VISUAL_STYLE_IDS } from '../shared/cardspec/styles.mjs'
import { planningConversation, validatePlanVisualStyle } from '../server/cardspec/planning.mjs'
import { createPexelsService } from '../server/pexels.mjs'
import { handleCardSpec } from '../server/cardspec/handler.mjs'

const source = (attrs = '', children = '<title id="title">山间路线</title>') => `<card schemaVersion="1" theme="soft" palette="a" ${attrs}>${children}</card>`
const visual = 'visualStyle="liquid-glass" backgroundQuery="mountain lake"'
const compile = text => compileCard(text, { final: true })

test('all five style tokens compile as a fixed root contract; legacy cards stay unstyled', () => {
  for (const token of VISUAL_STYLE_IDS) {
    const result = compile(source(`visualStyle="${token}" backgroundQuery="  mountain lake  "`))
    assert.equal(result.complete, true, JSON.stringify(result.diagnostics))
    assert.deepEqual([result.spec.visualStyle, result.spec.backgroundQuery, result.spec.backgroundPosition], [token, 'mountain lake', 'center'])
  }
  const legacy = compile(source()).spec
  assert.equal(Object.hasOwn(legacy, 'visualStyle'), false)
  assert.equal(Object.hasOwn(legacy, 'backgroundQuery'), false)
  assert.deepEqual(collectImages(legacy), [])
  assert.equal(compile(source(`${visual} backgroundPosition="top"`)).spec.backgroundPosition, 'top')
})

test('reject incomplete, dynamic or arbitrary visual contracts before publication', () => {
  for (const attrs of [
    'visualStyle="custom-neon" backgroundQuery="mountain lake"',
    'visualStyle="liquid-glass"',
    'backgroundQuery="mountain lake"',
    `${visual} backgroundPosition="left"`,
    `${visual} backgroundPosition={context.localDate}`,
    'visualStyle={context.localDate} backgroundQuery="mountain lake"',
    'visualStyle="liquid-glass" backgroundQuery={context.localDate}',
    'visualStyle="liquid-glass" backgroundQuery="https://example.com/photo.jpg"',
    'visualStyle="liquid-glass" backgroundQuery="   "',
    `visualStyle="liquid-glass" backgroundQuery="${'x'.repeat(101)}"`,
    `${visual} style="backdrop-filter:blur(8px)"`,
  ]) {
    const result = compile(source(attrs))
    assert.equal(result.complete, false, attrs)
    assert.ok(result.diagnostics.some(d => d.severity === 'error'), attrs)
  }
})

test('background is the first bounded resource and does not alias a content image of the same query', () => {
  const result = compile(source(visual, `<image id="hero" query="mountain lake" mediaRole="hero" alt="山湖"/><image id="duplicate" query="MOUNTAIN LAKE" mediaRole="hero" alt="山湖"/>`))
  assert.equal(result.complete, true)
  assert.deepEqual(collectImages(result.spec), [
    { key: photoKey('mountain lake', 'background'), query: 'mountain lake', role: 'background' },
    { key: photoKey('mountain lake', 'hero'), query: 'MOUNTAIN LAKE', role: 'hero' },
  ])
})

test('planning validates supplied visual fields and preserves selected style across conversational edits', () => {
  assert.doesNotThrow(() => validatePlanVisualStyle({ theme: { language: 'soft', palette: 'a' }, regions: [] }))
  assert.doesNotThrow(() => validatePlanVisualStyle({ visualStyle: 'photo-glass', backgroundQuery: 'quiet lake' }))
  for (const plan of [
    { visualStyle: 'invented', backgroundQuery: 'lake' },
    { visualStyle: 'photo-glass' },
    { backgroundQuery: 'lake' },
    { visualStyle: 'photo-glass', backgroundQuery: 'lake', backgroundPosition: 'left' },
  ]) assert.throws(() => validatePlanVisualStyle(plan))
  const [prior] = planningConversation([{ role: 'assistant', content: source(visual) }], {})
  assert.equal(prior.summary.visualStyle, 'liquid-glass')
  assert.equal(prior.summary.backgroundQuery, 'mountain lake')
  assert.ok(!JSON.stringify(prior.summary).includes('<card'))
})

test('Pexels background uses higher-resolution source, shares inflight work, and preserves attribution in cache', async () => {
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'cardspec-style-')), requests = []
  try {
    const fetchImpl = async url => {
      requests.push(String(url))
      return String(url).startsWith('https://api.pexels.com/') ? Response.json({ photos: [{
        width: 1600, height: 1000, alt: 'Lake', photographer: 'Fixture Author', photographer_url: 'https://www.pexels.com/@fixture/', url: 'https://www.pexels.com/photo/fixture-1/',
        src: { large2x: 'https://images.pexels.com/photos/1/background.jpeg', landscape: 'https://images.pexels.com/photos/1/hero.jpeg' },
      }] }) : new Response(new Uint8Array([255, 216, 255, 217]), { headers: { 'content-type': 'image/jpeg' } })
    }
    const service = createPexelsService({ key: 'test-only', cacheDir, fetchImpl })
    const [one, two] = await Promise.all([service.photo('lake', undefined, 'background'), service.photo('lake', undefined, 'background')])
    assert.equal(one.content, two.content)
    assert.equal(requests.length, 2)
    assert.ok(requests[1].endsWith('/background.jpeg'))
    assert.equal(one.photographer, 'Fixture Author')
    assert.equal(one.provider, 'Pexels')
    assert.ok(!JSON.stringify(one).includes('test-only'))
    const cached = createPexelsService({ key: 'test-only', cacheDir, fetchImpl: () => assert.fail('cache should serve background') })
    assert.deepEqual(await cached.photo('lake', undefined, 'background'), one)
    assert.equal((await cached.media(path.basename(one.content))).bytes.length, 4)
    const hero = await service.photo('lake', undefined, 'hero')
    assert.notEqual(hero.content, one.content)
  } finally { await rm(cacheDir, { recursive: true, force: true }) }
})

for (const scenario of [{ mode: 'direct', loaded: true }, { mode: 'staged', loaded: true }, { mode: 'direct', loaded: false }]) test(`styled ${scenario.mode} generation keeps its contract with background ${scenario.loaded ? 'loaded' : 'unavailable'}`, async () => {
  const res = new EventEmitter(), frames = [], photos = [], calls = []
  res.writeHead = () => {}; res.flushHeaders = () => {}
  res.write = s => { const data = s.slice(6).trim(); if (data !== '[DONE]') frames.push(JSON.parse(data)) }
  res.end = () => { res.writableEnded = true }
  const plan = { theme: { language: 'soft', palette: 'a' }, visualStyle: 'liquid-glass', backgroundQuery: 'mountain lake', backgroundPosition: 'center', regions: [], navigation: [] }
  await handleCardSpec({}, res, { mode: scenario.mode, messages: [{ role: 'user', content: '做山间路线卡片' }] }, {
    keyLoaded: true, model: 'fixture',
    streamUpstream: async (messages, options) => {
      calls.push(messages)
      const content = options.responseFormat ? JSON.stringify(messages[0].content.includes('"regions"') ? plan : { goal: '山间路线', interactions: [] }) : source(visual)
      options.onPiece({ content })
    },
    photo: async (query, _signal, role) => { photos.push({ query, role }); return scenario.loaded ? { content: '/api/media/fixture.jpg', provider: 'Pexels', photographer: 'Fixture' } : null },
  })
  assert.equal(calls.length, scenario.mode === 'staged' ? 3 : 1)
  if (scenario.mode === 'staged') assert.ok(calls.at(-1).at(-1).content.includes(JSON.stringify(plan)))
  assert.deepEqual(photos, [{ query: 'mountain lake', role: 'background' }])
  assert.equal(frames.find(frame => frame.type === 'message_stream_complete').status, 'succeeded')
  const metadata = frames.flatMap(frame => frame.o === 'patch' ? frame.v : []).filter(op => op.p === '/message/metadata')
  const spec = metadata.filter(op => op.v.card_spec).at(-1).v.card_spec
  assert.deepEqual([spec.visualStyle, spec.backgroundQuery, spec.backgroundPosition], ['liquid-glass', 'mountain lake', 'center'])
  const resources = metadata.filter(op => op.v.resources).at(-1).v.resources
  assert.equal(resources[photoKey('mountain lake', 'background')].status, scenario.loaded ? 'loaded' : 'error')
})
