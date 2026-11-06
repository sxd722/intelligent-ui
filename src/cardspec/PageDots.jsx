import React,{useRef,createContext,useContext,useLayoutEffect} from 'react'
import {createPortal} from 'react-dom'
import './page-dots.css'
import {dragNavigation,cancelNavigation,settleNavigation} from './host-motion.js'
export const PageDotsOutlet=createContext(null)
export function ExternalPageDots(props){
 const outlet=useContext(PageDotsOutlet)
 const action=useRef(props.onChange);action.current=props.onChange
 const register=outlet?.register
 useLayoutEffect(()=>{if(!register||props.count<1)return;register({count:props.count,index:props.index,move:i=>action.current(i)});return()=>register(null)},[register,props.count,props.index])
 if(register)return null
 return outlet?createPortal(<PageDots {...props}/>,outlet):null
}

export function PageDots({count,index,onChange,label='内容分屏',className=''}){
 if(count<2)return null
 const start=Math.max(0,Math.min(count-7,index-3)),pages=Array.from({length:Math.min(7,count)},(_,i)=>start+i)
 return <nav className={`cs-page-dots ${className}`} aria-label={label} onKeyDown={e=>{
  const to=e.key==='ArrowLeft'?index-1:e.key==='ArrowRight'?index+1:e.key==='Home'?0:e.key==='End'?count-1:null
  if(to!==null){e.preventDefault();e.stopPropagation();onChange(Math.max(0,Math.min(count-1,to)))}
 }}>
  {start>0&&<span aria-hidden="true">…</span>}
  {pages.map(i=><button type="button" key={i} aria-label={`${label}：第 ${i+1} 屏，共 ${count} 屏`} aria-current={i===index?'page':undefined} onClick={()=>onChange(i)}><i/></button>)}
  {start+pages.length<count&&<span aria-hidden="true">…</span>}
  <span className="cs-page-announcement" aria-live="polite">第 {index+1} 屏，共 {count} 屏，可左右滑动</span>
 </nav>
}

// Inner horizontal widgets keep their gestures; plain content belongs to paging.
export function usePageSwipe(count,index,move,dragRef){
 const pointer=useRef(null),suppress=useRef(0)
 return {
  onPointerDown:e=>{
   suppress.current=0
   if(count<2||e.button!==0||e.target.closest('button,input,textarea,select,a,summary,iframe,canvas,[role=slider],[contenteditable],.cs-carousel,.cs-swipe-deck,.cs-diagram,.cs-mermaid,.cs-table-pan,.cs-geographic-map,[data-gesture-owner],table'))return
   if(!e.isPrimary&&e.isPrimary!==undefined)return
   e.stopPropagation();pointer.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture?.(e.pointerId)
  },
  onPointerMove:e=>{const p=pointer.current;if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;if(Math.abs(dy)>16&&Math.abs(dy)>Math.abs(dx)*1.2){pointer.current=null;cancelNavigation(dragRef?.current);return}if(Math.abs(dx)>Math.abs(dy)*1.5)dragNavigation(dragRef?.current,dx*(index===0&&dx>0||index===count-1&&dx<0?.2:1))},
  onPointerUp:e=>{const p=pointer.current;pointer.current=null;if(!p)return;e.stopPropagation();const dx=e.clientX-p.x,dy=e.clientY-p.y;const to=Math.max(0,Math.min(count-1,index+(dx<0?1:-1)));if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.5&&to!==index){e.preventDefault();window.getSelection()?.removeAllRanges();suppress.current=Date.now()+400;move(to)}else settleNavigation(dragRef?.current)},
  onPointerCancel:()=>{pointer.current=null;cancelNavigation(dragRef?.current)},
  onLostPointerCapture:()=>{if(pointer.current){pointer.current=null;cancelNavigation(dragRef?.current)}},
  onClickCapture:e=>{if(Date.now()<suppress.current){e.preventDefault();e.stopPropagation()}},
 }
}
