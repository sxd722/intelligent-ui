import React,{useEffect,useRef,useState,useMemo} from 'react'
import {useViewState} from './view-state.jsx'
import {createLogicController} from './logic-controller.mjs'
import {runLogic} from './logic-client.js'
import {logicJson,logicTickMs} from '../../shared/cardspec/logic-contract.mjs'
export function LogicPanel({p,streaming,validate,children,onAction}){
 const [saved,save]=useViewState('logic',null),controller=useRef(null),element=useRef(null)
 const [snapshot,setSnapshot]=useState(()=>({state:saved?.source===p.source?saved.state:p.initial,error:'',busy:false,ready:p.reactive!==true,source:p.source,initialKey:logicJson(p.initial,{record:true})}))
 const [playing,setPlaying]=useState(false),[visible,setVisible]=useState(false)
 const validator=useRef(validate);validator.current=validate
 const bridge=useRef(onAction);bridge.current=onAction
 const tickMs=useMemo(()=>logicTickMs(p.source,p.tickMs),[p.source,p.tickMs])
 const initialKey=logicJson(p.initial,{record:true}),inputKey=logicJson(p.input??{})
 const current=snapshot.source===p.source&&snapshot.initialKey===initialKey,ready=current&&snapshot.ready
 useEffect(()=>{
  const c=createLogicController({source:p.source,initial:p.initial,input:p.input??{},saved,run:runLogic,validate:s=>validator.current(s),save,notify:setSnapshot,reactive:p.reactive===true,afterCommit:result=>bridge.current?.(result)})
  controller.current=c;setSnapshot(c.snapshot());setPlaying(false)
  return()=>{c.dispose();controller.current=null}
 },[p.source,initialKey,p.reactive])
 useEffect(()=>{controller.current?.setInput(p.input??{})},[inputKey])
 useEffect(()=>{controller.current?.setActive(visible&&!streaming)},[visible,streaming,p.source,initialKey,p.reactive])
 useEffect(()=>{
  let intersects=false
  const update=()=>{const on=intersects&&!document.hidden;setVisible(on);if(!on){setPlaying(false);controller.current?.setActive(false)}}
  const observer=new IntersectionObserver(([entry])=>{intersects=entry.isIntersecting;update()});observer.observe(element.current)
  document.addEventListener('visibilitychange',update)
  return()=>{observer.disconnect();document.removeEventListener('visibilitychange',update)}
 },[])
 useEffect(()=>{if(!playing||!visible||streaming||!tickMs)return
  const timer=setInterval(()=>{if(!controller.current?.snapshot().busy)controller.current?.dispatch({type:'tick',dt:tickMs,args:{}})},tickMs)
  return()=>clearInterval(timer)
 },[playing,visible,streaming,tickMs])
 useEffect(()=>{if(snapshot.error)setPlaying(false)},[snapshot.error])
 const dispatch=(type,extra)=>{if(streaming||!visible)return;try{controller.current?.dispatch({...extra.event,type,args:extra.args===undefined?{}:extra.args})}catch(e){setSnapshot(s=>({...s,error:e.message}))}}
 return <section ref={element} className="cs-logic cs-stack" data-cs-component="logic" data-grow={p.grow||undefined} aria-label={p.label||'交互模块'} aria-busy={snapshot.busy}>
  {ready&&children(snapshot.state,dispatch,message=>setSnapshot(s=>({...s,error:message})))}
  {tickMs&&<div className="cs-row"><button type="button" className="cs-button" disabled={streaming||!visible||!ready} onClick={()=>setPlaying(v=>!v)}>{playing?'暂停演示':'播放演示'}</button><button type="button" className="cs-button" disabled={streaming||snapshot.busy||!ready} onClick={()=>dispatch('tick',{event:{dt:tickMs}})}>单步</button></div>}
  {(!current||snapshot.busy||!ready&&!snapshot.error)&&<small role="status">正在计算…</small>}
  {current&&snapshot.error&&<div role="alert" className="cs-logic-error">{snapshot.error}<button type="button" className="cs-button" onClick={()=>{setPlaying(false);controller.current?.reset()}}>重置本模块</button></div>}
 </section>
}
