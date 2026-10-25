import {generationModelOptions} from '../shared/cardspec/generation-settings.mjs'
import {createDatasetAnalyzer} from './cardspec/model-analysis.mjs'
import {createGenerationTools} from './cardspec/generation-tools.mjs'
import {sandboxEnabled} from './cardspec/sandbox.mjs'
// generative card engine — server
//
// Three-phase pipeline (mode "staged"), mirroring a plan-then-render generative UI flow:
//   phase 1 analysis : model reasons + emits an information-planning markdown doc
//   phase 2 plan     : model diverges on an interaction plan markdown (design-first spec)
//   phase 3 dsl      : model emits the DIL card source; server compiles it incrementally
// Every phase streams its reasoning_content (the "analysis channel") into
// /message/reasoning and its visible content into /message/content/parts/0.
// mode "direct" skips phases 1-2 (single-shot DSL, previous behaviour).
//
// All frames use the observed delta_encoding v1 shapes (root add / patch batch / {v:…}
// shorthand guarded by a mirror of the client's last-atomic-op state).

import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

import { loadApiKey, loadPexelsKey } from './env.mjs'
import { legacyPrompts } from './prompt.mjs'
import { parse, stripCodeFences, splitCardText } from './compiler/parse.mjs'
import { compile } from './compiler/codegen.mjs'
import { validateDil } from './compiler/validate.mjs'
import { handleCardSpec } from './cardspec/handler.mjs'
import { dateKey } from '../shared/cardspec/expression.mjs'
import { createPexelsService } from './pexels.mjs'
import { createToolService,localToolRequest } from './tools/service.mjs'
import { createModelClient } from './research/model-client.mjs'
import { createResearchProviders } from './research/providers.mjs'
import { createResearchSession } from './research/session.mjs'
import { createOpenCli } from './tools/opencli.mjs'
import { createToolMediaService } from './tools/media.mjs'
import {toolAssets} from './tools/assets.mjs'
import {createWorkbenchStore} from './workbench.mjs'
import {recordAdaptiveGeneration} from './rsi-records.mjs'
const workbenchStore=createWorkbenchStore()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 8787)
const MODEL_BASE = process.env.MODEL_BASE_URL || 'https://model-gateway.example.invalid/v1'
const MODEL_NAME = process.env.MODEL_NAME || 'glm-5.3-flash'
const FLUSH_INTERVAL_MS = 90

const PHASES = {
  // The gateway's default effort streams reasoning_content but burns a much larger
  // INTERNAL token budget (often >10k) that counts against max_tokens — so markdown
  // phases get a big budget to keep their content alive, and the card phase pins
  // effort=low (short internal reasoning, reliable full-card output, no reasoning stream).
  analysis: { title: '阶段 1 · 信息规划', kind: 'markdown', maxTokens: 8192, temperature: 0.4 },
  plan: { title: '阶段 2 · 交互方案', kind: 'markdown', maxTokens: 8192, temperature: 0.9 },
  dsl: { title: '阶段 3 · 卡片成型', kind: 'dil', maxTokens: 8192, temperature: 0.7, reasoningEffort: 'low' }
}

const keyInfo = loadApiKey()
if (keyInfo.ok) {
  console.log(`[server] api key loaded (source: ${keyInfo.source}, length: ${keyInfo.value.length}) — value never logged`)
} else {
  console.warn(`[server] API KEY NOT AVAILABLE: ${keyInfo.reason} — /api/chat will refuse requests`)
}

const pexelsInfo = loadPexelsKey()
if (pexelsInfo.ok) {
  console.log(`[server] pexels key loaded (source: ${pexelsInfo.source}) — value never logged`)
} else {
  console.log(`[server] pexels disabled (${pexelsInfo.reason}) — falling back to local placeholder images`)
}

const photoService = createPexelsService({ key: pexelsInfo.value, cacheDir: path.join(__dirname, '..', '.cache', 'pexels') })
const pexelsPhoto = photoService.photo
const modelRound=createModelClient({base:MODEL_BASE,key:keyInfo.value,model:MODEL_NAME})
const researchProviders=createResearchProviders({base:MODEL_BASE,key:keyInfo.value,model:MODEL_NAME})
const researchSession=(onEvent,options={})=>createResearchSession({providers:process.env.RESEARCH_DISABLED==='1'||options.enabled===false?null:researchProviders,onEvent,maxRounds:options.budget?5:3,maxCalls:options.budget?.policy.reads||10,maxContextChars:18000,timeoutMs:options.budget?.remaining()||options.timeoutMs||240000,budget:options.budget,extensions:createGenerationTools({...options,
 analyze:createDatasetAnalyzer((messages,params)=>modelRound(messages,{...params,...generationModelOptions(options.modelProfile)}),options.budget),invoke:options.invoke||((...args)=>toolService.invoke(...args))})})
const toolService=createToolService({streamUpstream,researchSession,keyLoaded:keyInfo.ok,photo:pexelsPhoto,recordGeneration:recordAdaptiveGeneration,opencli:createOpenCli({restoreHandoff:PORT===8787})})
const toolMedia=createToolMediaService()
process.once('exit',()=>toolService.close())
for(const event of ['SIGINT','SIGTERM'])process.once(event,()=>{toolService.close();process.exit(0)})

// ---------------------------------------------------------------- design languages

// The visual system lives in the host renderer (6 languages x 3 palettes).
// The model only picks names; the server validates and forwards the choice.
const THEMES = {
  editorial: { label: '编辑杂志', palettes: { a: '宣纸朱砂', b: '冷刊钴蓝', c: '暖沙墨绿' } },
  soft: { label: '柔和氛围', palettes: { a: '奶油蜜桃', b: '薄荷奶白', c: '云朵丁香' } },
  precision: { label: '精密数据', palettes: { a: '石墨电光蓝', b: '冷白祖母绿', c: '炭黑琥珀' } },
  playful: { label: '玩趣块状', palettes: { a: '柠檬黄墨线', b: '糖果粉天蓝', c: '草地绿橙' } },
  dark: { label: '暗夜沉浸', palettes: { a: '午夜霓虹青', b: '炭紫品红', c: '墨绿酸黄' } },
  minimal: { label: '无感极简', palettes: { a: '纯白雾蓝', b: '暖纸赭石', c: '石墨冰蓝' } },
}
const LANG_ALIAS = {
  editorial: 'editorial', 编辑杂志: 'editorial',
  soft: 'soft', 柔和氛围: 'soft',
  precision: 'precision', 精密数据: 'precision',
  playful: 'playful', 玩趣块状: 'playful',
  dark: 'dark', 暗夜沉浸: 'dark',
  minimal: 'minimal', 无感极简: 'minimal',
}
const PALETTE_ALIAS = {
  a: 'a', b: 'b', c: 'c',
  宣纸朱砂: 'a', 冷刊钴蓝: 'b', 暖沙墨绿: 'c',
  奶油蜜桃: 'a', 薄荷奶白: 'b', 云朵丁香: 'c',
  石墨电光蓝: 'a', 冷白祖母绿: 'b', 炭黑琥珀: 'c',
  柠檬黄墨线: 'a', 糖果粉天蓝: 'b', 草地绿橙: 'c',
  午夜霓虹青: 'a', 炭紫品红: 'b', 墨绿酸黄: 'c',
  纯白雾蓝: 'a', 暖纸赭石: 'b', 石墨冰蓝: 'c',
}
const THEME_IDS = Object.keys(THEMES)

function pickTheme(planMd, seedText) {
  let theme = null
  let palette = null
  const m = /视觉语言[:：]\s*([^\s/、·]+)\s*[/、·]\s*([^\s,，。;；)]*)/.exec(planMd ?? '')
  if (m) {
    theme = LANG_ALIAS[m[1].toLowerCase()] ?? LANG_ALIAS[m[1]] ?? null
    palette = PALETTE_ALIAS[m[2]] ?? PALETTE_ALIAS[m[2]?.trim()] ?? null
  }
  if (!theme) {
    // no explicit pick (or direct mode) -> deterministic pick from the prompt
    const ids = [...THEME_IDS]
    theme = ids[hashSeed(seedText ?? '') % ids.length]
  }
  if (!palette || !(palette in THEMES[theme].palettes)) palette = 'a'
  const label = `${THEMES[theme].label} · ${THEMES[theme].palettes[palette]}`
  return { theme, palette, label }
}

// ---------------------------------------------------------------- utilities

function corsHeaders(req) {
  return {
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }
}

function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(Object.assign(new Error('body too large'), { statusCode: 413 }))
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function hashSeed(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const PLACEHOLDER_EMOJI = ['🌿', '🐛', '💧', '🔆', '⭐', '📖', '🌱', '🦋', '🌸', '🔭']

// Theme-neutral placeholder: warm paper + dot grid + emoji. Reads as a
// "photo placeholder" under every design language, light or dark.
function placeholderSvg(seed, w, h, label) {
  const hash = hashSeed(seed)
  const emoji = PLACEHOLDER_EMOJI[hash % PLACEHOLDER_EMOJI.length]
  const dot = Math.max(6, Math.round(Math.min(w, h) / 14))
  const step = dot * 2.6
  const cx = ((hash >> 4) % 100) / 100
  const cy = ((hash >> 8) % 100) / 100
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <pattern id="d" width="${step}" height="${step}" patternUnits="userSpaceOnUse">
      <circle cx="${dot / 2}" cy="${dot / 2}" r="${Math.max(0.8, dot * 0.08)}" fill="#b9b3a4"/>
    </pattern>
  </defs>
  <rect width="${w}" height="${h}" fill="#efece3"/>
  <rect width="${w}" height="${h}" fill="url(#d)" opacity="0.5"/>
  <circle cx="${cx * w}" cy="${cy * h}" r="${Math.min(w, h) * 0.3}" fill="#ffffff" opacity="0.35"/>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" fill="none" stroke="#a9a294" stroke-width="1"/>
  <text x="50%" y="46%" font-size="${Math.min(w, h) * 0.26}" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  ${label ? `<text x="50%" y="80%" font-family="system-ui, sans-serif" font-size="${Math.min(w, h) * 0.055}" fill="#8a867c" text-anchor="middle">${esc(label.slice(0, 42))}</text>` : ''}
</svg>`
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
  '.woff2': 'font/woff2'
}

// ---------------------------------------------------------------- upstream

// Shared upstream caller: parses the gateway SSE (reasoning_content first, then content),
// invokes onPiece({reasoning}|{content}) live, returns the full visible content.
async function streamUpstream(messages, options) {
  if(options.research)return options.research.run(modelRound,messages,options)
  options.budget?.model(options.stage||'generate')
  return (await modelRound(messages,options)).message.content
}

// ---------------------------------------------------------------- chat handler

function aspectToSize(ratio, base = 1024) {
  const m = /^(\d+(?:\.\d+)?)[:/](\d+(?:\.\d+)?)$/.exec(String(ratio || '16:9'))
  if (!m) return { width: base, height: Math.round((base * 9) / 16) }
  const a = Number(m[1])
  const b = Number(m[2])
  const scale = base / Math.max(a, b)
  return { width: Math.round(a * scale), height: Math.round(b * scale) }
}

async function handleChat(req, res) {
  const body = await readBody(req)
  let payload
  try {
    payload = JSON.parse(body)
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders(req) })
    res.end(JSON.stringify({ error: 'invalid json' }))
    return
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
    !Array.isArray(payload.messages) || !payload.messages.length || payload.messages.length > 100 ||
    payload.messages.some((m) => !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 100000) ||
    !payload.messages.some((m) => m.role === 'user' && m.content.trim()) ||
    (payload.mode !== undefined && !['direct', 'staged', 'experience'].includes(payload.mode)) ||
    (payload.format !== undefined && !['dil', 'cardspec'].includes(payload.format)) ||
    (payload.turnId !== undefined && (typeof payload.turnId !== 'string' || payload.turnId.length > 100))) {
    res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders(req) })
    res.end(JSON.stringify({ error: 'invalid chat request: messages, mode or format' }))
    return
  }
  if ((payload.format ?? 'cardspec') === 'cardspec') {
    // The chat route also serves nonlocal clients; generation-time CLI must
    // enforce the same origin/host/loopback boundary as /api/tools/invoke.
    const scopedPayload=localToolRequest(req,PORT)?payload:{...payload,toolsEnabled:false}
    return handleCardSpec(req, res, scopedPayload, { streamUpstream, photo: pexelsPhoto, model: MODEL_NAME, keyLoaded: keyInfo.ok,toolCatalog:toolService.catalog,researchSession,recordGeneration:recordAdaptiveGeneration })
  }
  const {ANALYSIS_PROMPT,PLAN_PROMPT,DSL_PROMPT}=legacyPrompts(payload.cardSize)
  const history = payload.messages
  const mode = payload.mode === 'staged' ? 'staged' : 'direct'

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    ...corsHeaders(req)
  })
  if (res.flushHeaders) res.flushHeaders()

  const send = (obj) => {
    if (res.writableEnded) return
    res.write(`data: ${typeof obj === 'string' ? obj : JSON.stringify(obj)}\n\n`)
  }

  // Mirror of the client applier's "last atomic op" state, so shorthand frames
  // ({v:…} = repeat last op) are only emitted when that op is really the parts append.
  const PARTS_APPEND = { p: '/message/content/parts/0', o: 'append' }
  const REASONING_APPEND = { p: '/message/reasoning', o: 'append' }
  let lastEmitted = { p: '', o: 'add' }
  const emitDelta = (frame) => {
    send(frame)
    if (frame.p !== undefined) lastEmitted = { p: frame.p, o: frame.o ?? 'add' }
    const ops = Array.isArray(frame.v) ? frame.v : null
    if (ops) {
      for (const op of ops) {
        if (op && op.p !== undefined) lastEmitted = { p: op.p, o: op.o ?? lastEmitted.o }
      }
    }
  }

  if (!keyInfo.ok) {
    send({ type: 'stream_error', error: { message: `server has no api key: ${keyInfo.reason}` } })
    send('[DONE]')
    res.end()
    return
  }

  const conversationId = randomUUID()
  const requestStart = Date.now()
  let firstVisibleAt = null
  const trustedContext = { generatedAt: new Date().toISOString(), timeZone: 'Asia/Shanghai' }
  trustedContext.localDate = dateKey(trustedContext.generatedAt, trustedContext.timeZone)

  send({ type: 'delta_encoding', value: 'v1' })

  const lastUser = [...history].reverse().find((m) => m && m.role === 'user')
  if (lastUser) {
    send({
      type: 'input_message',
      input_message: {
        id: randomUUID(),
        author: { role: 'user', name: null, metadata: {} },
        create_time: Date.now() / 1000,
        content: { content_type: 'text', parts: [lastUser.content ?? ''] },
        status: 'finished_successfully',
        weight: 1.0,
        metadata: {}
      },
      conversation_id: conversationId
    })
  }

  const controller = new AbortController()
  res.once('close', () => { if (!res.writableEnded) controller.abort() })

  const makeSkeleton = (id, phaseKey, title, kind) => ({
    id,
    author: { role: 'assistant', name: null, metadata: {} },
    create_time: Date.now() / 1000,
    content: { content_type: 'text', parts: [''] },
    status: 'in_progress',
    end_turn: null,
    weight: 1.0,
    reasoning: '',
    metadata: { phase: phaseKey, phase_title: title, kind },
    recipient: 'all',
    channel: 'final'
  })

  const beginPhase = (phaseKey) => {
    const cfg = PHASES[phaseKey]
    const id = randomUUID()
    send({
      type: 'phase_begin',
      id,
      phase: phaseKey,
      title: cfg.title,
      kind: cfg.kind,
      conversation_id: conversationId
    })
    return { id, ...cfg }
  }

  const finishPhase = (phaseKey, id) => {
    emitDelta({
      o: 'patch',
      v: [
        { p: '/message/status', o: 'replace', v: 'finished_successfully' },
        { p: '/message/end_turn', o: 'replace', v: true },
        { p: '/message/metadata', o: 'append', v: { is_complete: true, finish_details: { type: 'stop' } } }
      ]
    })
    send({ type: 'phase_end', id, phase: phaseKey, status: 'succeeded', conversation_id: conversationId })
  }

  // streaming appender shared by markdown phases (reasoning + parts only)
  const makeCoalescer = () => {
    let pendingReasoning = ''
    let pendingContent = ''
    let lastFlushAt = 0
    const push = (piece) => {
      if (piece.content && firstVisibleAt === null) firstVisibleAt = Date.now()
      if (piece.reasoning) pendingReasoning += piece.reasoning
      if (piece.content) pendingContent += piece.content
      const now = Date.now()
      if (now - lastFlushAt >= FLUSH_INTERVAL_MS) {
        lastFlushAt = now
        flush()
      }
    }
    const flush = () => {
      const ops = []
      if (pendingReasoning) {
        ops.push({ p: REASONING_APPEND.p, o: 'append', v: pendingReasoning })
        pendingReasoning = ''
      }
      if (pendingContent) {
        ops.push({ p: PARTS_APPEND.p, o: 'append', v: pendingContent })
        pendingContent = ''
      }
      if (!ops.length) return
      if (
        ops.length === 1 &&
        ops[0].p === PARTS_APPEND.p &&
        lastEmitted.p === PARTS_APPEND.p &&
        lastEmitted.o === 'append'
      ) {
        emitDelta({ v: ops[0].v })
        return
      }
      emitDelta({ o: 'patch', v: ops })
    }
    return { push, flush }
  }

  try {
    let analysisMd = ''
    let planMd = ''
    let themePick = null

    // ---------- phase 1: analysis ----------
    if (mode === 'staged') {
      const ph = beginPhase('analysis')
      emitDelta({ p: '', o: 'add', v: { message: makeSkeleton(ph.id, 'analysis', ph.title, 'markdown'), conversation_id: conversationId, error: null }, c: 0 })
      const co = makeCoalescer()
      analysisMd = await streamUpstream(
        [{ role: 'system', content: ANALYSIS_PROMPT }, ...history],
        { temperature: ph.temperature, maxTokens: ph.maxTokens, signal: controller.signal, onPiece: co.push }
      )
      co.flush()
      finishPhase('analysis', ph.id)
      send({
        type: 'message_marker',
        conversation_id: conversationId,
        message_id: ph.id,
        marker: 'last_token',
        event: 'last'
      })
    }

    // ---------- phase 2: plan ----------
    if (mode === 'staged') {
      const ph = beginPhase('plan')
      emitDelta({ p: '', o: 'add', v: { message: makeSkeleton(ph.id, 'plan', ph.title, 'markdown'), conversation_id: conversationId, error: null }, c: 0 })
      const co = makeCoalescer()
      const planMessages = [
        { role: 'system', content: PLAN_PROMPT },
        ...history,
        {
          role: 'user',
          content: `【信息规划文档】\n${analysisMd}\n\n请结合原始需求与以上规划,输出交互方案。`
        }
      ]
      planMd = await streamUpstream(planMessages, {
        temperature: ph.temperature,
        maxTokens: ph.maxTokens,
        signal: controller.signal,
        onPiece: co.push
      })
      co.flush()
      finishPhase('plan', ph.id)
      send({
        type: 'message_marker',
        conversation_id: conversationId,
        message_id: ph.id,
        marker: 'last_token',
        event: 'last'
      })
    }

    // ---------- theme selection (from the plan; deterministic fallback) ----------
    themePick = pickTheme(planMd, lastUser?.content ?? '')
    send({
      type: 'theme',
      theme: themePick.theme,
      palette: themePick.palette,
      label: themePick.label,
      conversation_id: conversationId
    })

    // ---------- phase 3: DSL card ----------
    {
      const ph = beginPhase('dsl')
      const DIL_ROOT = '/message/metadata/model_dil_v2'

      // compiler session state
      const resolutions = new Map()
      const resolveImage = (key, statics) => {
        let r = resolutions.get(key)
        if (!r) {
          r = { uuid: randomUUID(), attrs: statics, safeUrls: null, done: false }
          resolutions.set(key, r)
        }
        return r.uuid
      }
      let fullRaw = ''
      let skeletonSent = false
      let lastPartsLen = 0
      let lastSnapshot = null
      let genuiList = []
      const announced = new Set()
      let firstTokenAt = 0

      const imageUrlFor = (r, kind) => {
        const { width, height } = aspectToSize(r.attrs.aspectRatio, kind === 'full' ? 1024 : 512)
        const seed = encodeURIComponent(String(hashSeed(String(r.attrs.query ?? 'img'))))
        const label = encodeURIComponent(String(r.attrs.query ?? '').slice(0, 40))
        return `/api/image?seed=${seed}&w=${width}&h=${height}&label=${label}`
      }

      const scheduleResolution = (r) => {
        if (r.done || r.scheduled) return
        r.scheduled = true
        const delay = 700 + Math.floor(Math.random() * 1100)
        r.promise = new Promise((resolve) => {
          setTimeout(async () => {
            try {
              if (res.writableEnded || res.destroyed || controller.signal.aborted) return
              // real photo via Pexels when available; local placeholder otherwise
              const photo = await pexelsPhoto(r.attrs.query, controller.signal)
              let contentUrl
              let thumbUrl
              let width
              let height
              let title = String(r.attrs.query ?? '').slice(0, 60)
              if (photo) {
                contentUrl = photo.content
                thumbUrl = photo.thumb
                width = photo.width
                height = photo.height
                title = photo.title
              } else {
                contentUrl = imageUrlFor(r, 'full')
                thumbUrl = imageUrlFor(r, 'inline')
                ;({ width, height } = aspectToSize(r.attrs.aspectRatio, 1024))
              }
              for (const u of [contentUrl, thumbUrl]) {
                send({
                  type: 'url_moderation',
                  url_moderation_result: { full_url: u, is_safe: true, is_blocked: false },
                  conversation_id: conversationId,
                  message_id: ph.id
                })
              }
              const img = {
                ...(photo ? { photographer:photo.photographer, photoUrl:photo.photoUrl, provider:photo.provider } : {}),
                url: contentUrl,
                content_url: contentUrl,
                thumbnail_url: thumbUrl,
                title,
                show_url: false,
                content_size: { width, height },
                thumbnail_size: { width: Math.round(width / 2), height: Math.round(height / 2) },
                thumbnail_crop_info: { center_x_percent: 50, center_y_percent: 50 }
              }
              r.safeUrls = [contentUrl, thumbUrl]
              r.done = true
              const entry = genuiList.find((g) => g.component_resolution_id === r.uuid)
              if (entry) entry.safe_urls = [{ url: contentUrl }, { url: thumbUrl }]
              emitDelta({
                o: 'patch',
                v: [
                  { p: `${DIL_ROOT}/appData/opGenui/componentResults/${r.uuid}/state/is_loading`, o: 'replace', v: false },
                  { p: `${DIL_ROOT}/appData/opGenui/componentResults/${r.uuid}/state/images`, o: 'append', v: [img] },
                  { p: `${DIL_ROOT}/appData/opGenui/componentResults/${r.uuid}/safe_urls`, o: 'add', v: [contentUrl, thumbUrl] },
                  { p: '/message/metadata/genui_components', o: 'add', v: genuiList },
                  { p: '/message/metadata/safe_urls', o: 'add', v: [contentUrl, thumbUrl] }
                ]
              })
            } finally {
              resolve()
            }
          }, delay)
        })
      }

      let pendingReasoning = ''
      let lastFlushAt = 0

      const flush = () => {
        if (!fullRaw) {
          if (pendingReasoning) {
            emitDelta({ o: 'patch', v: [{ p: REASONING_APPEND.p, o: 'append', v: pendingReasoning }] })
            pendingReasoning = ''
          }
          return
        }
        const source = stripCodeFences(fullRaw)
        const { intro, markup, outro } = splitCardText(source)
        const parsed = parse(markup)
        const compiled = compile(parsed, { resolveImage })
        const pendingResults = {}
        const required = compiled.asyncImages.length ? ['AsyncImage'] : []
        for (const ai of compiled.asyncImages) {
          const key = JSON.stringify([ai.attrs.query ?? '', ai.attrs.aspectRatio ?? ''])
          const r = resolutions.get(key)
          if (r) {
            pendingResults[r.uuid] = {
              status: 'resolved',
              componentName: 'AsyncImage',
              state: {
                frame_aspect_ratio: r.attrs.aspectRatio ?? '16:9',
                is_loading: !r.done,
                images: [],
                presentation: { radius: 'xl', frame: true }
              }
            }
            if (!announced.has(r.uuid)) {
              announced.add(r.uuid)
              scheduleResolution(r)
            }
          }
        }
        genuiList = compiled.asyncImages.map((ai) => {
          const key = JSON.stringify([ai.attrs.query ?? '', ai.attrs.aspectRatio ?? ''])
          const r = resolutions.get(key)
          return {
            type: 'async_image',
            tree_range: [ai.startLine ?? 0, Math.max(ai.endLine ?? 0, ai.startLine ?? 0)],
            start_index: ai.startIndex,
            end_index: ai.endIndex,
            component_resolution_id: ai.resolutionId,
            genui_attributes: {
              ...(ai.attrs.aspectRatio ? { aspectRatio: ai.attrs.aspectRatio } : {}),
              ...(ai.attrs.width ? { width: ai.attrs.width } : {})
            },
            ...(r?.safeUrls ? { safe_urls: r.safeUrls.map((u) => ({ url: u })) } : {})
          }
        })

        if (!skeletonSent) {
          skeletonSent = true
          firstTokenAt = Date.now()
          send({
            type: 'message_marker',
            conversation_id: conversationId,
            message_id: ph.id,
            marker: 'user_visible_token',
            event: 'first'
          })
          send({
            type: 'message_marker',
            conversation_id: conversationId,
            message_id: ph.id,
            marker: 'final_channel_token',
            event: 'first'
          })
          const message = makeSkeleton(ph.id, 'dsl', ph.title, 'dil')
          message.content.parts = [fullRaw]
          message.metadata = {
            phase: 'dsl',
            phase_title: ph.title,
            kind: 'dil',
            model_slug: MODEL_NAME,
            safe_urls: [],
            card_intro: intro,
            card_outro: outro,
            model_dil_v2: {
              code: compiled.code,
              constants: compiled.constants,
              fallbackMarkdown: compiled.fallbackMarkdown,
              appData: { opGenui: { componentResults: pendingResults, modelDataBindings: trustedContext } },
              requiredComponents: required,
              ...(parsed.diagnostics.length ? { recoveryDiagnostics: parsed.diagnostics } : {})
            },
            ...(genuiList.length ? { genui_components: genuiList } : {})
          }
          lastPartsLen = fullRaw.length
          lastSnapshot = {
            code: compiled.code,
            constants: compiled.constants,
            fallback: compiled.fallbackMarkdown,
            diagJson: JSON.stringify(parsed.diagnostics),
            requiredJson: JSON.stringify(required),
            genuiJson: JSON.stringify(genuiList),
            pendingJson: JSON.stringify(pendingResults),
            intro,
            outro
          }
          emitDelta({ p: '', o: 'add', v: { message, conversation_id: conversationId, error: null }, c: 0 })
          return
        }

        const ops = []
        if (pendingReasoning) {
          ops.push({ p: REASONING_APPEND.p, o: 'append', v: pendingReasoning })
          pendingReasoning = ''
        }
        const newChunk = fullRaw.slice(lastPartsLen)
        if (newChunk) {
          ops.push({ p: '/message/content/parts/0', o: 'append', v: newChunk })
          lastPartsLen = fullRaw.length
        }
        const changedConstants = {}
        for (const [k, v] of Object.entries(compiled.constants)) {
          if (lastSnapshot.constants[k] !== v) changedConstants[k] = v
        }
        if (Object.keys(changedConstants).length) {
          ops.push({ p: `${DIL_ROOT}/constants`, o: 'append', v: changedConstants })
        }
        if (
          compiled.fallbackMarkdown.startsWith(lastSnapshot.fallback) &&
          compiled.fallbackMarkdown !== lastSnapshot.fallback
        ) {
          ops.push({
            p: `${DIL_ROOT}/fallbackMarkdown`,
            o: 'append',
            v: compiled.fallbackMarkdown.slice(lastSnapshot.fallback.length)
          })
        } else if (compiled.fallbackMarkdown !== lastSnapshot.fallback) {
          ops.push({ p: `${DIL_ROOT}/fallbackMarkdown`, o: 'replace', v: compiled.fallbackMarkdown })
        }
        if (compiled.code !== lastSnapshot.code) {
          ops.push({ p: `${DIL_ROOT}/code`, o: 'replace', v: compiled.code })
        }
        if (intro !== lastSnapshot.intro) {
          ops.push({ p: '/message/metadata/card_intro', o: 'replace', v: intro })
        }
        if (outro !== lastSnapshot.outro) {
          ops.push({ p: '/message/metadata/card_outro', o: 'replace', v: outro })
        }
        const diagJson = JSON.stringify(parsed.diagnostics)
        if (diagJson !== lastSnapshot.diagJson) {
          if (parsed.diagnostics.length) {
            ops.push({ p: `${DIL_ROOT}/recoveryDiagnostics`, o: 'replace', v: parsed.diagnostics })
          } else {
            ops.push({ p: `${DIL_ROOT}/recoveryDiagnostics`, o: 'remove' })
          }
        }
        if (JSON.stringify(pendingResults) !== lastSnapshot.pendingJson) {
          let prevPending = {}
          try {
            prevPending = JSON.parse(lastSnapshot.pendingJson)
          } catch {}
          for (const uuid of Object.keys(pendingResults)) {
            if (!(uuid in prevPending)) {
              ops.push({
                p: `${DIL_ROOT}/appData/opGenui/componentResults/${uuid}`,
                o: 'add',
                v: pendingResults[uuid]
              })
            }
          }
        }
        if (JSON.stringify(required) !== lastSnapshot.requiredJson) {
          ops.push({ p: `${DIL_ROOT}/requiredComponents`, o: 'add', v: required })
        }
        if (JSON.stringify(genuiList) !== lastSnapshot.genuiJson) {
          ops.push({ p: '/message/metadata/genui_components', o: 'add', v: genuiList })
        }
        lastSnapshot = {
          code: compiled.code,
          constants: compiled.constants,
          fallback: compiled.fallbackMarkdown,
          diagJson,
          requiredJson: JSON.stringify(required),
          genuiJson: JSON.stringify(genuiList),
          pendingJson: JSON.stringify(pendingResults),
          intro,
          outro
        }
        if (
          ops.length === 1 &&
          ops[0].p === PARTS_APPEND.p &&
          lastEmitted.p === PARTS_APPEND.p &&
          lastEmitted.o === 'append'
        ) {
          emitDelta({ v: ops[0].v })
          return
        }
        if (ops.length) emitDelta({ o: 'patch', v: ops })
      }

      const dslMessages = [{ role: 'system', content: DSL_PROMPT }, { role: 'system', content: `可信上下文：${JSON.stringify(trustedContext)}。日期使用__dilModelDataBindings.localDate；未提供历史记录，禁止编造连续天数。` }, ...history]
      if (mode === 'staged' && (analysisMd || planMd)) {
        dslMessages.push({
          role: 'user',
          content: [
            '请根据以下材料生成最终交互卡片,直接输出 DIL(开场白一句 + {@body} 指令 + 组件标记 + 结尾一句),不要输出其它解释。',
            `\n【主题】${themePick.label}(id: ${themePick.theme}/${themePick.palette}) — 视觉与全部尺寸已由渲染端按此主题实现;你的输出中不要出现任何颜色/尺寸/字体属性,卡片尺寸使用宿主布局规则。`,
            lastUser ? `\n【原始需求】\n${lastUser.content}` : '',
            analysisMd ? `\n【信息规划】\n${analysisMd}` : '',
            planMd ? `\n【交互方案】\n${planMd}` : ''
          ].join('')
        })
      }

      const onPiece = (piece) => {
        if (piece.content && firstVisibleAt === null) firstVisibleAt = Date.now()
        if (piece.reasoning) pendingReasoning += piece.reasoning
        if (piece.content) fullRaw += piece.content
        const now = Date.now()
        if (now - lastFlushAt >= FLUSH_INTERVAL_MS) {
          lastFlushAt = now
          flush()
        }
      }
      try {
        await streamUpstream(dslMessages, {
          temperature: ph.temperature,
          maxTokens: ph.maxTokens,
          signal: controller.signal,
          onPiece,
          reasoningEffort: ph.reasoningEffort
        })
      } catch (err) {
        if (controller.signal.aborted || res.writableEnded) throw err
        // transient gateway drop before any visible content -> one retry, same params
        if (!fullRaw) {
          send({
            type: 'stream_note',
            note: 'card phase interrupted — retrying',
            conversation_id: conversationId
          })
          await streamUpstream(dslMessages, {
            temperature: ph.temperature,
            maxTokens: ph.maxTokens,
            signal: controller.signal,
            onPiece,
            reasoningEffort: ph.reasoningEffort
          })
        } else {
          throw err
        }
      }
      flush()

      const finalDiagnostics = validateDil(fullRaw)
      if (finalDiagnostics.length) {
        emitDelta({ o: 'patch', v: [
          { p: '/message/status', o: 'replace', v: 'finished_with_error' },
          { p: '/message/metadata/diagnostics', o: 'replace', v: finalDiagnostics },
        ] })
        send({ type: 'phase_end', id: ph.id, phase: 'dsl', status: 'failed', conversation_id: conversationId })
        throw new Error(`DIL compilation failed: ${finalDiagnostics.map(d => d.code).join(', ')}`)
      }

      // let pending AsyncImage resolutions (Pexels fetch + moderation + patch)
      // land before the stream closes — bounded so a hung upstream can't stall
      const pendingResolutions = [...resolutions.values()].filter((r) => !r.done)
      if (pendingResolutions.length) {
        await Promise.race([
          Promise.allSettled(pendingResolutions.map((r) => r.promise)),
          new Promise((resolve) => setTimeout(resolve, 9000))
        ])
      }

      if (!skeletonSent) {
        send({
          type: 'stream_error',
          error: { message: 'model produced no visible content for the card phase' }
        })
      } else {
        finishPhase('dsl', ph.id)
        send({
          type: 'message_marker',
          conversation_id: conversationId,
          message_id: ph.id,
          marker: 'last_token',
          event: 'last'
        })
      }
    }

    send({
      type: 'server_ste_metadata',
      metadata: {
        server_ttfvt_ms: firstVisibleAt === null ? null : firstVisibleAt - requestStart,
        first_content_ms: firstVisibleAt === null ? null : firstVisibleAt - requestStart,
        total_ms: Date.now() - requestStart,
        model_slug: MODEL_NAME,
        mode,
        user_agent: 'web_desktop',
        service: 'generative-card-engine'
      },
      conversation_id: conversationId
    })
    send({ type: 'message_stream_complete', status: 'succeeded', conversation_id: conversationId })
    send('[DONE]')
    res.end()
  } catch (err) {
    const aborted = err?.name === 'AbortError' || res.writableEnded
    if (!aborted) {
      console.error('[server] chat error:', err?.message)
      send({ type: 'stream_error', status: 'failed', error: { message: `pipeline failure: ${String(err?.message ?? err).slice(0, 200)}` } })
      send('[DONE]')
    }
    res.end()
  }
}

// ---------------------------------------------------------------- static + boot

const DIST = path.join(__dirname, '..', 'dist')

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost')
  let pathname = decodeURIComponent(url.pathname)
  if (pathname.endsWith('/')) pathname += 'index.html'
  const file = path.join(DIST, path.normalize(pathname).replace(/^([.][.][/\\])+/, ''))
  if (!file.startsWith(DIST + path.sep)) {
    res.writeHead(403).end()
    return
  }
  try {
    const data = await readFile(file)
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' })
    res.end(data)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('not found')
  }
}

const server = http.createServer(async (req, res) => {
  if(req.url.split('?')[0].startsWith('/api/workbench/')){
    if(!localToolRequest(req,PORT)){res.writeHead(403).end('local workbench only');return}
    try{
      const route=req.url.split('?')[0];let value
      if(route==='/api/workbench/feedback'&&req.method==='GET')value=await workbenchStore.all()
      else if(['/api/workbench/feedback','/api/workbench/events'].includes(route)&&req.method==='POST'){
        if(!req.headers['content-type']?.startsWith('application/json')){res.writeHead(415).end();return}
        const body=JSON.parse(await readBody(req,65536));value=route.endsWith('/feedback')?await workbenchStore.save(body.id,body.feedback):await workbenchStore.event(body.id,body.event)
      }else{res.writeHead(404).end();return}
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(value))
    }catch(e){res.writeHead(e.statusCode||400,{'Content-Type':'application/json'}).end(JSON.stringify({error:e.message}))}
    return
  }
  if(req.url.split('?')[0].startsWith('/api/tools')) {
    if(!localToolRequest(req,PORT)){res.writeHead(403).end('local tools only');return}
    if(req.headers.origin){res.setHeader('Access-Control-Allow-Origin',req.headers.origin);res.setHeader('Vary','Origin')}
    if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}).end();return}
    try{
      if(req.url.startsWith('/api/tools/assets/')&&req.method==='GET'){
        const ref=decodeURIComponent(req.url.slice('/api/tools/assets/'.length)),url=toolAssets.resolve(ref)
        await toolMedia.handle({headers:req.headers,url:'/api/tools/media?url='+encodeURIComponent(url)},res);return
      }
      if(req.url.split('?')[0]==='/api/tools/media'&&req.method==='GET'){await toolMedia.handle(req,res);return}
      if(req.url==='/api/tools'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({tools:await toolService.catalog()}));return}
      if(req.url==='/api/tools/connections'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(await toolService.connections()));return}
      if(['/api/tools/connect','/api/tools/prepare','/api/tools/configure','/api/tools/diagnose','/api/tools/bind','/api/tools/unbind'].includes(req.url)&&req.method==='POST'){
        if(!req.headers['content-type']?.startsWith('application/json')){res.writeHead(415).end();return}
        const body=JSON.parse(await readBody(req,65536))
        const value=req.url.endsWith('/bind')?await toolService.bind():req.url.endsWith('/unbind')?await toolService.unbind():req.url.endsWith('/prepare')?await toolService.prepare(body):req.url.endsWith('/configure')?{disabledTools:await toolService.configure(body.disabledTools)}:req.url.endsWith('/diagnose')?await toolService.diagnose():await toolService.connect(body.profile||'')
        res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(value));return
      }
      if(req.url==='/api/tools/invoke'&&req.method==='POST'){
        if(!req.headers['content-type']?.startsWith('application/json')){res.writeHead(415).end();return}
        await toolService.handle(req,res,JSON.parse(await readBody(req,65536)));return
      }
      res.writeHead(404).end();return
    }catch(e){if(!res.headersSent)res.writeHead(e.statusCode||400,{'Content-Type':'application/json'}).end(JSON.stringify({error:e.message}));return}
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req)).end()
    return
  }
  const url = new URL(req.url, 'http://localhost')
  try {
    const methods = { '/api/health': 'GET', '/api/image': 'GET', '/api/photo': 'GET', '/api/chat': 'POST' }
    if (methods[url.pathname] && req.method !== methods[url.pathname]) {
      res.writeHead(405, { 'Content-Type': 'application/json', Allow: methods[url.pathname] }).end(JSON.stringify({ error: 'method not allowed' }))
      return
    }
    if (url.pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders(req) })
      res.end(JSON.stringify({ ok: true, model: MODEL_NAME, keyLoaded: keyInfo.ok, upstream: MODEL_BASE, formats: ['dil', 'cardspec'],cardSandbox:sandboxEnabled(),generationDebug:'experimental-mock-browser-v1' }))
      return
    }
    if (url.pathname === '/api/photo') {
      const query = url.searchParams.get('query') || '', role = url.searchParams.get('role') || 'hero'
      if (!query.trim() || query.length > 100 || !['hero','thumbnail','gallery','background'].includes(role)) { res.writeHead(400).end(); return }
      const controller = new AbortController()
      res.once('close', () => { if (!res.writableEnded) controller.abort() })
      const photo = await pexelsPhoto(query, controller.signal, role)
      if (res.destroyed) return
      res.writeHead(photo ? 200 : 503, { 'Content-Type':'application/json', 'Cache-Control':photo ? 'private, max-age=86400' : 'no-store' })
      res.end(JSON.stringify(photo ? { ...photo, status:'loaded', url:photo.content } : { status:'error', message:'图片暂不可用' })); return
    }
    if (url.pathname.startsWith('/api/media/')) {
      if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405).end(); return }
      const media = await photoService.media(url.pathname.slice('/api/media/'.length))
      if (!media) { res.writeHead(404).end(); return }
      res.writeHead(200, { 'Content-Type':media.contentType, 'Cache-Control':'public, max-age=86400' }); res.end(req.method === 'HEAD' ? undefined : media.bytes); return
    }
    if (url.pathname === '/api/image') {
      const w = Math.min(Math.max(parseInt(url.searchParams.get('w')) || 1024, 16), 2048)
      const h = Math.min(Math.max(parseInt(url.searchParams.get('h')) || 576, 16), 2048)
      const seed = url.searchParams.get('seed') || 'default'
      const label = url.searchParams.get('label') || ''
      const svg = placeholderSvg(seed, w, h, label)
      res.writeHead(200, {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400',
        ...corsHeaders(req)
      })
      res.end(svg)
      return
    }
    if (url.pathname === '/api/chat' && req.method === 'POST') {
      await handleChat(req, res)
      return
    }
    if (url.pathname.startsWith('/api/')) {
      res.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'unknown api route' }))
      return
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return }
    await serveStatic(req, res)
  } catch (err) {
    console.error('[server] request error:', err)
    if (!res.headersSent) res.writeHead(err.statusCode || 500, { 'Content-Type': 'application/json' })
    if (!res.writableEnded) res.end(JSON.stringify({ error: err.statusCode === 413 ? 'body too large' : 'internal error' }))
  }
})

server.listen(PORT, () => {
  if(PORT===8787&&process.env.AGENT_WORKBENCH!=='0')import('./agent-jobs-host.mjs').then(m=>m.ensureAgentJobs()).catch(e=>console.warn('[agent-jobs]',e.message))
  console.log(`[server] card engine listening on http://127.0.0.1:${PORT}`)
  console.log(`[server] model: ${MODEL_NAME} @ ${MODEL_BASE}`)
})
