import React,{useLayoutEffect,useRef,useState,useContext} from 'react'
import './compositions.css'
import {ExternalPageDots,usePageSwipe,PageDotsOutlet} from './PageDots.jsx'
import {usePageTransition} from './page-transition.jsx'
import {useCardSize} from '../CardSize.jsx'
import {blockBox,naturalCompositionHeight} from './layout-measure.js'
import {graphicBudgets} from '../../shared/cardspec/sandbox-graphic.mjs'

// Nodes stay mounted exactly once. Pagination changes visibility, never scopes,
// IDs or state. Essential controls/actions are outside the paginated body.
export function CompositionLayout({composition,header,items,controls,footer,page,session}){
 const root=useRef(null),body=useRef(null),[groups,setGroups]=useState([]),[index,setIndex]=useState(0)
 const anchor=useRef(page?.viewState?.compositionAnchor||'')
 const size=useCardSize(),transition=usePageTransition(body,index)
 const owner=useContext(PageDotsOutlet)
 useLayoutEffect(()=>{
  const el=body.current;if(!el)return;let frame=0,disposed=false
  const fit=()=>{frame=0;if(disposed||!el.clientWidth)return
   const nodes=[...el.children];nodes.forEach(n=>{n.hidden=false})
   if(size==='full'){
    root.current.style.height='auto';el.dataset.paginated='false'
    for(const panel of el.querySelectorAll('.cs-sandbox'))panel.style.removeProperty('--cs-graphic-budget')
    const next=[nodes.map(n=>n.dataset.item)];setGroups(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);setIndex(0);return
   }
   let heights=nodes.map(n=>blockBox(n).outer);const gap=parseFloat(getComputedStyle(el).rowGap)||0
   const graphics=nodes.flatMap((n,i)=>{
    if(n.dataset.kind!=='sandbox')return []
    const panel=n.querySelector('.cs-sandbox[data-sandbox-graphic="true"]'),frame=panel?.querySelector('iframe')
    if(!frame||!frame.offsetHeight)return []
    return [{i,panel,preferred:Number(panel.dataset.sandboxPreferredHeight)||320,chrome:heights[i]-blockBox(frame).height}]
   })
   // Natural sizing uses the requested height, not the previously fitted one;
   // otherwise parent/child measurements could progressively shrink the card.
   const demands=heights.slice();for(const g of graphics)demands[g.i]=g.preferred+g.chrome
   const total=demands.reduce((a,h)=>a+h,0)+Math.max(0,nodes.length-1)*gap
   if(size==='auto'){
    const stage=root.current.closest('.cs-stage'),host=stage?.querySelector(':scope > .cs-host-controls')
    const cap=Math.max(220,Math.min(780,window.innerHeight-(stage?.closest('.card-focus--open')?100:24))-(host?.getBoundingClientRect().height||0))
    const chrome=blockBox(root.current).height-blockBox(el).height
    const height=naturalCompositionHeight(total,chrome,cap,!!el.querySelector('[data-composition-space="fill"]'))+'px'
    if(root.current.style.height!==height)root.current.style.height=height
   }else root.current.style.height=''
   const available=blockBox(el).content
   if(graphics.length){
    const reserved=heights.reduce((sum,h,i)=>sum+(graphics.some(g=>g.i===i)?0:h),0)+graphics.reduce((sum,g)=>sum+g.chrome,0)+Math.max(0,nodes.length-1)*gap
    const budgets=graphicBudgets(graphics.map(g=>g.preferred),available-reserved)
    graphics.forEach((g,i)=>{const value=Math.floor(budgets[i])+'px';if(g.panel.style.getPropertyValue('--cs-graphic-budget')!==value)g.panel.style.setProperty('--cs-graphic-budget',value)})
    heights=nodes.map(n=>blockBox(n).outer)
   }
   const next=[];let current=[],used=0;const limit=available
   nodes.forEach((n,i)=>{const h=heights[i];if(!h)return;if(current.length&&used+h+gap>limit+1/64){next.push(current);current=[];used=0}current.push(n.dataset.item);used+=h+(current.length>1?gap:0)})
   if(current.length)next.push(current);if(!next.length)next.push([])
   const selected=Math.max(0,next.findIndex(g=>g.includes(anchor.current)))
   nodes.forEach(n=>{n.hidden=!next[selected].includes(n.dataset.item)})
   el.dataset.paginated=String(next.length>1)
   setGroups(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);setIndex(selected)
  }
  const schedule=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(fit)}
  // Watching hidden items would create a resize loop while measuring pages.
  const observer=new ResizeObserver(schedule);observer.observe(el)
  const mutation=new MutationObserver(schedule);mutation.observe(el,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-composition-space','data-sandbox-graphic','data-sandbox-preferred-height']})
  el.addEventListener('load',schedule,true);document.fonts?.ready.then(schedule);window.addEventListener('resize',schedule)
  schedule();return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();mutation.disconnect();el.removeEventListener('load',schedule,true);window.removeEventListener('resize',schedule)}
 },[page?.id,items.map(i=>i.id).join('|'),size])
 const move=to=>transition(to,()=>{anchor.current=groups[to]?.[0]||'';setIndex(to);if(page){page.viewState.compositionAnchor=anchor.current;session?.save()}})
 const swipe=usePageSwipe(owner?.register?0:groups.length,index,move)
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
