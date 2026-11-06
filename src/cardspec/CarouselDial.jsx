import React, {useEffect, useRef} from 'react'
import {useNavigationOwner} from './Navigation.jsx'
import {useIntrinsicHeight} from './sizing.js'
import {useViewState} from './view-state.jsx'
import './carousel-dial.css'
import {useCardSize} from '../CardSize.jsx'

const clampIndex=(value,count)=>Math.max(0,Math.min(Math.max(0,count-1),Number.isFinite(Number(value))?Math.trunc(Number(value)):0))
const interactive='button,input,textarea,select,a,[role="slider"],[contenteditable="true"]'

// The host owns presentation, gestures and page memory. Every slide remains
// mounted so switching the dial never discards a form or nested component state.
export function Carousel({p,fire,children,streaming}) {
  const full=useCardSize()==='full'
  const track=useRef(null),pointer=useRef(null)
  const count=children.length
  const [saved,setSaved]=useViewState('carouselIndex',p.index??0)
  const active=clampIndex(saved,count)
  const size=useIntrinsicHeight(track,streaming,el=>Math.max(56,...Array.from(el.querySelectorAll(':scope > .cs-dial-slide > .cs-dial-content'),node=>node.offsetHeight))+24,JSON.stringify(children.map((child,index)=>child.key??index)))
  useEffect(()=>{if(p.index!=null)setSaved(clampIndex(p.index,count))},[p.index,count,setSaved])
  const go=value=>{
    const index=clampIndex(value,count)
    if(index===active)return
    if(fire('onIndexChange',{index,value:index})===false)return
    setSaved(index)
  }
  const navigation={label:`${p.label||'展示'}分页`,value:`${count?active+1:0} / ${count}`,count,previousLabel:'上一项',nextLabel:'下一项',previousText:'‹',nextText:'›',disabledPrevious:active===0,disabledNext:active>=count-1,previous:()=>go(active-1),next:()=>go(active+1)}
  const builtIn=useNavigationOwner(p.ownerId,p.navigation==='external',navigation)
  return <section className="cs-carousel cs-carousel-dial" role="region" aria-roledescription={full?'内容集合':'carousel'} aria-label={p.label||'滑动展示'} data-expanded={full} data-active-index={active} data-single={count<=1}>
    <div className="cs-dial-track" ref={track} style={{height:size.height||180}} data-content-height={size.height} tabIndex={0} onDragStart={e=>e.preventDefault()}
      onKeyDown={e=>{
        if(full||e.target!==e.currentTarget)return
        const next=e.key==='ArrowRight'?active+1:e.key==='ArrowLeft'?active-1:e.key==='Home'?0:e.key==='End'?count-1:null
        if(next!=null){e.preventDefault();e.stopPropagation();go(next)}
      }}
      onPointerDown={e=>{
        // Internal controls keep their own drag/click semantics. Stop the outer
        // card-history swipe even when this gesture belongs to a slider/input.
        e.stopPropagation()
        if(full||e.button!==0||e.target.closest(interactive)||e.target.closest('.cs-carousel')!==e.currentTarget.parentElement)return
        pointer.current={id:e.pointerId,x:e.clientX,y:e.clientY}
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerUp={e=>{
        e.stopPropagation();const start=pointer.current;pointer.current=null
        if(!start||start.id!==e.pointerId)return
        const dx=e.clientX-start.x,dy=e.clientY-start.y
        if(Math.abs(dx)>36&&Math.abs(dx)>Math.abs(dy)*1.3)go(active+(dx<0?1:-1))
      }} onPointerCancel={()=>{pointer.current=null}}>
      {children.map((child,index)=>{
        const distance=index-active,adjacent=Math.abs(distance)<=1
        return <div key={child.key||index} className="cs-dial-slide" data-active={distance===0} data-layout-scroll="allow" aria-hidden={!full&&distance!==0?true:undefined} inert={!full&&distance!==0?'':undefined} role="group" aria-roledescription="slide" aria-label={`${index+1} / ${count}`} style={{'--dial-offset':Math.max(-2,Math.min(2,distance)),'--dial-depth':Math.min(2,Math.abs(distance)),opacity:adjacent?1:0,zIndex:distance===0?3:1,visibility:adjacent?'visible':'hidden'}}>
          <div className="cs-dial-content">{child}</div>
        </div>
      })}
      {!count&&<span className="cs-dial-empty">暂无展示内容</span>}
      {!full&&builtIn&&count>1&&<>
        <button className="cs-dial-step cs-dial-previous" type="button" aria-label="上一项" disabled={active===0} onClick={()=>go(active-1)}>‹</button>
        <button className="cs-dial-step cs-dial-next" type="button" aria-label="下一项" disabled={active>=count-1} onClick={()=>go(active+1)}>›</button>
      </>}
    </div>
    {!full&&count>1&&<span className="cs-dial-position" aria-live="polite" aria-atomic="true">{active+1}<span aria-hidden="true"> / </span><span className="cs-dial-total">{count}</span></span>}
  </section>
}
