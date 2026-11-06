import React,{useRef,useLayoutEffect} from 'react'
import {useMotionPreference} from '../MotionControl.jsx'
import './card-pile.css'
import {forwardPile} from './pile-order.mjs'

// Inactive cards are host-owned covers, not mounted renderers. In particular,
// they must never start tools, duplicate controls, or run sandbox animation.
export function CardPile({cards=[],index=0,children}){
 const order=forwardPile(cards,index)
 const motion=useMotionPreference(),active=order.length>0,root=useRef(null)
 useLayoutEffect(()=>{
  const el=root.current;if(!active||!el)return
  const front=el.querySelector('.cs-pile-front')
  const measure=()=>{const stage=front.querySelector('.cs-stage')||front;el.style.setProperty('--pile-height',`${stage.offsetHeight}px`)}
  const observer=new ResizeObserver(measure);observer.observe(front);measure()
  return()=>observer.disconnect()
 },[active,index])
 return <div ref={root} className="cs-card-pile" data-stacked={active||undefined} data-pile-motion={motion}>
  {order.map(c=><div className="cs-card-cover" key={c.id} aria-hidden="true" data-pile-card={c.id} data-depth={c.depth} style={{'--pile-depth':c.depth,zIndex:4-c.depth}}><span>{c.title||''}</span></div>)}
  <div className="cs-pile-front">{children}</div>
 </div>
}
