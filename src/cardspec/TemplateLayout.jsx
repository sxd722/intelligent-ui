import React,{useLayoutEffect,useRef} from 'react'
import {LAYOUT_TEMPLATES} from '../../shared/cardspec/layout-templates.mjs'
import {HostEffect} from './HostEffect.jsx'

// A single rendering of each native node. This component owns presentation only.
export function TemplateLayout({id,header,children,page,session}) {
 const body=useRef(null)
 useLayoutEffect(()=>{
  const el=body.current;if(!el)return
  el.scrollTop=Number(page?.viewState?.templateScroll)||0
  const save=()=>{if(page){page.viewState.templateScroll=el.scrollTop;session?.save()}}
  el.addEventListener('scroll',save,{passive:true})
  return()=>el.removeEventListener('scroll',save)
 },[page?.id,id,session])
 if(id==='default')return children
 const template=LAYOUT_TEMPLATES[id]
 return <div className="cs-template-layout">
  <header className="cs-template-hero">
   <div className="cs-template-signature" aria-hidden="true"><span>{template.mark} <b>{template.signature}</b></span><span className="cs-template-edition">{template.label} / 0{template.version}</span></div>
   {template.effect&&<div className="cs-template-art" aria-hidden="true"><HostEffect kind={template.effect}/></div>}
   {template.ornament==='cutpaper'&&<svg className="cs-template-paper" viewBox="0 0 240 240" aria-hidden="true"><path className="paper-star" d="m120 0 14 60 47-38-24 59 66-1-53 35 66 25-67 10 35 54-57-27-3 63-29-56-39 49 9-62-63 15 45-46-63-18 66-17-40-53 58 26z"/><path className="paper-profile" d="M56 225q8-54 39-62l-6-27q-25-13-22-38l-8-19 23-7q4-36 42-35 39 1 44 30l21 24-20 5-5 31-23 7 1 25q44 15 46 66z"/><path className="paper-cut" d="m18 137 203-37 5 22-203 37z"/></svg>}
   <div className="cs-template-heading">{header}</div>
  </header>
  <section className="cs-template-lab" aria-label="卡片交互区">
   <div className="cs-template-scroll" ref={body} tabIndex={0} aria-label="卡片内容">{children}</div>
  </section>
 </div>
}
