import {effectiveMotion} from '../motion-preference.mjs'
import React, { useEffect, useId, useRef, useState } from 'react'
import { diagramLayout,chartNumber } from '../../shared/cardspec/widgets.mjs'
import { NavigationBar, useNavigationOwner } from './Navigation.jsx'
import { useIntrinsicHeight } from './sizing.js'
import { useViewState } from './view-state.jsx'
import {useChartMotion} from './useChartMotion.js'
import {useGraphicMotion} from './useGraphicMotion.js'

export function Carousel({ p, fire, children, streaming }) {
  const track = useRef(null), activeRef = useRef(0), [active, setActive] = useState(0)
  const count = children.length
  const size=useIntrinsicHeight(track,streaming,el=>Math.max(48,...[...el.children].map(slide=>{
    const style=getComputedStyle(slide)
    return (slide.firstElementChild?.getBoundingClientRect().height||0)+parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)+parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth)+1
  })))
  const go = (next) => {
    const index = Math.max(0, Math.min(count - 1, next)), el = track.current, slide = el?.children[index]
    if (slide) el.scrollTo({ left: slide.offsetLeft - el.children[0].offsetLeft, behavior: effectiveMotion()==='off' ? 'instant' : 'smooth' })
  }
  useEffect(() => {
    const el = track.current
    const update = () => {
      const slides = [...el.children]
      const next = slides.reduce((best, slide, index) => Math.abs(slide.offsetLeft - slides[0].offsetLeft - el.scrollLeft) < Math.abs(slides[best].offsetLeft - slides[0].offsetLeft - el.scrollLeft) ? index : best, 0)
      setActive(next)
      if (activeRef.current !== next) { activeRef.current = next; fire('onIndexChange', { index: next, value: next }) }
    }
    el.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update); observer.observe(el); update()
    return () => { el.removeEventListener('scroll', update); observer.disconnect() }
  }, [count, fire])
  useEffect(() => { if (p.index != null && p.index !== activeRef.current) go(p.index) }, [p.index, count])
  const navigation={label:`${p.label || '展示'}分页`,value:`${count ? active+1 : 0} / ${count} · 左右滑动`,count,previousLabel:'上一项',nextLabel:'下一项',previousText:'‹',nextText:'›',disabledPrevious:active===0 || !count,disabledNext:active>=count-1,previous:()=>go(active-1),next:()=>go(active+1)}
  const builtIn=useNavigationOwner(p.ownerId,p.navigation==='external',navigation)
  return <section className="cs-carousel" role="region" aria-roledescription="carousel" aria-label={p.label || '滑动展示'} data-active-index={active}>
    <div className="cs-carousel-track" ref={track} style={size.height?{height:size.height}:undefined} data-content-height={size.height} tabIndex={0} onKeyDown={(e) => {
      if (e.target !== e.currentTarget) return
      const next = e.key === 'ArrowRight' ? active + 1 : e.key === 'ArrowLeft' ? active - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? count - 1 : null
      if (next != null) { e.preventDefault(); go(next) }
    }}>{children.map((child, index) => <div className="cs-slide" key={child.key || index} role="group" aria-roledescription="slide" aria-label={`${index + 1} / ${count}`}>{child}</div>)}</div>
    {builtIn && <NavigationBar model={navigation} className="cs-carousel-nav"/>}
  </section>
}

export function Slider({ p, fire }) {
  const id = useId(), value = p.value ?? p.min ?? 0
  return <label className="cs-slider" htmlFor={id}><span>{p.label} <output>{value}{p.unit || ''}</output></span><input id={id} type="range" min={p.min ?? 0} max={p.max ?? 100} step={p.step ?? 1} value={value} disabled={p.disabled} aria-valuetext={`${value}${p.unit || ''}`} onChange={(e) => fire('onChange', { value: Number(e.target.value) })}/><span className="cs-range-labels"><span>{p.min ?? 0}</span><span>{p.max ?? 100}{p.unit || ''}</span></span></label>
}

export function Diagram({ type, p, fire, streaming }) {
  const [local,setLocal]=useViewState('selection',null),[zoom,setZoom]=useViewState('zoom',1),pan=useRef(null),caption=useRef(null),arrow=useId().replace(/:/g,'')
  const direction=p.direction || (type==='mindmap'?'horizontal':'vertical')
  const size=useIntrinsicHeight(pan,streaming,(_el,width)=>{
    const layout=diagramLayout(type,p.nodes,p.edges,direction,{width,height:Math.max(128,width-120)})
    return layout.height*Math.max(.85,Math.min(1,width/layout.width))
  })
  const width=size.width||296,graph=diagramLayout(type,p.nodes,p.edges,direction,{width,height:Math.max(128,width-120)}),fit=Math.min(1,width/graph.width),scale=Math.max(.85,fit)*zoom
  const captionSize=useIntrinsicHeight(caption,streaming,el=>Math.max(22,...[...el.querySelectorAll('[data-measure-description]')].map(n=>n.getBoundingClientRect().height)))
  const paintedNodes=useGraphicMotion(graph.nodes,['x','y','value'],pan)
  const selected=p.selectedId??local,positions=new Map(paintedNodes.map(n=>[n.id,n])),selectedNode=graph.nodes.find(n=>n.id===selected)
  const related=new Set(graph.edges.filter(e=>e.from===selected||e.to===selected).flatMap(e=>[e.from,e.to]))
  const maxWeight=Math.max(1e-12,...graph.edges.map(e=>Math.abs(e.value||0)))
  const reset=()=>{setZoom(1);pan.current?.scrollTo({left:0,top:0,behavior:'instant'})}
  return <section className="cs-diagram" aria-label={p.label} data-overview={fit>=.85}>
    <header><strong>{p.label}</strong><span><button type="button" aria-label="缩小图形" disabled={zoom<=1} onClick={()=>setZoom(n=>Math.max(1,n-.25))}>−</button><button type="button" aria-label="重置缩放" onClick={reset}>{zoom===1?'全貌':Math.round(zoom*100)+'%'}</button><button type="button" aria-label="放大图形" disabled={zoom>=2} onClick={()=>setZoom(n=>Math.min(2,n+.25))}>＋</button></span></header>
    <div className="cs-diagram-pan" ref={pan} style={{height:size.height||graph.height*scale}} data-content-height={size.height} tabIndex={0} aria-label={`${p.label}，全貌与缩放浏览`}><div className="cs-diagram-frame" style={{width:graph.width*scale,height:graph.height*scale}}><div className="cs-diagram-canvas" style={{width:graph.width,height:graph.height,transform:`scale(${scale})`}}>
      <svg width={graph.width} height={graph.height} aria-hidden="true"><defs><marker id={arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/></marker></defs>{graph.edges.map((e,index)=>{
        const a=positions.get(e.from),b=positions.get(e.to),vertical=graph.vertical,back=vertical?b.y<=a.y:b.x<a.x
        const x1=a.x+(vertical?graph.nodeWidth/2:back?0:graph.nodeWidth),y1=a.y+(vertical?graph.nodeHeight:graph.nodeHeight/2),x2=b.x+(vertical?graph.nodeWidth/2:back?graph.nodeWidth:0),y2=b.y+(vertical?0:graph.nodeHeight/2)
        const bend=Math.max(a.x,b.x)+graph.nodeWidth+14
        const d=vertical&&back?`M${a.x+graph.nodeWidth},${a.y+graph.nodeHeight/2} C${bend},${a.y+graph.nodeHeight/2} ${bend},${b.y+graph.nodeHeight/2} ${b.x+graph.nodeWidth},${b.y+graph.nodeHeight/2}`:vertical?`M${x1},${y1} C${x1},${(y1+y2)/2} ${x2},${(y1+y2)/2} ${x2},${y2}`:`M${x1},${y1} C${(x1+x2)/2},${y1} ${(x1+x2)/2},${y2} ${x2},${y2}`
        return <g key={`${e.from}:${e.to}:${index}`} className="cs-diagram-edge" data-related={selectedNode?(e.from===selected||e.to===selected):undefined}><path d={d} fill="none" stroke={e.value==null?"currentColor":e.value<0?"#a798df":"#329d88"} strokeWidth={e.value==null?1.25:Math.max(.6,Math.abs(e.value)/maxWeight*4)} markerEnd={type==='flowchart'?`url(#${arrow})`:undefined}/>{e.label&&<text x={vertical&&back?bend-2:(x1+x2)/2} y={vertical&&back?(a.y+b.y+graph.nodeHeight)/2+4:(y1+y2)/2+(vertical?4:-4)} textAnchor={vertical&&back?'end':'middle'}>{e.label}</text>}</g>
      })}</svg>
      {paintedNodes.map(n=><button type="button" key={n.id} className="cs-diagram-node" style={{left:n.x,top:n.y,width:graph.nodeWidth,height:graph.nodeHeight}} data-related={selectedNode?related.has(n.id):undefined} data-selected={selected===n.id||undefined} aria-pressed={selected===n.id} title={n.label} data-graphic-id={n.id} onClick={()=>{if(fire('onSelect',{id:n.id,value:n.id})!==false)setLocal(n.id)}}>{n.label}{n.value!=null&&<small style={{display:"block",fontVariantNumeric:"tabular-nums"}}>{Number(graph.nodes.find(v=>v.id===n.id).value.toPrecision(3))}</small>}</button>)}
    </div></div></div>
    {p.detailMode!=='external'&&<div ref={caption} className="cs-diagram-description" style={{height:captionSize.height||22}}>
      <div className="cs-widget-caption" aria-live="polite">{selectedNode?`${selectedNode.label}${selectedNode.description?' · '+selectedNode.description:''}`:fit>=.85?'点击节点查看说明':'节点较多，可滑动查看；点击节点阅读完整说明'}</div>
      <div className="cs-diagram-measure" aria-hidden="true">{p.nodes.map(n=><div data-measure-description key={n.id}>{n.label}{n.description?' · '+n.description:''}</div>)}</div>
    </div>}
  </section>
}

export function Chart({ p, fire }) {
  const paintRef=useRef(null)
  const [local, setLocal] = useViewState('selection',null), selected = p.selectedId ?? local, data = useChartMotion(p.data,paintRef)
  const width = Math.max(260, data.length * 72), height = 124, bottom = Math.min(0, ...data.map((d) => d.value)), top = Math.max(0, ...data.map((d) => d.value)), span = top - bottom || 1
  const y = (value) => 8 + (top - value) / span * 100, x = (index) => (index + .5) * width / Math.max(1, data.length)
  const pick = (point) => { if(fire('onSelect', { id:point.id, value:point.value, label:point.label,series:point.series||'',recordIds:point.recordIds||[] })!==false)setLocal(point.id) }
  return <section ref={paintRef} className="cs-chart" aria-label={p.label}><strong>{p.label}{p.unit ? `（${p.unit}）` : ''}</strong>{data.length ? <div className="cs-chart-pan" tabIndex={0} aria-label="图表数据，左右滑动"><div style={{ width, minWidth:'100%' }}>
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${p.label}，${data.length}项数据，数值范围${bottom}至${top}`}>
      <line x1="0" x2={width} y1={y(0)} y2={y(0)} stroke="currentColor" opacity=".3"/>
      {p.kind === 'line' && <polyline points={data.map((d,i)=>`${x(i)},${y(d.value)}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2"/>}
      {data.map((point,index) => <g key={point.id} className="cs-chart-mark" data-selected={selected === point.id || undefined}>{p.kind === 'line' ? <circle cx={x(index)} cy={y(point.value)} r={selected === point.id ? 5 : 3} fill="currentColor"/> : <rect x={x(index)-18} y={Math.min(y(0),y(point.value))} width="36" height={Math.max(1,Math.abs(y(point.value)-y(0)))} rx="3" fill="currentColor"/>}</g>)}
    </svg><div className="cs-chart-labels" style={{ gridTemplateColumns:`repeat(${data.length},minmax(0,1fr))` }}>{p.data.map((point) => <button type="button" key={point.id} title={String(point.value)} aria-label={`${point.label} ${point.value}${p.unit || ''}`} aria-pressed={selected === point.id} data-selected={selected === point.id || undefined} onClick={() => pick(point)}><span>{point.label}</span><b>{chartNumber(point.value)}{p.unit || ''}</b></button>)}</div>
  </div></div> : <p>暂无数据</p>}</section>
}
