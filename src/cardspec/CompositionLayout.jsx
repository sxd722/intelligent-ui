import React,{useLayoutEffect,useRef,useState} from 'react'
import './compositions.css'
import {ExternalPageDots,usePageSwipe} from './PageDots.jsx'
import {usePageTransition} from './page-transition.jsx'
import {useCardSize} from '../CardSize.jsx'

// Nodes stay mounted exactly once. Pagination changes visibility, never scopes,
// IDs or state. Essential controls/actions are outside the paginated body.
export function CompositionLayout({composition,header,items,controls,footer,page,session}){
 const root=useRef(null),body=useRef(null),[groups,setGroups]=useState([]),[index,setIndex]=useState(0)
 const anchor=useRef(page?.viewState?.compositionAnchor||'')
 const size=useCardSize(),transition=usePageTransition(body,index)
 useLayoutEffect(()=>{
  const el=body.current;if(!el)return;let frame=0,disposed=false
  const fit=()=>{frame=0;if(disposed||!el.clientWidth)return
   const nodes=[...el.children];nodes.forEach(n=>{n.hidden=false})
   const heights=nodes.map(n=>n.getBoundingClientRect().height),gap=6
   const total=heights.reduce((a,h)=>a+h,0)+Math.max(0,nodes.length-1)*gap
   if(size==='auto'){
    const stage=root.current.closest('.cs-stage'),host=stage?.querySelector(':scope > .cs-host-controls')
    const cap=Math.max(220,Math.min(780,window.innerHeight-(stage?.closest('.card-focus--open')?100:24))-(host?.getBoundingClientRect().height||0))
    const chrome=root.current.getBoundingClientRect().height-el.clientHeight
    root.current.style.height=Math.min(cap,Math.max(280,total+chrome))+'px'
   }else root.current.style.height=''
   const available=el.clientHeight
   const next=[];let current=[],used=0;const limit=available
   nodes.forEach((n,i)=>{const h=heights[i];if(!h)return;if(current.length&&used+h+gap>limit){next.push(current);current=[];used=0}current.push(n.dataset.item);used+=h+(current.length>1?gap:0)})
   if(current.length)next.push(current);if(!next.length)next.push([])
   const selected=Math.max(0,next.findIndex(g=>g.includes(anchor.current)))
   nodes.forEach(n=>{n.hidden=!next[selected].includes(n.dataset.item)})
   el.dataset.paginated=String(next.length>1)
   setGroups(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);setIndex(selected)
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(fit)}
  // Watching hidden items would create a resize loop while measuring pages.
  const observer=new ResizeObserver(schedule);observer.observe(el)
  const mutation=new MutationObserver(schedule);mutation.observe(el,{subtree:true,childList:true,characterData:true})
  el.addEventListener('load',schedule,true);document.fonts?.ready.then(schedule)
  schedule();return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();mutation.disconnect();el.removeEventListener('load',schedule,true)}
 },[page?.id,items.map(i=>i.id).join('|'),size])
 const move=to=>transition(to,()=>{anchor.current=groups[to]?.[0]||'';setIndex(to);if(page){page.viewState.compositionAnchor=anchor.current;session?.save()}})
 const swipe=usePageSwipe(groups.length,index,move)
 return <div ref={root} className="cs-composition" data-composition-kind={composition.id} data-family={composition.family}>
  <header className="cs-composition-heading">{header}</header>
  <section className="cs-composition-middle" {...swipe}>
   <div ref={body} className="cs-composition-body" data-paginated={groups.length>1} data-layout-scroll="none" aria-label="主体内容">
    {items.map(item=><div key={item.id} data-item={item.id} className="cs-composition-item" data-kind={item.type} hidden={groups.length>0&&!groups[index]?.includes(item.id)}>{item.content}</div>)}
   </div>
   <ExternalPageDots count={groups.length} index={index} onChange={move} label="内容分步" className="cs-composition-pages"/>
  </section>
  {!!controls.length&&<div className="cs-composition-controls">{controls}</div>}
  {!!footer.length&&<footer className="cs-composition-actions">{footer}</footer>}
 </div>
}
