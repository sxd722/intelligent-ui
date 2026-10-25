import {useLayoutEffect,useRef,useState} from 'react'
import {useMotionPreference} from '../MotionControl.jsx'
import {effectiveMotion} from '../motion-preference.mjs'
import {interpolateGraphics} from '../../shared/cardspec/graphic-motion.mjs'
// Painting only. Event handlers and accessible labels must use original inputs.
export function useGraphicMotion(items,fields,element){
 const motion=useMotionPreference(),[shown,setShown]=useState(items),current=useRef(items),key=JSON.stringify(items),fieldKey=fields.join(',')
 useLayoutEffect(()=>{
  if(typeof document==='undefined'||typeof matchMedia!=='function'){current.current=items;setShown(items);return}
  const target=items,from=current.current,reduce=matchMedia('(prefers-reduced-motion: reduce)')
  let frame=0,disposed=false,visible=!element?.current||element.current.getBoundingClientRect().bottom>0&&element.current.getBoundingClientRect().top<innerHeight
  const finish=()=>{cancelAnimationFrame(frame);frame=0;if(!disposed){current.current=target;setShown(target)}}
  const active=()=>visible&&!document.hidden&&effectiveMotion(motion,reduce.matches)!=='off'
  const visibility=()=>{if(!active())finish()}
  let observer
  if(element?.current){observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;visibility()});observer.observe(element.current)}
  document.addEventListener('visibilitychange',visibility);reduce.addEventListener('change',visibility)
  if(!active())finish()
  else {const start=performance.now();const tick=now=>{if(!active()){finish();return}const t=Math.min(1,(now-start)/(motion==='light'?150:340));current.current=interpolateGraphics(from,target,fields,1-(1-t)**3);setShown(current.current);if(t<1)frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick)}
  return()=>{disposed=true;cancelAnimationFrame(frame);observer?.disconnect();document.removeEventListener('visibilitychange',visibility);reduce.removeEventListener('change',visibility)}
 },[key,fieldKey,motion])
 return shown.length===items.length&&shown.every((x,i)=>x.id===items[i].id)?shown:interpolateGraphics(current.current,items,fields,0)
}
