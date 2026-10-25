import {MotionControl} from '../MotionControl.jsx'
import {KINETIC_FIXTURES} from '../../shared/cardspec/kinetic-fixtures.mjs'
import {TEMPLATE_FIXTURES} from '../../shared/cardspec/template-fixtures.mjs'
import {MATERIAL_FIXTURE} from '../../shared/cardspec/material-fixture.mjs'
import {DESIGNS} from '../../shared/cardspec/designs.mjs'
import {ADAPTIVE_FIXTURES} from '../../shared/cardspec/adaptive-fixtures.mjs'
import {CAPABILITY_FIXTURES} from '../../shared/cardspec/capability-fixtures.mjs'
import {SANDBOX_FIXTURE,SANDBOX_PURE} from '../../shared/cardspec/sandbox-fixtures.mjs'
import {SANDBOX_LINKED} from '../../shared/cardspec/sandbox-linked-fixture.mjs'
import {SandboxModeControl,useSandboxMode} from '../SandboxMode.jsx'
import {DECK_FIXTURES,fixtureDeck,fixtureTransport} from '../../shared/cardspec/deck-fixtures.mjs'
import {DETAIL_FIXTURES} from '../../shared/cardspec/detail-fixtures.mjs'
import {CardDeck} from './CardDeck.jsx'
import {LOGIC_FIXTURES} from '../../shared/cardspec/logic-fixtures.mjs'
import {OPENCLI_WEATHER,OPENCLI_MUSIC} from '../../shared/cardspec/opencli-fixtures.mjs'
import {ToolConnections} from './ToolConnections.jsx'
import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { CardRenderer } from './Renderer.jsx'
import { compileCard } from '../../shared/cardspec/compiler.mjs'
import { FIXTURES, calendar, TEST_CONTEXT } from '../../shared/cardspec/fixtures.mjs'
import { THEMES } from '../../shared/cardspec/registry.mjs'
import { MOBILE_FIXTURES } from '../../shared/cardspec/mobile-fixtures.mjs'
import { INTERACTION_FIXTURES } from '../../shared/cardspec/interaction-fixtures.mjs'
import { TRANSACTION_FIXTURES } from '../../shared/cardspec/transaction-fixtures.mjs'
import { EXPERIENCE_FIXTURES } from '../../shared/cardspec/experience-fixtures.mjs'
import { RICH_FIXTURES } from '../../shared/cardspec/rich-fixtures.mjs'
import { TOOL_DEMO } from '../../shared/cardspec/tool-fixtures.mjs'
import { collectImages } from '../../shared/cardspec/images.mjs'
import { VISUAL_STYLES } from '../../shared/cardspec/styles.mjs'
import '../styles/tokens.css'
import '../styles/themes.css'
import { RecoveryLab } from './RecoveryLab.jsx'
import { CardSizeControl } from '../CardSize.jsx'
const CASES = {...KINETIC_FIXTURES,...ADAPTIVE_FIXTURES,...CAPABILITY_FIXTURES,sandbox:SANDBOX_FIXTURE,sandboxPure:SANDBOX_PURE, ...Object.fromEntries(Object.entries(DETAIL_FIXTURES).map(([k,v])=>[k,v.source])),...DECK_FIXTURES, ...LOGIC_FIXTURES, ...FIXTURES, ...MOBILE_FIXTURES, ...INTERACTION_FIXTURES, ...TRANSACTION_FIXTURES, ...EXPERIENCE_FIXTURES, ...RICH_FIXTURES,tools:TOOL_DEMO,opencliWeather:OPENCLI_WEATHER,opencliMusic:OPENCLI_MUSIC }
CASES.sandboxLinked=SANDBOX_LINKED
Object.assign(CASES,TEMPLATE_FIXTURES)
CASES.materials=MATERIAL_FIXTURE
const requestedFixture=new URLSearchParams(location.search).get('fixture')
const initialFixture=Object.hasOwn(CASES,requestedFixture)?requestedFixture:'counter'

function Lab() {
  const renderMode=useSandboxMode()
  const [materialPreview,setMaterialPreview]=useState('enhanced')
  const [expressionDialect,setExpressionDialect]=useState(new URLSearchParams(location.search).get('dialect')==='js-v1'?'js-v1':'legacy')
  const [fixture, setFixture] = useState(initialFixture), [theme, setTheme] = useState('minimal'), [palette, setPalette] = useState('a')
  const [width, setWidth] = useState(432), [month, setMonth] = useState('2026-08'), [revision, setRevision] = useState(1), [streaming, setStreaming] = useState(!requestedFixture)
  const [source, setSource] = useState(''), [custom, setCustom] = useState(''), [layout, setLayout] = useState(null), [imageMode, setImageMode] = useState('loaded')
  const [design, setDesign] = useState(new URLSearchParams(location.search).get('design') || 'inherit')
  const [visualStyle, setVisualStyle] = useState('inherit'), [backgroundQuery, setBackgroundQuery] = useState('misty alpine lake')
  const compiled = useMemo(() => compileCard(custom || (fixture === 'calendar' ? calendar(month) : CASES[fixture]), { final: true, cardId: `${fixture}-${month}`, revision, context: {...TEST_CONTEXT,expressionDialect,renderMode:fixture==='sandbox'&&!custom?'hybrid':renderMode} }), [fixture, month, revision, custom,renderMode,expressionDialect])
  const spec = useMemo(() => compiled.spec ? { ...compiled.spec, theme, palette, ...(design === 'inherit' ? {} : {design}), ...(visualStyle === 'inherit' ? {} : { visualStyle, backgroundQuery, backgroundPosition:'center' }) } : null, [compiled, theme, palette, design, visualStyle, backgroundQuery])
  const resources = useMemo(() => {
    if (!spec || imageMode === 'pexels') return {}
    try { return Object.fromEntries(collectImages(spec).map((job) => [job.key, imageMode === 'loaded' ? { status:'loaded', url:new URL(`/api/image?seed=${encodeURIComponent(job.query)}&w=640&h=${job.role === 'background' ? 640 : 240}&label=fixture`, location.origin).href } : { status:imageMode }])) } catch { return {} }
  }, [spec, imageMode])
  return <main style={{ padding: 16, maxWidth: 900, margin: 'auto', fontFamily: 'system-ui', color: 'var(--color-text-prose)' }}>
    <ToolConnections/><CardSizeControl/><MotionControl/><label>材质对照 <select aria-label="材质对照" value={materialPreview} onChange={e=>setMaterialPreview(e.target.value)}><option value="enhanced">升级版</option><option value="classic">升级前</option></select></label><SandboxModeControl/><label>表达式 <select aria-label="表达式版本" value={expressionDialect} onChange={e=>setExpressionDialect(e.target.value)}><option value="legacy">原版</option><option value="js-v1">JavaScript</option></select></label><h1>CardSpec 组合组件实验室</h1><p>{fixture==='tools'?'此样例连接真实资讯来源；解释和后续页面由模型根据所选内容生成。':'同一套编译器、运行时与布局规则；以下数据均为测试示例。'}</p>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
      <label>样例 <select aria-label="样例" value={fixture} onChange={(e) => { setFixture(e.target.value); setCustom('') }}>{Object.keys(CASES).map((k) => <option key={k}>{k}</option>)}</select></label>
      <label>主题 <select aria-label="主题" value={theme} onChange={(e) => setTheme(e.target.value)}>{THEMES.map((k) => <option key={k}>{k}</option>)}</select></label>
      <label>配色 <select aria-label="配色" value={palette} onChange={(e) => setPalette(e.target.value)}>{['a','b','c'].map((k) => <option key={k}>{k}</option>)}</select></label>
      <label>设计配方 <select aria-label="设计配方" value={design} onChange={e=>setDesign(e.target.value)}><option value="inherit">按卡片声明／原版</option>{Object.entries(DESIGNS).map(([id,d])=><option key={id} value={id}>{d.label}</option>)}</select></label>
      <label>风格 <select aria-label="风格" value={visualStyle} onChange={(e) => setVisualStyle(e.target.value)}><option value="inherit">按卡片声明／原版</option>{Object.entries(VISUAL_STYLES).map(([id, style]) => <option key={id} value={id}>{style.label}</option>)}</select></label>
      {visualStyle !== 'inherit' && <label>背景关键词 <input aria-label="背景关键词" value={backgroundQuery} maxLength={100} onChange={(e) => setBackgroundQuery(e.target.value)}/></label>}
      <label>宽度 <select aria-label="宽度" value={width} onChange={(e) => setWidth(Number(e.target.value))}>{[320,360,432].map((k) => <option key={k}>{k}</option>)}</select></label>
      <label>月份 <input aria-label="月份" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
      <label>图片 <select aria-label="图片" value={imageMode} onChange={(e) => { setImageMode(e.target.value); if (e.target.value === 'pexels') setStreaming(false) }}><option>loaded</option><option>loading</option><option>error</option><option value="pexels">Pexels 实图</option></select></label>
      <button onClick={() => setRevision((n) => n + 1)}>模拟增量更新</button><button onClick={() => setStreaming(false)}>模拟结束</button>
    </div>
    <div style={{ width, maxWidth: '100%', margin: 'auto' }}>{fixture==='deck'?<CardDeck spec={fixtureDeck()[0].spec} deck={fixtureDeck()} transport={fixtureTransport}/>:<CardRenderer materialPreview={materialPreview} key={`${fixture}-${month}-${custom || 'fixture'}`} transport={!custom?DETAIL_FIXTURES[fixture]?.transport:undefined} persistenceKey={!custom&&(fixture==='tools'||fixture.startsWith('sandbox')||fixture.startsWith('logic')||fixture.startsWith('adaptive'))?'cardspec:lab:'+fixture:undefined} toolsReady={compiled.complete} spec={spec} streaming={streaming} resources={resources} onLayout={setLayout}/>}</div>
    <pre data-testid="layout" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(layout)}</pre><pre data-testid="diagnostics" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(compiled.diagnostics, null, 2)}</pre>
    <details><summary>输入 DSL 验证</summary><textarea aria-label="DSL源码" value={source} onChange={(e) => setSource(e.target.value)} style={{ display: 'block', boxSizing: 'border-box', width: '100%', height: 160, fontSize: 16 }}/><button style={{ minHeight: 44 }} onClick={() => { setCustom(source); setRevision((n) => n + 1) }}>应用源码</button></details>
  </main>
}
createRoot(document.getElementById('root')).render(requestedFixture==='recovery'?<RecoveryLab/>:<Lab />)
