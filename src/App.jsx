import {CardFocus} from './CardFocus.jsx'
import {CardDeck} from './cardspec/CardDeck.jsx'
import {SandboxModeControl,useSandboxMode} from './SandboxMode.jsx'
import {DEFAULT_CARDSPEC_MODE} from '../shared/cardspec/experience.mjs'
import {planningStatusText} from '../shared/cardspec/planning-status.mjs'
import {ToolConnections} from './cardspec/ToolConnections.jsx'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createDeltaApplier, isControlEvent } from './delta.js'
import { DilCard } from './dil/runtime.jsx'
import { attachAutoLayout } from './dil/autolayout.js'
import { Markdown } from './md.jsx'
import { CardRenderer } from './cardspec/Renderer.jsx'
import { Thinking } from './Thinking.jsx'
import { ToolSettings } from './cardspec/ToolCard.jsx'
import { readConversation,saveConversation,clearConversation } from './cardspec/session-storage.mjs'
import { generationHistory } from './generation-history.mjs'
import { Recovery } from './cardspec/Recovery.jsx'
import {MotionControl} from './MotionControl.jsx'
import { CardSizeControl,useCardSize } from './CardSize.jsx'
import {MODEL_PROFILES,normalizeModelProfile} from '../shared/cardspec/generation-settings.mjs'

const MAX_FRAMES = 400
const CLOUD_NO_TOOLS = import.meta.env.VITE_CLOUD_NO_TOOLS === '1'
const CLOUD_DEMO_TOOLS = import.meta.env.VITE_CLOUD_DEMO_TOOLS === '1'

function classifyFrame(f) {
  if (f && f.type === 'stream_error') return 'error'
  if (f && (f.type === 'phase_begin' || f.type === 'phase_end')) return 'control'
  if (isControlEvent(f)) return 'control'
  if (Array.isArray(f.v)) return 'patch'
  if (f.v !== undefined && f.p === undefined && f.o === undefined) return 'shorthand'
  return 'patch'
}

// ---------- reasoning (light font, collapsible; live while streaming) ----------

function ReasoningBlock({ text, live }) {
  const [userOpen, setUserOpen] = useState(null) // null = auto
  if (!text) return null
  const open = userOpen === null ? live : userOpen
  return (
    <details className="reasoning" open={open} onToggle={(e) => setUserOpen(e.currentTarget.open)}>
      <summary>
        <span className="reasoning-icon">💭</span>
        {live ? '思考中…' : '思考过程'}
        <span className="reasoning-len">{text.length} 字</span>
      </summary>
      <div className="reasoning-body">{text}</div>
    </details>
  )
}

// ---------- one phase of an assistant turn ----------

const PHASE_ICON = { analysis: '🧭', plan: '✏️', dsl: '🧩' }

// 4:4 square stage — the card's design-language theme and the auto-layout
// engine both live here; the model only ever picked the names.
function DilStage({ theme = 'editorial', palette = 'a', themeLabel, children }) {
  const cardSize=useCardSize()
  const ref = useRef(null)
  useEffect(() => attachAutoLayout(ref.current), [])
  return (
    <div className="dil-stage" ref={ref} data-theme={theme} data-palette={palette} data-card-size={cardSize}>
      {themeLabel ? <span className="dil-theme-tag">{themeLabel}</span> : null}
      {children}
    </div>
  )
}

function PhaseView({ phase, theme, palette, themeLabel, onTelemetry, recovery }) {
  const msg = phase.message
  const live = phase.live
  const reasoning = msg?.reasoning ?? ''
  const kind = phase.kind
  return (
    <section className={`phase phase--${phase.phase}`}>
      <header className="phase-head">
        <span className="phase-chip">
          {PHASE_ICON[phase.phase] ?? '•'} {phase.title}
        </span>
        {phase.phase === 'dsl' && themeLabel ? (
          <span className="phase-chip phase-chip--theme">{themeLabel}</span>
        ) : null}
        {live ? <span className="streaming-dot" /> : <span className="phase-done">{msg?.metadata?.experiencePlanning?.status==='fallback'&&phase.phase==='experience'?'已回退':phase.status === 'succeeded' ? '✓' : phase.status === 'cancelled' ? '已停止' : phase.status === 'failed' ? '失败' : '等待中'}</span>}
      </header>
      <ReasoningBlock text={reasoning} live={live} />
      {kind === 'dil' || kind === 'cardspec' ? (
        <AssistantDil message={msg} format={kind} streaming={live} theme={theme} palette={palette} onTelemetry={onTelemetry} recovery={recovery} />
      ) : (
        <div className={`phase-doc${live ? ' phase-doc--live' : ''}`}>
          {live && <Thinking />}
          {phase.phase==='experience'&&msg?.metadata?.experiencePlanning&&<>
            <p>{planningStatusText(msg.metadata.experiencePlanning)}</p>
            {msg.metadata.experiencePlanning.status==='fallback'&&<details><summary>规划失败详情</summary><p>{msg.metadata.experiencePlanning.reason}</p><small>原文片段（如有）记录在调试 trace 的 experiencePlanning.diagnostic 中。</small></details>}
            {msg.metadata.experiencePlanning.recovery&&<small>已从附加说明中提取并校验规划 JSON。</small>}
          </>}
          {msg?.metadata?.plan_document ? <PlanDocument document={msg.metadata.plan_document} /> : msg?.metadata?.format !== 'cardspec' ? <Markdown text={msg?.content?.parts?.[0] ?? ''} /> : null}
        </div>
      )}
    </section>
  )
}

function AssistantDil({ message, format, streaming, theme, palette, onTelemetry, recovery }) {
  const dil = message?.metadata?.model_dil_v2
  const cardSpec = message?.metadata?.card_spec
  const isCardSpec = format === 'cardspec' || message?.metadata?.format === 'cardspec'
  const intro = message?.metadata?.card_intro
  const outro = message?.metadata?.card_outro
  const failed = !streaming && (recovery?.failed || ['failed','cancelled'].includes(message?.status))
  const recoveryProps = {...recovery,source:message?.content?.parts?.[0] || '',diagnostics:message?.metadata?.diagnostics || []}
  return (
    <div className="msg msg-assistant">
      <div className="meta-row">
        {streaming ? (
          <>
            <span className="streaming-dot" />
            <span>streaming…</span>
          </>
        ) : (
          <span>{['finished_successfully', 'succeeded'].includes(message?.status) ? 'delivered' : ''}</span>
        )}
        {dil?.recoveryDiagnostics?.length ? (
          <span className="diag-pill" title={JSON.stringify(dil.recoveryDiagnostics)}>
            recovered_parse × {dil.recoveryDiagnostics.length}
          </span>
        ) : null}
      </div>
      {intro ? (
        <div className={`card-prose${streaming ? ' card-prose--live' : ''}`}>
          <Markdown text={intro} />
        </div>
      ) : null}
      <CardFocus>{isCardSpec ? failed && !cardSpec ? <Recovery {...recoveryProps}/> : <div inert={failed?'':undefined}><CardDeck deck={message?.metadata?.card_deck} recovery={recoveryProps} spec={cardSpec} toolsReady={!failed && (message?.status === "succeeded" || message?.metadata?.core_ready === true)} persistenceKey={cardSpec?`cardspec:pages:${cardSpec.cardId}`:undefined} resources={message?.metadata?.resources} streaming={streaming && !message?.metadata?.core_ready} onPaint={(at) => onTelemetry?.({ type: 'client_first_paint', at })} onLayout={(layout) => onTelemetry?.({ type: 'client_layout', layout })} /></div> : <DilStage theme={theme} palette={palette}>
        <DilCard dil={dil} streaming={streaming} />
        {streaming && <Thinking placement="card" empty={!dil?.code} />}
      </DilStage>}</CardFocus>
      {isCardSpec && failed && cardSpec && <Recovery {...recoveryProps} retained/>}
      {!isCardSpec && message?.metadata?.diagnostics?.some((d) => d.severity === 'error') && <div className="diag-pill">{dil?.code ? '本次更新未通过校验，保留上一个有效版本' : '本次生成未通过校验，尚未生成可用卡片'}</div>}
      {outro ? (
        <div className={`card-prose${streaming ? ' card-prose--live' : ''}`}>
          <Markdown text={outro} />
        </div>
      ) : null}
    </div>
  )
}

export function AssistantTurn({ turn, onTelemetry, goal, onRetry, onEdit, busy }) {
  const recovery={goal,onRetry,onEdit,busy,failed:['failed','cancelled'].includes(turn.status),cancelled:turn.status==='cancelled',error:turn.error}
  const hasCardPhase=turn.phases.some(p=>p.kind==='cardspec')
  return (
    <div className="turn">
      {turn.phases.map((p) => (
        <PhaseView
          key={p.id}
          phase={p}
          theme={turn.theme}
          palette={turn.palette}
          themeLabel={turn.themeLabel}
          onTelemetry={(event) => onTelemetry({ ...event, turnId: turn.id, elapsed_ms: Math.round((event.at || performance.now()) - turn.startedAt) })}
          recovery={recovery}
        />
      ))}
      {turn.format==='cardspec' && recovery.failed && !hasCardPhase && <Recovery {...recovery}/>}
      {turn.format!=='cardspec' && turn.error && <div className="meta-row" role="alert" style={{ color: 'var(--color-text-danger)' }}>{turn.error}</div>}
    </div>
  )
}

function PlanDocument({ document: doc }) {
  return <div>{doc.goal && <p>{doc.goal}</p>}{Object.entries(doc).filter(([k]) => k !== 'goal').map(([key, value]) => <details key={key} open={['requiredInformation', 'regions', 'rules'].includes(key)}><summary>{({ facts: '已知信息', interactions: '交互', requiredInformation: '核心内容', supportingInformation: '补充内容', unavailableData: '缺少的数据', theme: '主题', design: '设计配方', visualStyle: '视觉风格', backgroundQuery: '背景意象', backgroundPosition: '背景构图', regions: '布局区域', state: '状态', rules: '交互规则' })[key] || key}</summary><pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(value, null, 2)}</pre></details>)}</div>
}

// ---------- stream inspector ----------

function Inspector({ frames, current, exportTrace }) {
  const [tab, setTab] = useState('frames')
  const framesRef = useRef(null)
  useEffect(() => {
    if (tab === 'frames' && framesRef.current) {
      framesRef.current.scrollTop = framesRef.current.scrollHeight
    }
  }, [frames, tab])

  const dil = current?.message?.metadata?.model_dil_v2
  const spec = current?.message?.metadata?.card_spec
  const programKey = useMemo(() => {
    const m = /"key":"(body:\d+)"/.exec(dil?.code ?? '')
    return m ? m[1] : '—'
  }, [dil?.code])
  const constants = dil?.constants ?? {}

  return (
    <aside className="inspector">
      <div className="tabs">
        {['frames', 'compiled', 'source', 'fallback', 'diagnostics'].map((t) => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
        <button className="tab" onClick={exportTrace}>导出</button>
      </div>
      <div className="panel" ref={framesRef}>
        {tab === 'frames' ? (
          frames.length === 0 ? (
            <div style={{ color: 'var(--color-text-tertiary)' }}>no frames yet — send a message</div>
          ) : (
            frames.map((f, i) => <pre key={i} className={`frame frame--${classifyFrame(f)}`}>{JSON.stringify(f)}</pre>)
          )
        ) : null}
        {tab === 'compiled' ? (
          spec ? <div className="code-view">{JSON.stringify(spec, null, 2)}</div> : !dil ? (
            <div style={{ color: 'var(--color-text-tertiary)' }}>no compiled program yet</div>
          ) : (
            <>
              <div className="kv">
                <b>program key</b>
                <span>{programKey}</span>
                <b>constants</b>
                <span>{Object.keys(constants).length} entries</span>
                <b>required</b>
                <span>{(dil.requiredComponents ?? []).join(', ') || '—'}</span>
                <b>diagnostics</b>
                <span>
                  {(dil.recoveryDiagnostics ?? []).map((d, i) => (
                    <span key={i} className="diag-pill">
                      {d.code} @{d.line}:{d.column}
                    </span>
                  ))}
                  {!(dil.recoveryDiagnostics ?? []).length ? 'clean' : null}
                </span>
                <b>appData</b>
                <span>{Object.keys(dil.appData?.opGenui?.componentResults ?? {}).length} async component(s)</span>
              </div>
              <div className="code-view">{dil.code}</div>
            </>
          )
        ) : null}
        {tab === 'source' ? (
          <div className="src-view">{(current?.message?.content?.parts?.[0] ?? '').trim() || '— empty —'}</div>
        ) : null}
        {tab === 'fallback' ? (
          <div className="src-view">{(dil?.fallbackMarkdown ?? '').trim() || '— empty —'}</div>
        ) : null}
        {tab === 'diagnostics' && <div className="code-view">{JSON.stringify(current?.message?.metadata?.diagnostics || dil?.recoveryDiagnostics || [], null, 2)}</div>}
      </div>
    </aside>
  )
}

const HINTS = [
  '帮我做一张喝水打卡卡片,可以记录每天 8 杯水',
  '给小朋友做一张养蚕成长卡:6 个阶段 + 每日照顾清单 + 观察记录',
  '做一个番茄钟工作卡:阶段切换 + 今日任务清单',
  '做一份旅行清单卡:分类待办 + 预算输入 + 打包进度'
]

function turnDslSource(turn) {
  const dsl = turn?.phases?.find((p) => p.kind === 'dil' || p.kind === 'cardspec')
  return dsl?.message?.metadata?.validated_source ?? dsl?.message?.metadata?.card_deck?.[0]?.source ?? dsl?.message?.content?.parts?.[0] ?? ''
}

export default function App() {
  const [configCollapsed,setConfigCollapsed]=useState(()=>{try{return localStorage.getItem('card-config-collapsed')==='1'}catch{return false}})
  const cardSize=useCardSize()
  const [restored]=useState(()=>readConversation(window.sessionStorage))
  const [messages, setMessages] = useState(restored.messages) // user msgs + assistant turns
  const renderMode=useSandboxMode()
  const [toolsEnabled,setToolsEnabled]=useState(()=>{if(CLOUD_DEMO_TOOLS){try{return localStorage.getItem('cardspec-cloud-demo-tools')!=='off'}catch{return true}}return !CLOUD_NO_TOOLS&&restored.toolsEnabled!==false})
  useEffect(()=>{if(CLOUD_DEMO_TOOLS)try{localStorage.setItem('cardspec-cloud-demo-tools',toolsEnabled?'on':'off')}catch{}},[toolsEnabled])
  const [persistenceError,setPersistenceError]=useState('')
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [frames, setFrames] = useState([])
  const [rev, setRev] = useState(0)
  const [theme, setTheme] = useState('light')
  const [inspectorOpen, setInspectorOpen] = useState(() => window.innerWidth >= 900)
  const [mode, setMode] = useState(DEFAULT_CARDSPEC_MODE)
  const [designPreference,setDesignPreference]=useState('auto')
  const [debugGeneration,setDebugGeneration]=useState(()=>{try{return localStorage.getItem('cardspec-debug-generation')==='1'}catch{return false}})
  const [generationProfile,setGenerationProfile]=useState(()=>{try{return localStorage.getItem('cardspec-generation-profile')==='adaptive-v1'?'adaptive-v1':'legacy'}catch{return 'legacy'}})
  const [expressionDialect,setExpressionDialect]=useState(()=>{try{const saved=localStorage.getItem('cardspec-expression-dialect');return saved==='js-v1'||(!saved&&CLOUD_DEMO_TOOLS)?'js-v1':'legacy'}catch{return CLOUD_DEMO_TOOLS?'js-v1':'legacy'}})
  const [modelProfile,setModelProfile]=useState(()=>{try{return normalizeModelProfile(localStorage.getItem('cardspec-model-profile'))}catch{return 'default'}})
  const [format, setFormat] = useState('cardspec')
  const [streamError, setStreamError] = useState(null)
  const [clearOpen,setClearOpen]=useState(false)

  const turnRef = useRef(null) // in-flight {phases:[...]}
  const applierRef = useRef(createDeltaApplier())
  const abortRef = useRef(null)
  const listRef = useRef(null)
  const traceRef = useRef([])
  const traceTurnRef = useRef(null)
  useEffect(()=>{const timer=setTimeout(()=>setPersistenceError(saveConversation(window.sessionStorage,messages,toolsEnabled)),250);return()=>clearTimeout(timer)},[messages,rev,toolsEnabled])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages.length, rev, streaming])

  const pushFrame = useCallback((f) => {
    traceRef.current.push({ at: performance.now(), frame: f })
    setFrames((prev) => {
      const next = prev.concat([f])
      return next.length > MAX_FRAMES ? next.slice(next.length - MAX_FRAMES) : next
    })
  }, [])
  const recordTelemetry = useCallback((event) => { if (event.turnId === traceTurnRef.current) pushFrame(event) }, [pushFrame])

  const send = useCallback(
    async (text, requestedFormat = format, resumeToken) => {
      const userText = (text ?? input).trim()
      if (!userText || streaming) return
      setInput('')
      setStreamError(null)
      setStreaming(true)
      const historyForApi = generationHistory(messages,requestedFormat,userText,turnDslSource)

      const turnId = crypto.randomUUID()
      const newTurn = { id: turnId, role: 'assistant', format:requestedFormat, status: 'running', phases: [], startedAt: performance.now() }
      traceTurnRef.current = turnId
      turnRef.current = newTurn
      traceRef.current = []
      setFrames([])
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content: userText }, newTurn])
      applierRef.current = createDeltaApplier()
      const controller = new AbortController()
      abortRef.current = controller
      let streamError = null
      let terminal = null

      const currentPhase = () => {
        const t = turnRef.current
        return t.phases.length ? t.phases[t.phases.length - 1] : null
      }

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: historyForApi, mode:requestedFormat==='dil'&&mode==='experience'?'direct':mode, format:requestedFormat, turnId,toolsEnabled,cardSize,renderMode,designPreference,generationProfile,debugGeneration,expressionDialect,modelProfile,resumeToken }),
          signal: controller.signal
        })
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let done = false

        while (!done) {
          const { value, done: rDone } = await reader.read()
          if(abortRef.current!==controller)return
          if (rDone) { if (!done) throw new Error('连接提前结束，未收到完成标记'); break }
          buffer += decoder.decode(value, { stream: true })
          let idx
          let boundary
          while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
            idx = boundary.index
            const block = buffer.slice(0, idx)
            buffer = buffer.slice(idx + boundary[0].length)
            for (const line of block.split('\n')) {
              if (!line.startsWith('data:')) continue
              const data = line.slice(5).trim()
              if (data === '[DONE]') {
                done = true
                break
              }
              let frame
              try {
                frame = JSON.parse(data)
              } catch {
                throw new Error('无效的流协议帧')
              }
              if(frame.turnId&&frame.turnId!==turnId)continue
              pushFrame(frame)

              if (frame.type === 'stream_error') {
                streamError = frame.error?.message ?? 'stream error'
                setStreamError(streamError)
                terminal = frame.status || 'failed'
                continue
              }
              if (frame.type === 'message_stream_complete') {
                terminal = terminal || frame.status || 'succeeded'
                continue
              }
              if (frame.type === 'phase_begin') {
                turnRef.current.phases.push({
                  id: frame.id,
                  phase: frame.phase,
                  title: frame.title,
                  kind: frame.kind,
                  message: null,
                  live: true,
                  status: 'running'
                })
                setRev((r) => r + 1)
                continue
              }
              if (frame.type === 'phase_end') {
                const p = turnRef.current.phases.find((x) => x.id === frame.id)
                if (p) { p.live = false; p.status = frame.status || 'succeeded' }
                setRev((r) => r + 1)
                continue
              }
              if (frame.type === 'theme') {
                turnRef.current.theme = frame.theme
                turnRef.current.palette = frame.palette
                turnRef.current.themeLabel = frame.label
                setRev((r) => r + 1)
                continue
              }
              if (isControlEvent(frame)) {
                continue
              }
              // delta frame -> apply into the current phase envelope
              const phase = currentPhase()
              if (phase) {
                if (!phase.envelope) phase.envelope = { message: null }
                applierRef.current.apply(phase.envelope, frame)
                phase.message = phase.envelope.message
                setRev((r) => r + 1)
              }
            }
          }
        }
        if (!terminal) throw new Error('流已关闭，但没有明确的生成终态')
      } catch (err) {
        if(abortRef.current!==controller)return
        if (err?.name !== 'AbortError') {
          streamError = err.message ?? 'network error'
          setStreamError(streamError)
        }
      } finally {
        if(abortRef.current!==controller)return
        const turn = turnRef.current
        turnRef.current = null
        if (turn && turn.phases.length) {
          turn.status = controller.signal.aborted ? 'cancelled' : streamError ? 'failed' : terminal || 'failed'
          turn.error = streamError
          for (const p of turn.phases) if (p.live) { p.live = false; p.status = turn.status === 'succeeded' ? 'failed' : turn.status }
          setMessages((prev) => [...prev])
        } else if (turn) {
          turn.status = controller.signal.aborted ? 'cancelled' : 'failed'
          turn.error = streamError || (controller.signal.aborted ? '已停止' : '生成失败')
          setMessages((prev) => [...prev])
        }
        abortRef.current = null
        setStreaming(false)
      }
    },
    [input, messages, pushFrame, streaming, mode, format,toolsEnabled,cardSize,renderMode,designPreference,generationProfile,debugGeneration,expressionDialect,modelProfile]
  )

  const liveTurn = turnRef.current
  const clearHistory=()=>{
    abortRef.current?.abort();abortRef.current=null
    turnRef.current=null;traceTurnRef.current=null;traceRef.current=[]
    applierRef.current=createDeltaApplier()
    setMessages([]);setFrames([]);setInput('');setStreamError(null);setStreaming(false)
    setPersistenceError(clearConversation(window.sessionStorage));setClearOpen(false)
  }
  const inspectorCurrent = useMemo(() => {
    const t = liveTurn?.phases?.length ? liveTurn : messages[messages.length - 1]
    const phases = t?.phases ?? []
    const withMsg = [...phases].reverse().find((p) => p.message)
    return withMsg ? { message: withMsg.message } : null
  }, [liveTurn, messages, rev])

  return (
    <div className="app">
      <div className="chat-side">
        <div className="configuration-heading"><h1>生成式交互卡片</h1><button aria-expanded={!configCollapsed} aria-controls="generation-configuration" onClick={()=>{setConfigCollapsed(!configCollapsed);try{localStorage.setItem('card-config-collapsed',configCollapsed?'0':'1')}catch{}}}>{configCollapsed?'展开配置':'收起配置'}</button></div>
        <header className="topbar" id="generation-configuration" hidden={configCollapsed}>
          <span className="chip">card engine · {format==='cardspec'?MODEL_PROFILES[modelProfile].label:'DIL'}</span>
          <button
            className={`chip chip-btn${mode !== 'direct' ? ' chip-btn--on' : ''}`}
            title="体验规划 → 卡片生成；direct 为快速模式；三阶段为详细规划"
            onClick={() => setMode(mode==='direct'?(format==='dil'?'staged':'experience'):mode==='experience'?'staged':'direct')}
            disabled={streaming}
          >
            {generationProfile==='adaptive-v1'&&format==='cardspec'?'按需规划 → 核心卡 → 增强':mode==='experience'&&format!=='dil'?'体验规划 → 卡片生成':mode === 'staged' ? ' Pipeline: 3-phase ' : ' Pipeline: direct'}
          </button>
          <label className="chip">协议 <select aria-label="渲染协议" value={format} onChange={(e) => setFormat(e.target.value)} disabled={streaming} style={{ background: 'transparent', color: 'inherit', border: 0 }}><option value="dil">DIL（原版）</option><option value="cardspec">CardSpec v1</option></select></label>
          {format==='cardspec'&&<label className="chip">设计家族 <select aria-label="设计家族" value={designPreference} disabled={streaming} onChange={e=>setDesignPreference(e.target.value)}><option value="auto">模型选择</option><option value="pearl">月距力</option><option value="atlas">动态学术</option><option value="rebel">Persona</option><option value="parchment">羊皮纸叙事</option><option value="business">专业商务</option><option value="academy">辉石学院</option><option value="default">默认</option></select></label>}
          {format==='cardspec'&&<label className="chip" title="错误自动重试，最多 8 次修复、24 次模型调用、15 分钟；通过后停止。重复失败稿、取消或预算耗尽时结束。"><input type="checkbox" checked={debugGeneration} disabled={streaming} onChange={e=>{setDebugGeneration(e.target.checked);try{localStorage.setItem('cardspec-debug-generation',e.target.checked?'1':'0')}catch{}}}/>生成期调试与修复（最多 8 次）</label>}
          {format==='cardspec'&&<label className="chip"><input type="checkbox" checked={generationProfile==='adaptive-v1'} disabled={streaming} onChange={e=>{const profile=e.target.checked?'adaptive-v1':'legacy';setGenerationProfile(profile);try{localStorage.setItem('cardspec-generation-profile',profile)}catch{}}}/>自适应体验（实验）</label>}
          {format==='cardspec'&&<label className="chip">类 JS 表达式 <select aria-label="表达式版本" value={expressionDialect} disabled={streaming} onChange={e=>{setExpressionDialect(e.target.value);try{localStorage.setItem('cardspec-expression-dialect',e.target.value)}catch{}}}><option value="legacy">原版</option><option value="js-v1">JavaScript（实验）</option></select></label>}
          {format==='cardspec'&&<label className="chip">模型 <select aria-label="生成模型" value={modelProfile} disabled={streaming} onChange={e=>{setModelProfile(e.target.value);try{localStorage.setItem('cardspec-model-profile',e.target.value)}catch{}}}>{Object.entries(MODEL_PROFILES).map(([value,p])=><option key={value} value={value}>{p.label}</option>)}</select></label>}
          <CardSizeControl/><MotionControl/><SandboxModeControl/>{!CLOUD_NO_TOOLS&&<>{!CLOUD_DEMO_TOOLS&&<ToolConnections/>}<label className="chip"><input type="checkbox" checked={toolsEnabled} onChange={e=>setToolsEnabled(e.target.checked)}/>{CLOUD_DEMO_TOOLS?'模拟工具':'工具增强'}</label></>}
          {CLOUD_DEMO_TOOLS&&<span className="chip" title="CLI返回虚构演示样本；下一页与局部生成使用真实模型。不会连接你的桌面浏览器。">云端 · 演示数据</span>}
          {CLOUD_NO_TOOLS&&<span className="chip" title="支持模型生成及卡内本地交互；不查询实时资料，也不连接外部工具">云端 · 无工具生成</span>}
          <span className="spacer" />
          <a className="chip" href={CLOUD_NO_TOOLS||CLOUD_DEMO_TOOLS?'/cardspec-showcase/index.html':'/workbench.html'} target="_blank" rel="noreferrer">{CLOUD_NO_TOOLS||CLOUD_DEMO_TOOLS?'五个能力演示 ↗':'体验工作台 ↗'}</a>
          <a className="chip" href="/design-templates.html?preset=pearl">Preset · 月距力 ↗</a>
          <a className="chip" href="/pearl-review.html">Pearl · 整卡样板对照 ↗</a>
          <a className="chip" href="/design-templates.html?preset=atlas">Preset · 动态学术 ↗</a>
          <a className="chip" href="/design-templates.html?preset=rebel">Preset · persona ↗</a>
          {!CLOUD_NO_TOOLS&&!CLOUD_DEMO_TOOLS&&<a className="chip" href="/glm-browser-20261022/report.html" target="_blank" rel="noreferrer">生成实测报告 ↗</a>}
          <button className="icon-btn" onClick={()=>setClearOpen(true)} disabled={!messages.length&&!frames.length&&!streaming}>清空对话</button>
          <button className="icon-btn" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? '🌙 dark' : '☀️ light'}
          </button>
          <button className="icon-btn" onClick={() => setInspectorOpen(!inspectorOpen)}>
            {inspectorOpen ? 'hide stream' : 'show stream'}
          </button>
        </header>
        {CLOUD_NO_TOOLS&&<p data-testid="cloud-generation-notice" role="note" style={{margin:0,padding:'8px 16px',fontSize:12,color:'var(--color-text-secondary)'}}>云端自由生成 · 无外部工具。可计算与互动，实时资料请自行提供。</p>}
        {CLOUD_DEMO_TOOLS&&<div data-testid="cloud-demo-notice" role="note" style={{padding:'8px 16px',fontSize:12,background:'var(--color-surface)',color:'var(--color-text-secondary)'}}>演示模式：新闻、用户反馈、地点、影片和车次均为虚构样本，图片为演示插画；不代表实时事实，不可据此购票或出行。GLM生成仍为真实调用。<div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:6}}>{['尊界舆情观察','萧山周末亲子计划','今晚看什么电影','Transformer计算显微镜','杭州上海往返订票助手'].map(prompt=><button type="button" key={prompt} disabled={streaming} className="chip" onClick={()=>setInput(prompt+'。使用演示数据，提供可筛选、渐进展开的互动卡片。')}>{prompt}</button>)}</div></div>}
        {clearOpen&&<section role="alertdialog" aria-label="清空对话记录" aria-describedby="clear-history-description" style={{padding:'12px 16px',background:'var(--color-bg-secondary, #f2f4f7)'}}>
          <p id="clear-history-description">清空当前标签页的全部对话和卡片历史？生成会停止，清空后无法恢复。尺寸设置和工具连接会保留。</p>
          <button className="icon-btn" onClick={()=>setClearOpen(false)} autoFocus>取消</button>
          <button className="icon-btn" onClick={clearHistory}>确认清空</button>
        </section>}

        <ToolSettings.Provider value={toolsEnabled}><main className="messages" ref={listRef}>
          {persistenceError&&<small role="status">{persistenceError}</small>}
          {messages.length === 0 && !liveTurn?.phases?.length ? (
            <div className="empty-state">
              <h2>让模型生成一张可交互卡片</h2>
              <p style={{ margin: 0, fontSize: '0.82rem' }}>
                {CLOUD_NO_TOOLS?'输入需求即可生成。支持计算、图表、表单、模拟器和本地互动；实时新闻、余票、价格等需你提供资料，不会自动查询。':'三阶段:意图与信息规划 → 发散交互方案 → 流式编译渲染(delta v1 协议全程可见)'}
              </p>
              <div className="hints">
                {HINTS.map((h) => (
                  <button key={h} className="hint" onClick={() => send(h)} disabled={streaming}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={m.id} className="msg msg-user">
                <div className="bubble">{m.content}</div>
              </div>
            ) : (
              <AssistantTurn key={m.id} turn={m} onTelemetry={recordTelemetry} busy={streaming}
                goal={messages.slice(0,i).findLast(t=>t.role==='user')?.content || ''}
                onRetry={()=>send(messages.slice(0,i).findLast(t=>t.role==='user')?.content,m.format,m.phases?.findLast(p=>p.message?.metadata?.resumeToken)?.message?.metadata?.resumeToken)}
                onEdit={()=>{setInput(messages.slice(0,i).findLast(t=>t.role==='user')?.content || '');document.querySelector('.composer textarea')?.focus()}} />
            )
          )}

          {messages.length === 0 && streamError ? (
            <div className="msg msg-assistant">
              <div className="meta-row" style={{ color: 'var(--color-text-danger)' }}>{streamError}</div>
            </div>
          ) : null}
        </main></ToolSettings.Provider>

        <footer className="composer">
          <div className="composer-inner">
            <textarea
              value={input}
              placeholder="描述你想要的交互卡片…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            {streaming ? (
              <button className="stop-btn" onClick={() => abortRef.current?.abort()}>
                停止
              </button>
            ) : (
              <button className="send-btn" onClick={() => send()} disabled={!input.trim()}>
                发送
              </button>
            )}
          </div>
        </footer>
      </div>

      <div className={inspectorOpen ? 'inspector' : 'inspector hidden'}>
        <Inspector frames={frames} current={inspectorCurrent} rev={rev} exportTrace={() => {
          const url = URL.createObjectURL(new Blob([JSON.stringify(traceRef.current, null, 2)], { type: 'application/json' }))
          const a = document.createElement('a'); a.href = url; a.download = `card-trace-${Date.now()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
        }} />
      </div>
    </div>
  )
}
