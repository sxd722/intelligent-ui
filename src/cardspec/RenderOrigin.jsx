import React,{useLayoutEffect,useState} from 'react'
import './render-origin.css'

// Inspection is host-only: it never reads frame contents or changes model state.
export function RenderOrigin({root,pageId}){
 const [enabled,setEnabled]=useState(false),[regions,setRegions]=useState([])
 useLayoutEffect(()=>{
  if(!enabled)return
  const host=root.current;if(!host)return
  let frame=0
  const measure=()=>{
   frame=0
   const stage=host.querySelector('.cs-stage'),card=stage?.querySelector('.cs-card')
   if(!card){setRegions([]);return}
   const origin=host.getBoundingClientRect(),bounds=stage.getBoundingClientRect()
   const web=[...card.querySelectorAll('.cs-sandbox,.cs-web-sandbox')].filter(el=>!el.parentElement.closest('.cs-sandbox,.cs-web-sandbox'))
   const native=[...card.children].filter(el=>!web.includes(el)&&!web.some(w=>el.contains(w)))
   const nested=[...card.querySelectorAll('[data-cs-component],.nd-view,.cs-tool-view')].filter(el=>!el.closest('.cs-sandbox,.cs-web-sandbox')&&!web.some(w=>el.contains(w))&&!native.some(n=>n.contains(el)))
   const nodes=[...native,...nested.filter(el=>!nested.some(other=>other!==el&&other.contains(el))),...web]
   const next=nodes.flatMap((el,i)=>{
    const r=el.getBoundingClientRect(),style=getComputedStyle(el),left=Math.max(r.left,bounds.left),top=Math.max(r.top,bounds.top),right=Math.min(r.right,bounds.right),bottom=Math.min(r.bottom,bounds.bottom)
    if(right-left<2||bottom-top<2||style.visibility==='hidden'||style.display==='none')return []
    const isWeb=web.includes(el),component=el.matches('.nd-view,.cs-tool-view')?'tool-view · 宿主复合组件':el.dataset.csComponent||'原生组件'
    return [{id:i,web:isWeb,label:isWeb?'Web · '+(el.dataset.csNode||'sandbox'):'CardSpec · '+component,left:left-origin.left,top:top-origin.top,width:right-left,height:bottom-top}]
   })
   setRegions(old=>JSON.stringify(old)===JSON.stringify(next)?old:next)
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure)}
  const ro=new ResizeObserver(schedule);ro.observe(host)
  // Only observe the rendered card, never this inspector's own overlay.
  const stage=host.querySelector('.cs-stage'),mo=new MutationObserver(schedule)
  if(stage){mo.observe(stage,{subtree:true,childList:true,attributes:true});ro.observe(stage)}
  host.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);measure()
  return()=>{cancelAnimationFrame(frame);ro.disconnect();mo.disconnect();host.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule)}
 },[enabled,pageId,root])
 return <><div className="cs-render-origin-control" data-host-inspector="true"><button type="button" aria-pressed={enabled} onClick={()=>setEnabled(v=>!v)}>标注 CardSpec / Web</button>{enabled&&<small>蓝：宿主原生组件 · 紫：Web 沙箱{regions.length&&!regions.some(r=>r.web)?' · 当前可见区域无 Web':''}</small>}</div>{enabled&&<div className="cs-render-origin-overlay" aria-hidden="true">{regions.map(r=><div key={r.id} className="cs-render-origin-region" data-web={r.web} style={{left:r.left,top:r.top,width:r.width,height:r.height}}><span>{r.label}</span></div>)}</div>}</>
}
