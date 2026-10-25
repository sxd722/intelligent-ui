import React,{useEffect,useRef,useState} from 'react'
import {useCardSize} from './CardSize.jsx'
import './styles/card-focus.css'

// Preserve the mounted tree, including tool sessions and sandbox state.
export function CardFocus({children}){
 const [open,setOpen]=useState(false),root=useRef(null),toggle=useRef(null),pointer=useRef(null),size=useCardSize()
 useEffect(()=>{
  if(!open)return
  const previous=document.activeElement,changed=[]
  for(let node=root.current;node?.parentElement;node=node.parentElement){for(const sibling of node.parentElement.children)if(sibling!==node){changed.push([sibling,sibling.inert]);sibling.inert=true}}
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';toggle.current?.focus()
  const escape=e=>{if(e.key==='Escape'){e.preventDefault();setOpen(false)}}
  document.addEventListener('keydown',escape)
  return()=>{document.removeEventListener('keydown',escape);document.body.style.overflow=overflow;for(const [el,value]of changed)el.inert=value;(previous?.isConnected?previous:toggle.current)?.focus()}
 },[open])
 const enter=e=>{
  if(open||e.defaultPrevented||e.target.closest('button,a,input,select,textarea,summary,[role="button"],[role="slider"],[role="radio"],[contenteditable],iframe,canvas,.cs-diagram,.cs-mermaid,.cs-carousel,.cs-swipe-deck')||window.getSelection()?.toString())return
  if(pointer.current&&Math.hypot(e.clientX-pointer.current.x,e.clientY-pointer.current.y)>8)return
  setOpen(true)
 }
 return <div ref={root} className={`card-focus${open?' card-focus--open':''}`} data-size={size} role={open?'dialog':undefined} aria-modal={open?'true':undefined} aria-label={open?'全屏卡片':undefined} onKeyDown={e=>{
  if(!open||e.key!=='Tab')return
  const items=[...root.current.querySelectorAll('button,a[href],input,select,textarea,iframe,[tabindex="0"]')].filter(el=>!el.disabled&&!el.closest('[inert]')&&el.getClientRects().length)
  const first=items[0],last=items.at(-1)
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
 }}>
  <div className="card-focus-toolbar"><button type="button" ref={toggle} onClick={()=>setOpen(!open)} aria-label={open?'退出卡片全屏':'全屏查看卡片'}>{open?'✕ 退出全屏':'⛶ 全屏查看'}</button>{open&&<small>Esc 退出 · 卡片可继续互动</small>}</div>
  <div className="card-focus-content" onPointerDown={e=>{pointer.current={x:e.clientX,y:e.clientY}}} onClick={enter}>{children}</div>
 </div>
}
