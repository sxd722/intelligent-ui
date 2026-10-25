import React,{useEffect,useRef} from 'react'
import {mountHostEffect} from './host-effects.js'
export function HostEffect({kind}) {
 const canvas=useRef(null)
 useEffect(()=>mountHostEffect(canvas.current,kind),[kind])
 return ['pearl','particles'].includes(kind)?<canvas className="cs-host-effect" ref={canvas} data-effect={kind} aria-hidden="true"/>:null
}
