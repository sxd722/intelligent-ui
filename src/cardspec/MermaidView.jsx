import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useViewState } from './view-state.jsx'
import DOMPurify from 'dompurify'
import { renderDiagram } from '../../shared/cardspec/mermaid-render.mjs'

export default function MermaidView({p,fire,streaming}) {
  const prefix=useId().replace(/:/g,''),surface=useRef(null),viewport=useRef(null),dialog=useRef(null),[width,setWidth]=useState(296),[available,setAvailable]=useState(180),[zoom,setZoom]=useViewState('zoom',1),[local,setLocal]=useViewState('selection',null),[expanded,setExpanded]=useState(false),fireRef=useRef(fire)
  fireRef.current=fire
  const diagram=useMemo(()=>{
    if(streaming)return null
    try {
      const d=renderDiagram(p.source)
      let svg=DOMPurify.sanitize(d.svg.replace(/<style>[\s\S]*?<\/style>/g,''),{USE_PROFILES:{svg:true,svgFilters:true},FORBID_TAGS:['foreignObject','a','image','use','script','style']})
      // Library marker IDs are document-global; namespace every reference per instance.
      svg=svg.replace(/id="([^"]+)"/g,(all,id)=>all.startsWith('id=')?`id="${prefix}-${id}"`:all)
        .replace(/url\(#([^)]*)\)/g,(_,id)=>`url(#${prefix}-${id})`)
      // data-id belongs to the business payload, not the SVG ID namespace.
      svg=svg.replace(new RegExp(`data-id="${prefix}-`,'g'),'data-id="')
      return {...d,svg}
    } catch(e) {return {error:e.message}}
  },[p.source,streaming,prefix])
  useLayoutEffect(()=>{
    const el=viewport.current;if(!el)return
    const card=el.closest('.cs-stage')?.querySelector('.cs-card'),header=el.previousElementSibling
    const measure=()=>{setWidth(el.clientWidth||296);if(!card)return
      let own=el;while(own.parentElement&&own.parentElement!==card)own=own.parentElement
      const style=getComputedStyle(card),siblings=[...card.children].filter(n=>n!==own)
      const used=siblings.reduce((h,n)=>h+n.getBoundingClientRect().height,0)+(parseFloat(style.gap)||0)*siblings.length
      setAvailable(Math.max(96,card.clientHeight-used-(parseFloat(style.paddingTop)||0)-(parseFloat(style.paddingBottom)||0)-(header?.getBoundingClientRect().height||40)-56))
    }
    const observer=new ResizeObserver(measure);observer.observe(el);if(header)observer.observe(header);if(card){observer.observe(card);[...card.children].forEach(n=>observer.observe(n))}measure()
    return()=>observer.disconnect()
  },[!!diagram,expanded])
  const selected=p.selectedId??local
  useEffect(()=>{
    const root=surface.current;if(!root||!diagram||diagram.error)return
    const nodes=[...root.querySelectorAll('g.node,g.actor,g.class-node,g.entity')]
    const edges=[...root.querySelectorAll('[data-from][data-to]')],related=new Set([selected])
    edges.forEach(e=>{const active=e.dataset.from===selected||e.dataset.to===selected;if(active){related.add(e.dataset.from);related.add(e.dataset.to)}if(selected)e.dataset.related=String(active);else delete e.dataset.related})
    nodes.forEach(n=>{if(selected)n.dataset.related=String(related.has(n.dataset.id));else delete n.dataset.related})
    nodes.forEach(n=>{n.setAttribute('role','button');n.setAttribute('tabindex','0');n.setAttribute('aria-label',n.dataset.label||n.dataset.id);n.setAttribute('aria-pressed',String(n.dataset.id===selected));n.dataset.selected=String(n.dataset.id===selected)})
    const choose=e=>{const n=e.target.closest('g[data-id]');if(!n||!nodes.includes(n))return
      if(e.type==='keydown'&&!['Enter',' '].includes(e.key))return
      e.preventDefault();if(fireRef.current('onSelect',{id:n.dataset.id,value:n.dataset.id,label:n.dataset.label||n.dataset.id})!==false)setLocal(n.dataset.id)
    }
    root.addEventListener('click',choose);root.addEventListener('keydown',choose)
    return()=>{root.removeEventListener('click',choose);root.removeEventListener('keydown',choose)}
  },[diagram,selected,expanded])
  useEffect(()=>{setZoom(1);setLocal(null)},[p.source])
  useEffect(()=>{if(expanded&&!dialog.current.open)dialog.current.showModal();else if(!expanded&&dialog.current.open)dialog.current.close()},[expanded])
  if(!diagram)return <span role="status">图形排版中…</span>
  if(diagram.error)return <span data-cs-error="" role="status">图形错误：{diagram.error}</span>
  // Fit both axes and reserve header + selection space. Zoom is auxiliary;
  // choosing a node must not change the card's height or force a second scroll.
  const budget=expanded?innerHeight*.68:available
  const fit=Math.min(1,width/diagram.width,budget/diagram.height),scale=fit*zoom,height=Math.max(96,diagram.height*fit)
  const graph=<><header><strong>{p.label}</strong><span><button type="button" aria-label="缩小图形" disabled={zoom<=1} onClick={()=>setZoom(n=>Math.max(1,n-.25))}>−</button><button type="button" aria-label="图形全貌" onClick={()=>{setZoom(1);viewport.current?.scrollTo(0,0)}}>{zoom===1?'全貌':`${Math.round(zoom*100)}%`}</button><button type="button" aria-label="放大图形" disabled={zoom>=3} onClick={()=>setZoom(n=>Math.min(3,n+.25))}>＋</button><button type="button" aria-label={expanded?'收起图形':'展开图形'} onClick={()=>setExpanded(!expanded)}>{expanded?'收起':'展开'}</button></span></header>
    <div className="cs-mermaid-pan" ref={viewport} style={{height}} tabIndex={0} aria-label={`${p.label}，全貌与缩放浏览`}><div className="cs-mermaid-svg" ref={surface} style={{width:diagram.width*scale,height:diagram.height*scale}} dangerouslySetInnerHTML={{__html:diagram.svg}}/></div>
    {p.detailMode!=='external'&&<div className="cs-widget-caption" aria-live="polite">{selected?`已选择：${diagram.nodes.find(n=>n.id===selected)?.label||selected}`:diagram.nodes.length?'点击节点查看；展开可放大阅读':'示例数据图'}</div>}</>
  return <section className="cs-mermaid" aria-label={p.label}>
    {!expanded?graph:<button type="button" onClick={()=>setExpanded(false)}>收起 {p.label}</button>}
    <dialog ref={dialog} className="cs-mermaid-dialog cs-dialog" onCancel={()=>setExpanded(false)} onClose={()=>setExpanded(false)}>{expanded&&graph}</dialog>
  </section>
}
