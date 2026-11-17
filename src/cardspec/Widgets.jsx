import {diagramWindow} from '../../shared/cardspec/diagram-window.mjs'
import {CompactChart} from './CompactChart.jsx'

import React, { useEffect, useId, useRef, useState } from 'react'
import { diagramLayout } from '../../shared/cardspec/widgets.mjs'

import { useIntrinsicHeight } from './sizing.js'
import { useViewState } from './view-state.jsx'
import {useGraphicMotion} from './useGraphicMotion.js'

export {Carousel} from './CarouselDial.jsx'

export function Slider({ p, fire }) {
  const id = useId(), value = p.value ?? p.min ?? 0
  return <label className="cs-slider" htmlFor={id}><span>{p.label} <output>{value}{p.unit || ''}</output></span><input id={id} type="range" aria-label={p.label || undefined} min={p.min ?? 0} max={p.max ?? 100} step={p.step ?? 1} value={value} disabled={p.disabled} aria-valuetext={`${value}${p.unit || ''}`} onChange={(e) => fire('onChange', { value: Number(e.target.value) })}/><span className="cs-range-labels"><span>{p.min ?? 0}</span><span>{p.max ?? 100}{p.unit || ''}</span></span></label>
}

export function Diagram({ type, p, fire, streaming }) {
  const [local,setLocal]=useViewState('selection',null),[zoom,setZoom]=useViewState('zoom',1),pan=useRef(null),caption=useRef(null),arrow=useId().replace(/:/g,'')
  const [overview,setOverview]=useViewState('overview',p.view==='overview')
  const selected=p.selectedId??local??p.nodes[0]?.id,focused=!overview&&(p.view==='focus'||p.nodes.length>8)
  const windowed=diagramWindow(type,p.nodes,p.edges,selected,focused)
  const direction=p.direction || (type==='mindmap'?'horizontal':'vertical')
  const size=useIntrinsicHeight(pan,streaming,(_el,width)=>{
    const variants=focused?p.nodes.map(n=>diagramWindow(type,p.nodes,p.edges,n.id,true)):[windowed]
    return Math.max(...variants.map(v=>{const g=diagramLayout(type,v.nodes,v.edges,direction,{width,height:Math.max(128,width-120)});return g.height*Math.min(1,width/g.width)}))
  },JSON.stringify([focused,p.nodes.map(n=>[n.id,n.label,n.parentId]),p.edges]))
  const width=size.width||296,graph=diagramLayout(type,windowed.nodes,windowed.edges,direction,{width,height:Math.max(128,width-120)}),fit=Math.min(1,width/graph.width),scale=fit*zoom
  const captionSize=useIntrinsicHeight(caption,streaming,el=>Math.max(22,...[...el.querySelectorAll('[data-measure-description]')].map(n=>n.getBoundingClientRect().height)))
  const paintedNodes=useGraphicMotion(graph.nodes,['x','y','value'],pan)
  const positions=new Map(paintedNodes.map(n=>[n.id,n])),selectedNode=graph.nodes.find(n=>n.id===selected)
  const related=new Set(graph.edges.filter(e=>e.from===selected||e.to===selected).flatMap(e=>[e.from,e.to]))
  const maxWeight=Math.max(1e-12,...graph.edges.map(e=>Math.abs(e.value||0)))
  const reset=()=>{setZoom(1);pan.current?.scrollTo({left:0,top:0,behavior:'instant'})}
  return <section className="cs-diagram" aria-label={p.label} data-overview={fit>=.85}>
    <header><strong>{p.label}</strong><span><button type="button" aria-label="缩小图形" disabled={zoom<=1} onClick={()=>setZoom(n=>Math.max(1,n-.25))}>−</button><button type="button" aria-label="重置缩放" onClick={reset}>{zoom===1?'全貌':Math.round(zoom*100)+'%'}</button><button type="button" aria-label="放大图形" disabled={zoom>=2} onClick={()=>setZoom(n=>Math.min(2,n+.25))}>＋</button></span></header>
    <div className="cs-diagram-focus"><select aria-label="图谱焦点" value={selected} onChange={e=>{if(fire('onSelect',{id:e.target.value,value:e.target.value})!==false)setLocal(e.target.value)}}>{p.nodes.map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</select>{p.nodes.length>8&&<button type="button" onClick={()=>{setOverview(v=>!v);setZoom(1)}}>{focused?`查看全图 · ${p.nodes.length}节点`:'聚焦关联'}</button>}{focused&&<small>{windowed.nodes.length}/{p.nodes.length} 节点 · 当前关联</small>}</div>
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

export function Chart(props) { return <CompactChart {...props}/> }
