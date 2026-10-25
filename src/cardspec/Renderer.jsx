import {ComparisonChart} from './ComparisonChart.jsx'
import {Collection} from './Collection.jsx'
import {isolateCollectionRows} from '../../shared/cardspec/collection-rows.mjs'
import {Experience,PointMap} from './Experience.jsx'
import {SeriesChart} from './SeriesChart.jsx'
import {LogicPanel} from './LogicPanel.jsx'
import {validateLogicView} from '../../shared/cardspec/logic-view.mjs'
import {attachContentMotion} from './host-motion.js'
import {attachComposition} from './composition.js'
import {HostEffect} from './HostEffect.jsx'
import {TemplateLayout} from './TemplateLayout.jsx'
import {projectTemplate,templateRole} from '../../shared/cardspec/layout-templates.mjs'
import {projectComposition} from '../../shared/cardspec/compositions.mjs'
import {CompositionLayout} from './CompositionLayout.jsx'
import {ProportionChart} from './ProportionChart.jsx'
import {PhotoStage} from './PhotoStage.jsx'
import {useCompositionSpace} from './useCompositionSpace.js'
import {Countdown,CopyText,Heatmap} from './NumericWidgets.jsx'
import { EvidenceText,EvidenceSources } from './Evidence.jsx'
import React, { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { evaluate, monthCells, addDays, addMonths } from '../../shared/cardspec/expression.mjs'
import { createStore, makeScope, executeAction } from '../../shared/cardspec/store.mjs'
import { filteredCollectionSources,activeCollectionBindings } from '../../shared/cardspec/tool-collection-state.mjs'
import { REGISTRY, checkValue } from '../../shared/cardspec/registry.mjs'
import { Icon } from '../dil/icons.jsx'
import { attachLayout } from './layout.js'
import { attachScrollAffordances } from './scroll-affordance.js'
import { Carousel, Slider, Diagram, Chart } from './Widgets.jsx'
import { validateWidget } from '../../shared/cardspec/widgets.mjs'
import { photoKey, safePhotoUrl } from '../../shared/cardspec/images.mjs'
import { VISUAL_STYLE_IDS } from '../../shared/cardspec/styles.mjs'
import { getDesign } from '../../shared/cardspec/designs.mjs'
import { fragmentProse } from '../../shared/cardspec/prose.mjs'
import './cardspec.css'
import './visual-styles.css'
import './designs.css'
import './material-motion.css'
import './kinetic.css'
import './templates.css'
import {useMotionPreference} from '../MotionControl.jsx'
import { Thinking } from '../Thinking.jsx'
import { ChoiceGroup, DataTable, Popover, SwipeStack, Confetti, Mermaid, MathNode } from './RichWidgets.jsx'
import { NavigationProvider, NavigationBar, useNavigationOwner, ExternalNavigation } from './Navigation.jsx'
import './scroll-affordance.css'
import { ToolCard } from './ToolCard.jsx'
import {SandboxPanel} from './SandboxPanel.jsx'
import { ViewStateProvider,useViewState } from './view-state.jsx'
import { Recovery, RenderBoundary, NodeFailure } from './Recovery.jsx'
import { useCardSize } from '../CardSize.jsx'
import { Clock } from './Clock.jsx'
import { measureExperience } from './experience-metrics.js'
import './seamless.css'

const scalar = (v) => v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
const safeLink = (value) => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null } catch { return null }
}
const safeBackgroundUrl = safePhotoUrl

function useBackgroundPhoto(query, supplied, streaming, enabled) {
  const key = photoKey(query, 'background'), [resolved, setResolved] = useState(null)
  const [imageState, setImageState] = useState(null)
  useEffect(() => {
    if (!enabled || !query || supplied || streaming) return
    const controller = new AbortController()
    fetch(`/api/photo?query=${encodeURIComponent(query)}&role=background`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error('photo unavailable'); return response.json() })
      .then((value) => setResolved({ key, value }))
      .catch(() => { if (!controller.signal.aborted) setResolved({ key, value: { status: 'error' } }) })
    return () => controller.abort()
  }, [key, !!supplied, streaming, enabled])
  const resource = supplied || (resolved?.key === key ? resolved.value : null)
  const src = safeBackgroundUrl(resource?.url)
  useEffect(() => {
    // A later resource revision can retry the same URL after a failed load.
    if (src && resource?.status !== 'error') setImageState((previous) => previous?.status === 'error' ? null : previous)
  }, [key, src, resource?.status])
  const status = resource?.status === 'error' || (resource?.url && !src) ? 'error'
    : imageState?.src === src ? imageState.status : 'loading'
  return { resource, src, status, loaded: () => setImageState({ src, status: 'loaded' }), failed: () => setImageState({ src, status: 'error' }) }
}

function Calendar({ p, fire, context }) {
  const month = p.month || context.localDate?.slice(0, 7)
  const cells = monthCells(month || ''), grid = useRef(null), focusAfter = useRef(null)
  const marks = new Set(p.markedDates || [])
  const chosen = p.selectedDate, today = context.localDate
  useLayoutEffect(() => {
    if (focusAfter.current) {
      grid.current?.querySelector(`[data-date="${focusAfter.current}"]`)?.focus()
      focusAfter.current = null
    }
  }, [month])
  const change = (nextMonth, focusDate) => {
    const firstMarked = [...marks].filter((d) => typeof d === 'string' && d.startsWith(nextMonth)).sort()[0]
    const date = today?.startsWith(nextMonth) ? today : firstMarked || `${nextMonth}-01`
    if (focusDate) focusAfter.current = focusDate
    fire('onMonthChange', { month: nextMonth, date: focusDate || date })
  }
  function keyDown(e, date) {
    let next
    if (e.key === 'ArrowLeft') next = addDays(date, -1)
    if (e.key === 'ArrowRight') next = addDays(date, 1)
    if (e.key === 'ArrowUp') next = addDays(date, -7)
    if (e.key === 'ArrowDown') next = addDays(date, 7)
    if (e.key === 'Home') next = addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7))
    if (e.key === 'End') next = addDays(date, 6 - ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7))
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault(); const nextMonth = addMonths(month, e.key === 'PageUp' ? -1 : 1)
      change(nextMonth, `${nextMonth}-01`); return
    }
    if (!next) return
    e.preventDefault()
    if (!next.startsWith(month)) change(next.slice(0, 7), next)
    else grid.current?.querySelector(`[data-date="${next}"]`)?.focus()
  }
  const activeTabDate = cells.includes(chosen) ? chosen : cells.find(Boolean)
  const navigation={label:`${p.label || '月历'}月份`,value:month?.replace('-', '年')+'月',previousLabel:'上个月',nextLabel:'下个月',previousText:'‹',nextText:'›',disabledPrevious:!p.onMonthChange,disabledNext:!p.onMonthChange,previous:()=>change(addMonths(month,-1)),next:()=>change(addMonths(month,1))}
  const builtIn=useNavigationOwner(p.ownerId,p.navigation==='external',navigation)
  return <div className="cs-calendar" data-weeks={cells.length / 7}>
    {builtIn && <NavigationBar model={navigation} className="cs-calendar-head"/>}
    <div className="cs-weekdays" aria-hidden="true">{'一二三四五六日'.split('').map((d) => <span key={d}>{d}</span>)}</div>
    <div className="cs-calendar-grid" role="group" aria-label={p.label || `${month} 月历`} ref={grid}>
      {cells.map((date, i) => date ? <button type="button" key={date} data-date={date}
        data-selected={chosen === date || undefined} data-today={today === date || undefined}
        aria-pressed={chosen === date} aria-current={today === date ? 'date' : undefined}
        aria-label={`${date}${marks.has(date) ? '，有内容' : ''}`} tabIndex={date === activeTabDate ? 0 : -1}
        onKeyDown={(e) => keyDown(e, date)} onClick={() => fire('onSelect', { date, value: date })}>
        <span>{Number(date.slice(8))}</span><i className="cs-date-dot" data-marked={marks.has(date) || undefined} />
      </button> : <span key={`empty-${i}`} aria-hidden="true" />)}
    </div>
  </div>
}

function Region({ p:requested, children, identity }) {
  const [regionRoot,space]=useCompositionSpace({reservePagination:true})
  const adapt=space!==null&&requested.overflow==='scroll'&&children.length>1
  const p=adapt?{...requested,overflow:'paginate'}:requested
  const cardSize=useCardSize()
  const body = useRef(null), dialog = useRef(null), [page, setPage] = useViewState('page',0), [pageSize, setPageSize] = useState(3)
  const [open, setOpen] = useState(false)
  const previousReset=useRef(scalar(p.resetKey)), detailHeight=useRef(0)
  useLayoutEffect(()=>{const el=body.current;if(!el||p.resetKey===undefined||cardSize!=='auto')return;detailHeight.current=Math.min(200,Math.max(detailHeight.current,el.getBoundingClientRect().height));el.style.minHeight=detailHeight.current+'px'},[p.resetKey,cardSize])
  useLayoutEffect(() => {const value=scalar(p.resetKey);if(previousReset.current!==value){previousReset.current=value;if(body.current)body.current.scrollTop=0;setPage(0)}}, [scalar(p.resetKey)])
  useEffect(() => {
    if (cardSize==='auto'&&space===null || p.overflow !== 'paginate' || !body.current) return
    const el = body.current
    const fit = () => {
      if(!el.clientHeight)return
      const heights = [...el.children].map((n) => n.getBoundingClientRect().height)
      const row = Math.max(40, ...heights)
      const css=getComputedStyle(el),gap=parseFloat(css.rowGap)||0,inner=el.clientHeight-(parseFloat(css.paddingTop)||0)-(parseFloat(css.paddingBottom)||0)
      const next = Math.max(1, Math.floor((inner + gap) / (row + gap)))
      setPageSize((old) => old === next ? old : next)
    }
    const observer = new ResizeObserver(fit); observer.observe(el); fit()
    return () => observer.disconnect()
  }, [p.overflow, children.length, page,cardSize,space])
  useEffect(() => {
    if (!dialog.current) return
    if (open && !dialog.current.open) dialog.current.showModal()
    if (!open && dialog.current.open) dialog.current.close()
  }, [open])
  const count = Math.max(1, Math.ceil(children.length / pageSize)), current = Math.min(page, count - 1)
  const navigation={label:p.label || '分页',value:`${current+1} / ${count}`,count,disabledPrevious:current===0,disabledNext:current+1>=count,previous:()=>setPage(current-1),next:()=>setPage(current+1)}
  const builtIn=useNavigationOwner(p.ownerId,p.navigation==='external' && p.overflow==='paginate',navigation)
  if (p.overflow === 'details') return <div className="cs-details">
    <button type="button" onClick={() => setOpen(true)}>{p.label || '查看详情'}</button>
    <dialog ref={dialog} className="cs-dialog" onCancel={() => setOpen(false)} onClose={() => setOpen(false)} aria-label={p.label || '详情'}>
      <header><strong>{p.label || '详情'}</strong><button type="button" aria-label="关闭详情" onClick={() => setOpen(false)}>×</button></header>
      <div className="cs-stack">{children}</div>
    </dialog>
  </div>
  return <section ref={regionRoot} style={space!==null&&p.overflow==='paginate'?{height:space}:undefined} className={`cs-region${p.presentation === 'magazine' ? ' cs-magazine' : ''}`} data-cs-node={identity} data-role={p.role || 'content'} data-overflow={p.overflow} data-adapted-overflow={adapt?'paginate':undefined} data-priority={p.priority || 'required'} data-grow={p.grow || undefined} data-surface={p.surface} data-tone={p.tone}>
    <div className="cs-region-body" ref={body} style={{ gap: `var(--cs-space-${p.space || 'normal'})`, alignItems: p.align, justifyContent: { between: 'space-between', start: 'flex-start', end: 'flex-end' }[p.justify] || p.justify }} aria-label={p.label} tabIndex={p.overflow === 'scroll' || p.overflow === 'paginate' ? 0 : undefined}>
      {p.overflow === 'paginate' ? children.slice(current * pageSize, (current + 1) * pageSize).map((child) => <div className="cs-page-item" key={child.key}>{child}</div>) : p.presentation === 'magazine' ? children.map(child=><article className="cs-fragment" key={child.key}>{child}</article>) : children}
    </div>
    {p.overflow === 'paginate' && builtIn && <NavigationBar model={navigation} className="cs-pagination"/>}
  </section>
}
function ProgressiveList({children,attrs,flow}){
 const size=useCardSize(),pageSize=size==='square'?3:6
 const [position,setPosition]=useViewState('listPage',0),page=Math.min(Math.floor(position/pageSize),Math.max(0,Math.ceil(children.length/pageSize)-1))
 return <div className="cs-progressive-list"><ul {...attrs} className="cs-stack cs-list" style={flow}>{children.slice(page*pageSize,(page+1)*pageSize)}</ul>{children.length>pageSize&&<nav className="cs-row" aria-label="列表分组"><button className="cs-button" disabled={!page} onClick={()=>setPosition((page-1)*pageSize)}>上一组</button><span>{page+1} / {Math.ceil(children.length/pageSize)}</span><button className="cs-button" disabled={(page+1)*pageSize>=children.length} onClick={()=>setPosition((page+1)*pageSize)}>下一组</button></nav>}</div>
}
function ImageNode({ p, resource, streaming }) {
  const asset=Object.hasOwn(p,'assetRef'),validAsset=typeof p.assetRef==='string'&&/^asset\.v1\.[\w-]+\.[\w-]+$/.test(p.assetRef)&&p.assetRef.length<=3000
  const key = asset?p.assetRef:photoKey(p.query,p.mediaRole), [resolved, setResolved] = useState(null)
  useEffect(() => {
    if (asset || resource || streaming || !p.query) return
    const controller = new AbortController()
    fetch(`/api/photo?query=${encodeURIComponent(p.query)}&role=${encodeURIComponent(p.mediaRole || 'hero')}`, { signal:controller.signal })
      .then(async (r) => { if (!r.ok) throw new Error('photo unavailable'); return r.json() })
      .then((value) => setResolved({ key, value }))
      .catch(() => { if (!controller.signal.aborted) setResolved({ key, value:{ status:'error' } }) })
    return () => controller.abort()
  }, [key, !!resource, streaming,asset])
  if(asset)resource=validAsset?{url:'/api/tools/assets/'+encodeURIComponent(p.assetRef),kind:'source-image'}:{status:'error'}
  resource = resource || (resolved?.key === key ? resolved.value : null)
  const [status, setStatus] = useState('loading')
  const src = resource?.url
  useEffect(() => setStatus('loading'), [src])
  const failed = status === 'error' || resource?.status === 'error'
  return <div className="cs-photo"><figure className="cs-image" data-media-role={p.mediaRole || 'hero'} data-loaded={status === 'loaded'}>
    {src && <img src={src} alt={p.alt || p.query || ''} onLoad={() => setStatus('loaded')} onError={() => setStatus('error')} hidden={failed} />}
    {(!src || status !== 'loaded') && <span role="status">{failed ? '图片暂不可用' : '图片加载中…'}</span>}
  </figure>{asset&&<small className="cs-photo-credit">来源图片</small>}{resource?.provider === 'Pexels' && <small className="cs-photo-credit">示意 · Photo by {safeLink(resource.photoUrl) ? <a href={safeLink(resource.photoUrl)} target="_blank" rel="noreferrer">{resource.photographer || 'photographer'}</a> : resource.photographer} · <a href="https://www.pexels.com" target="_blank" rel="noreferrer">Pexels</a></small>}</div>
}

function Node({ node, scope, runtime, identity }) {
  const id = `${runtime.spec.cardId}-${identity}`.replace(/[^\w-]/g, '-')
  try {
    if(runtime.localLogic&&(['link','slot','logic','sandbox'].includes(node.type)||node.type==='image'&&node.props.query))throw Error('此组件需要宿主权限，请放在局部逻辑区域外')
    if (node.type === 'run') return <EvidenceText text={scalar(evaluate(node.value, scope))} research={runtime.spec.research}/>
    const p = {}
    for (const [key, value] of Object.entries(node.props)) {
      if (key === 'args') continue // evaluated with the event, not during rendering
      p[key] = evaluate(value, scope)
      const expected = REGISTRY[node.type]?.props[key]
      if (expected && !checkValue(expected, p[key])) throw new Error(`${node.type}.${key}: expected ${expected}`)
    }
    if (p.visible === false || (node.type === 'if' && !p.test)) return null
    validateWidget(node.type, p)
    const resultSources=['collection','experience','map','table','chart','heatmap'].includes(node.type)
      ?['items','rows','data','values'].flatMap(key=>activeCollectionBindings(runtime.spec,node.props[key],scope)):[]
    const sourceLeases=[...(runtime.sourceLeases||[]),...(runtime.session?.sourceLeases(resultSources)||[])]
    const argumentLeases=node.props.args?runtime.session?.sourceLeases(Object.keys(runtime.spec.bindings||{}))||[]:[]
    const fire = (eventName, event = {}) => {
      try {
        if(p.disabled)return false
        if (!p[eventName]) return true
        const eventScope={...scope,event}
        const argumentSources=activeCollectionBindings(runtime.spec,node.props.args,eventScope,{rowsOnly:true})
        const eventLeases=[...sourceLeases,...argumentLeases.filter(lease=>argumentSources.includes(lease.binding))]
        runtime.session?.assertSourcesCurrent(eventLeases)
        const args = node.props.args ? evaluate(node.props.args, eventScope) : {}
        if(runtime.fire)runtime.fire(p[eventName],{...scope,event,args,sourceLeases:eventLeases})
        else executeAction(runtime.spec, runtime.store, p[eventName], { ...scope, event, args, state: runtime.store.values })
        runtime.notify()
        return true
      } catch (e) { runtime.error(e.message);return false }
    }
    if(node.type==='logic')return <LogicPanel p={p} streaming={runtime.streaming} validate={local=>validateLogicView(node.children,{...scope,local})} onAction={({event,result,input})=>{
      const action=p.actions?.[event.type];if(!action||runtime.streaming)return
      const extra={event:{...event,result,input},args:event.args===undefined?{}:event.args}
      if(runtime.fire)runtime.fire(action,extra);else executeAction(runtime.spec,runtime.store,action,extra)
      runtime.notify()
    }}>{(local,dispatch,onError)=>renderChildren(node.children,{...scope,local},{...runtime,localLogic:true,fire:dispatch,error:onError,notify:()=>{}},identity)}</LogicPanel>
    const children = renderChildren(node.children, scope, p.presentation === 'magazine' ? {...runtime,magazine:true} : runtime, identity, node.type==='region'&&['paginate','scroll'].includes(p.overflow))
    const attrs = { 'data-motion':p.motion,'data-motion-key':p.motionKey,'data-cs-component': node.type, 'data-cs-node': identity, 'data-tone': p.tone, 'data-size': p.size, 'data-surface': p.surface, 'data-priority': p.priority, 'data-grow': p.grow || undefined, 'data-align':p.align }
    const flow = { gap: `var(--cs-space-${p.space || 'normal'})`, alignItems: p.align, justifyContent: { between: 'space-between', start: 'flex-start', end: 'flex-end' }[p.justify] || p.justify, flexWrap: p.wrap ? 'wrap' : undefined }
    switch (node.type) {
      case 'experience': return <Experience p={p} fire={fire}>{children}</Experience>
      case 'map': return <PointMap p={p} fire={fire}/>
      case 'sandbox': return <SandboxPanel p={p} nodeId={node.id} runtime={{...runtime,toolsReady:runtime.session?.complete}}>{children}</SandboxPanel>
      case 'slot': {
        const slot=runtime.page?.slots[node.id],busy=Object.values(runtime.page?.bindings||{}).some(b=>b.status==='loading'&&b.target===`slot:${node.id}`)
        const content=slot?renderChildren(slot.spec.children,makeScope(slot.spec,slot.store),{...runtime,spec:slot.spec,store:slot.store,page:slot,resources:slot.resources,fire:(action,extra)=>runtime.session.updateSlot(node.id,action,extra)},`${identity}/generated`):children
        return <section {...attrs} className="cs-tool-slot" data-motion="slide" data-motion-key={slot?.spec?.cardId || "default"} aria-label={p.label||'动态内容'} aria-busy={busy}>{content}{slot&&<EvidenceSources research={slot.spec.research}/>} {busy&&<Thinking/>}</section>
      }
      case 'collection': return <Collection p={p} fire={fire}/>
      case 'region': return <Region p={{...p,ownerId:node.id}} identity={identity}>{children}</Region>
      case 'navigation': return <ExternalNavigation target={p.target} identity={identity} label={p.label}/>
      case 'if': return <>{children}</>
      case 'list': if(children.length>6&&!runtime.streaming)return <ProgressiveList children={children} attrs={{...attrs,"aria-label":p.label}} flow={flow}/>; return <ul {...attrs} aria-label={p.label} className="cs-stack cs-list" style={flow}>{children}</ul>
      case 'list-item': return <li {...attrs} className="cs-stack" style={flow}>{p.onPress
        ? <button type="button" data-cs-node={`${identity}/@press`} className="cs-button cs-pressable cs-stack" style={flow} aria-label={p.label} disabled={p.disabled} onClick={()=>fire('onPress')}>{p.label&&<strong>{p.label}</strong>}{children}</button>
        : children}</li>
      case 'stack': case 'box': case 'carousel-item': return <div {...attrs} className="cs-stack" style={flow}>{children}</div>
      case 'row': case 'chips': return <div {...attrs} className="cs-row" style={flow} role={node.type === 'chips' ? 'group' : undefined} aria-label={p.label}>{children}</div>
      case 'grid': case 'stats': return <div {...attrs} className="cs-grid" style={{ ...flow, gridTemplateColumns: `repeat(${p.columns || (node.type === 'stats' ? Math.max(1, children.length) : 2)}, minmax(0, 1fr))` }}>{children}</div>
      case 'grid-item': return <div {...attrs} className="cs-stack" style={{ ...flow, gridColumn: p.span ? `span ${p.span}` : undefined, gridRow: p.rowSpan ? `span ${p.rowSpan}` : undefined }}>{children}</div>
      case 'title': return <span {...attrs} role="heading" aria-level="3" className="cs-title">{children}</span>
      case 'text': {
        if (runtime.magazine && node.children.every(n=>n.type==='run')) {
          const text=node.children.map(n=>scalar(evaluate(n.value,scope))).join('')
          return <div {...attrs} className="cs-prose">{fragmentProse(text).map((part,index)=><p key={index}>{part}</p>)}</div>
        }
        return <span {...attrs} className="cs-text" style={p.clamp ? { WebkitLineClamp: p.clamp } : undefined} data-clamp={!!p.clamp || undefined}>{children}</span>
      }
      case 'caption': return <span {...attrs} className="cs-caption">{children}</span>
      case 'strong': return <strong {...attrs}>{children}</strong>
      case 'emphasis': return <em {...attrs}>{children}</em>
      case 'badge': return <span {...attrs} className="cs-badge">{children}</span>
      case 'icon': return <span {...attrs} role={p.label ? 'img' : undefined} aria-label={p.label} aria-hidden={!p.label || undefined}><Icon name={p.name} size={p.size === 'large' ? 'xl' : 'md'} /></span>
      case 'button': case 'pressable': case 'chip': return <button {...attrs} type="button" className={`cs-button cs-${node.type}`} data-variant={p.variant || 'secondary'} data-selected={p.selected || undefined} aria-pressed={p.selected} aria-label={p.label} disabled={p.disabled} onClick={() => fire('onPress')}>{children.length ? children : p.label}</button>
      case 'input': case 'textarea': return <label {...attrs} className="cs-field" htmlFor={id}><span>{p.label}</span>{node.type === 'textarea'
        ? <textarea id={id} value={p.value ?? ''} placeholder={p.placeholder} disabled={p.disabled} onChange={(e) => fire('onChange', { value: e.target.value })} />
        : <input id={id} type={p.inputType || 'text'} value={p.value ?? ''} placeholder={p.placeholder} disabled={p.disabled} onChange={(e) => fire('onChange', { value: p.inputType === 'number' ? (e.target.value === '' ? 0 : Number(e.target.value)) : e.target.value, text: e.target.value })} />}</label>
      case 'checkbox': case 'toggle': return <label {...attrs} className="cs-check" htmlFor={id}><input id={id} type="checkbox" role={node.type === 'toggle' ? 'switch' : undefined} checked={p.checked || false} disabled={p.disabled} onChange={(e) => fire('onChange', { checked: e.target.checked, value: e.target.checked })} /><span>{p.label}</span></label>
      case 'segmented': case 'select': case 'radio-group': return <div {...attrs}><ChoiceGroup p={p} fire={fire} kind={node.type}/></div>
      case 'table': return <div {...attrs}><DataTable p={p} fire={fire}/></div>
      case 'popover': return <div {...attrs}><Popover p={p} fire={fire}>{children}</Popover></div>
      case 'swipe-stack': return <div {...attrs}><SwipeStack p={p} fire={fire} streaming={runtime.streaming}/></div>
      case 'confetti': return <Confetti p={p}/>
      case 'mermaid': return <div {...attrs}><Mermaid p={p} fire={fire} streaming={runtime.streaming}/></div>
      case 'math': return <MathNode p={p}/>
      case 'code': return p.block ? <pre {...attrs} className="cs-code-block"><code>{p.value??children}</code></pre> : <code {...attrs} className="cs-code">{p.value??children}</code>
      case 'progress': {
        const value = Math.max(0, Math.min(1, p.value || 0)), label = p.label || '进度'
        return <div {...attrs} className="cs-progress-field"><span>{label}</span><span aria-hidden="true">{Math.round(value * 100)}%</span><progress className="cs-progress" value={value} max="1" aria-label={label} /></div>
      }
      case 'clock': return <div {...attrs}><Clock {...p}/></div>
      case 'countdown': return <div {...attrs}><Countdown p={p}/></div>
      case 'copy': return <div {...attrs}><CopyText p={p} streaming={runtime.streaming}/></div>
      case 'heatmap': return <div {...attrs}><Heatmap p={p} fire={fire}/></div>
      case 'stat': return <div {...attrs} className="cs-stat"><strong>{scalar(p.value)}</strong><span>{p.label}</span></div>
      case 'divider': return <hr {...attrs} className="cs-divider" />
      case 'spacer': return <div {...attrs} className="cs-spacer" />
      case 'calendar': return <div {...attrs}><Calendar p={{...p,ownerId:node.id}} fire={fire} context={scope.context} /></div>
      case 'carousel': return <div {...attrs}><Carousel p={{...p,ownerId:node.id}} fire={fire} streaming={runtime.streaming}>{children}</Carousel></div>
      case 'slider': return <div {...attrs}><Slider p={p} fire={fire}/></div>
      case 'mindmap': case 'flowchart': return <div {...attrs}><Diagram type={node.type} p={p} fire={fire} streaming={runtime.streaming}/></div>
      case 'chart': return <div {...attrs}>{p.kind==='comparison'?<ComparisonChart p={p} fire={fire}/>:p.kind==='proportion'?<ProportionChart p={p} fire={fire}/>:p.kind==='stacked'||p.data.some(d=>d.series)?<SeriesChart p={p} fire={fire}/>:<Chart p={p} fire={fire}/>}</div>
      case 'image': return <div {...attrs} data-media-role={p.mediaRole || 'hero'}><ImageNode p={p} streaming={runtime.streaming} resource={runtime.resources?.[photoKey(p.query,p.mediaRole)] || runtime.resources?.[node.id]} /></div>
      case 'link': return safeLink(p.url) ? <a {...attrs} href={safeLink(p.url)} target="_blank" rel="noreferrer noopener" aria-label={p.label}>{children.length ? children : p.label || p.url}</a> : <span {...attrs}>链接不可用</span>
      default: throw new Error(`unsupported node ${node.type}`)
    }
  } catch (e) {
    return <NodeFailure error={e}/>
  }
}
function renderChildren(nodes, scope, runtime, prefix = '', groupItems = false) {
  return nodes.flatMap((node) => {
    const identity = `${prefix}/${node.id}`
    try {
    if(node.props?.visible && evaluate(node.props.visible,scope)===false) return []
    if(node.type==='if') return evaluate(node.props.test,scope) ? renderChildren(node.children,scope,runtime,identity,groupItems) : []
    if (node.type !== 'each') {
      let view=null
      if(runtime.page){const components=runtime.page.viewState.components||=(Object.create(null));view={values:components[identity]||=(Object.create(null)),save:()=>runtime.session?.save()}}
      return [<RenderBoundary key={identity} resetKey={scope}><ViewStateProvider value={view}><Node identity={identity} node={node} scope={scope} runtime={runtime}/></ViewStateProvider></RenderBoundary>]
    }
    const items = evaluate(node.props.items, scope)
    if (!Array.isArray(items) || items.length > 1000) throw new Error('invalid each collection')
    const hidden=filteredCollectionSources(runtime.spec,node.props.items,items,scope.bindings,scope)
    if(hidden.length&&runtime.session&&runtime.page?.spec===runtime.spec)return [<div key={identity} className="cs-filter-empty" role="status"><span>当前筛选未匹配已获取的结果，不代表来源没有结果。</span>{hidden.map(({id,count})=><button key={id} type="button" onClick={()=>runtime.session.openResults(id)}>查看已获取的 {count} 条结果</button>)}</div>]
    const as = node.props.as?.value || 'item'
    const rows=isolateCollectionRows(items,(item,index)=>evaluate(node.props.itemKey,{...scope,item,[as]:item,index}))
    return rows.flatMap(({item,index,key,error}) => {
      if(error)return [<NodeFailure key={`${identity}/@invalid-${index}`} error={`${node.id} row ${index+1}: ${error}`}/>]
      const childScope = { ...scope, item, [as]: item, index }
      const itemIdentity=`${identity}/${encodeURIComponent(key)}`
      const sourceLeases=[...(runtime.sourceLeases||[]),...(runtime.session?.sourceLeases(activeCollectionBindings(runtime.spec,node.props.items,scope,{rowsOnly:true}))||[])]
      const content=renderChildren(node.children, childScope, {...runtime,sourceLeases}, itemIdentity)
      return groupItems&&content.length?[<div className="cs-record-group" key={itemIdentity}>{content}</div>]:content
    })
    } catch(e) {
      return [<NodeFailure key={identity} error={`${node.id}: ${e.message}`}/>]
    }
  })
}

export function CardRenderer(props) {
  return <RenderBoundary resetKey={`${props.spec?.cardId}:${props.spec?.revision}`} fallback={<Recovery {...props.recovery} runtime error="卡片显示遇到异常，可重新生成或修改需求。"/>}><CardRendererBody {...props}/></RenderBoundary>
}
function CardRendererBody(props) {
  if(!props.spec)return <NavigationProvider><CardContent {...props}/></NavigationProvider>
  return <ToolCard key={props.spec.cardId} {...props}>{({page,session,streaming,footer,overlay})=><NavigationProvider key={page.id}><CardContent {...props} spec={page.spec} resources={page.resources} page={page} session={session} streaming={streaming} footer={footer} overlay={overlay}/></NavigationProvider>}</ToolCard>
}
function CardContent({ spec, resources = {}, streaming = false, onPaint, onLayout,page,session,footer,overlay,materialPreview='enhanced' }) {
  const cardSize=useCardSize(),motionLevel=useMotionPreference()
  const stores = useRef(new Map()), stage = useRef(null), painted = useRef(false)
  const [, refresh] = useReducer((n) => n + 1, 0), [error, setError] = useState('')
  const [accessories, setAccessories] = useState([])
  const design = getDesign(spec?.design)
  const template = projectTemplate(spec?.children,materialPreview==='classic'?undefined:spec?.design)
  const composition=materialPreview==='classic'||materialPreview==='template-v1'?null:projectComposition(spec?.children,spec?.design||'default',spec?.composition)
  const visualStyle = VISUAL_STYLE_IDS.includes(spec?.visualStyle) ? spec.visualStyle : design?.material
  const background = useBackgroundPhoto(spec?.backgroundQuery, resources[photoKey(spec?.backgroundQuery, 'background')], streaming, !!visualStyle)
  useEffect(()=>{
    if(streaming||!page)return
    let changed=false
    if(!page.viewState.designSelection){page.viewState.designSelection={version:2,design:spec.design||'default',composition:composition?.id||'legacy',palette:spec.palette,visualStyle,backgroundQuery:spec.backgroundQuery,crop:spec.backgroundPosition||'center',mask:spec.backgroundMask||'spotlight',motion:motionLevel};changed=true}
    const key=photoKey(spec.backgroundQuery,'background')
    if(background.resource&&!page.resources[key]){page.resources[key]=background.resource;changed=true}
    if(changed)session?.save()
  },[streaming,page?.id,background.resource])
  const creditUrl = safeLink(background.resource?.photoUrl) || safeLink(background.resource?.photographerUrl)
  const creditVisible = visualStyle && background.status === 'loaded' && (background.resource?.provider === 'Pexels' || background.resource?.photographer || creditUrl)
  useEffect(() => attachContentMotion(stage.current), [])
  useLayoutEffect(() => attachComposition(stage.current), [])
  useLayoutEffect(() => attachScrollAffordances(stage.current), [])
  useEffect(()=>{
    if(streaming||!page||page.experienceRenderDiagnostics?.[cardSize])return
    const timer=setTimeout(()=>{const metrics=measureExperience(stage.current);if(!metrics)return
      page.experienceRenderDiagnostics={...page.experienceRenderDiagnostics,[cardSize]:metrics}
      stage.current.dataset.experienceMetrics=JSON.stringify(metrics);session?.save()
    },250)
    return()=>clearTimeout(timer)
  },[streaming,page?.id,cardSize])
  if (spec && !stores.current.has(spec.cardId)) stores.current.set(spec.cardId, createStore())
  useLayoutEffect(() => attachLayout(stage.current, (detail) => {
    if(detail.size==='auto')setAccessories(ids=>ids.length?[]:ids)
    else if (detail.accessoryIds?.length) setAccessories((ids) => [...new Set([...ids, ...detail.accessoryIds])])
    onLayout?.(detail)
  }), [])
  useEffect(() => {
    if (!spec || !spec.children.length || painted.current) return
    let second = 0
    const frame = requestAnimationFrame(() => { second = requestAnimationFrame(() => { painted.current = true; onPaint?.(performance.now()) }) })
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(second) }
  }, [spec?.revision])
  let children, accessoryContent
  try {
    if (spec) {
      const store = page?.store||stores.current.get(spec.cardId), scope = makeScope(spec, store,{bindings:page?.bindings})
      const runtime = { spec, store, resources, streaming,page,session,fire:session?((action,extra)=>session.fire(action,extra)):null,notify: () => { setError(''); refresh() }, error: setError }
      if(composition){
        children=<CompositionLayout composition={composition} header={renderChildren(composition.header,scope,runtime)} items={composition.body.flatMap(node=>renderChildren([node],scope,runtime,'',true).map(content=>({id:content.key||node.id,type:node.type,content})))} controls={renderChildren(composition.controls,scope,runtime)} footer={renderChildren(composition.footer,scope,runtime)} page={page} session={session}/>
      }else if(template.id!=='default'){
        children=<TemplateLayout id={template.id} header={renderChildren(template.header,scope,runtime)} page={page} session={session}>{template.body.map(node=><div className="cs-template-item" data-template-role={templateRole(node)} key={node.id}>{renderChildren([node],scope,runtime)}</div>)}</TemplateLayout>
      }else{
        children = renderChildren(spec.children.filter((n) => !accessories.includes(n.id)), scope, runtime)
        accessoryContent = renderChildren(spec.children.filter((n) => accessories.includes(n.id)), scope, runtime)
      }
    }
  } catch (e) { children = <div className="cs-error" data-cs-error="">{e.message}</div> }
  return <div className="cs-shell"><div ref={stage} className="dil-stage cs-stage" data-composition-version={composition?2:undefined} data-composition-family={composition?.family} data-layout-template={composition?"default":template.id} data-template-reason={template.reason} data-motion-level={motionLevel} data-material-version={materialPreview==='classic'?'1':'2'} data-card-size={cardSize} data-theme={spec?.theme || 'editorial'} data-palette={spec?.palette || 'a'} data-streaming={streaming || undefined} data-visual-style={visualStyle} data-design={design ? spec.design : undefined} style={design ? {...design.tokens, colorScheme:design.scheme} : undefined}>
    {visualStyle && <div className="cs-background" data-status={background.status} data-position={spec.backgroundPosition || 'center'} aria-hidden="true">
      <PhotoStage photo={background} crop={spec.backgroundPosition} mask={spec.backgroundMask}/><div className="cs-background-scrim"/><div className="cs-ambient"/>{!composition&&template.id==='default'&&materialPreview!=='classic'&&design?.effect&&<HostEffect kind={design.effect}/>}
    </div>}
    <div className="cs-card">{children}</div>
    {footer}{overlay}
    {streaming && <Thinking placement="card" empty={!spec?.children?.length} />}
    {error && <div className="cs-action-error" role="alert">{error}</div>}
  </div><EvidenceSources research={spec?.research}/>{creditVisible && <small className="cs-background-credit">背景摄影：{creditUrl
    ? <a href={creditUrl} target="_blank" rel="noreferrer noopener">{background.resource.photographer || '摄影作者'}</a>
    : background.resource?.photographer || '摄影作者'}{background.resource?.provider === 'Pexels' && <> · <a href="https://www.pexels.com" target="_blank" rel="noreferrer noopener">Pexels</a></>}</small>}{accessoryContent?.length > 0 && <div className="cs-accessory" data-cs-accessory="">{accessoryContent}</div>}</div>
}
