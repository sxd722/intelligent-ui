import {useRef,useLayoutEffect,useEffect} from 'react'
import {useMotionPreference} from '../MotionControl.jsx'
import {animateNavigation,exitNavigation,cancelNavigation} from './host-motion.js'

// Animate out before changing the live page. Never clone an iframe, controller
// or tool binding: only one interactive page exists throughout the transition.
export function usePageTransition(ref,index,key=index){
 const previous=useRef(null),pending=useRef(false),alive=useRef(true),motion=useMotionPreference()
 useLayoutEffect(()=>{
  if(previous.current&&previous.current.key!==key)animateNavigation(ref.current,index>=previous.current.index?1:-1)
  previous.current={key,index}
 },[key,index])
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;cancelNavigation(ref.current)}},[])
 useEffect(()=>{if(motion==='off')cancelNavigation(ref.current)},[motion])
 return async(to,commit)=>{
  if(to===index||pending.current)return
  pending.current=true
  try{await exitNavigation(ref.current,to>index?1:-1);if(alive.current)commit(to)}
  finally{pending.current=false}
 }
}
