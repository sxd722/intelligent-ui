import React,{createContext,useContext,useState,useRef,useLayoutEffect,useEffect,useCallback} from 'react'
import {createPortal} from 'react-dom'
import './destinations.css'
const Context=createContext(null)
// Host navigation, scoped to one card page. No new DSL state or model callbacks.
export function DestinationHost({page,session,children}){
 const [path,setPath]=useState(()=>page?.viewState?.destinationPath||[]),[targets,setTargets]=useState({})
 const home=useRef(null),positions=useRef(page?.viewState?.destinationScroll||{}),triggers=useRef({}),current=useRef(path);current.current=path
 const commit=next=>{current.current=next;setPath(next);if(page){page.viewState.destinationPath=next;session?.save()}}
 const enter=(id,label,trigger,ownerId)=>{
  if(current.current.at(-1)?.id===id)return
  const parent=current.current.at(-1)?.id||'home',el=parent==='home'?home.current?.closest('.cs-card'):targets[parent]
  positions.current[parent]={top:el?.scrollTop||0,left:el?.scrollLeft||0,windowY:window.scrollY};triggers.current[id]=trigger
  if(page)page.viewState.destinationScroll=positions.current
  const existing=current.current.findIndex(x=>x.id===id)
  commit(existing>=0?current.current.slice(0,existing+1):[...current.current,{id,label,ownerId}].slice(-8))
 }
 const back=()=>{const old=current.current.at(-1),next=current.current.slice(0,-1);commit(next);requestAnimationFrame(()=>{const id=next.at(-1)?.id||'home',pos=positions.current[id],el=id==='home'?home.current?.closest('.cs-card'):targets[id];if(pos){el?.scrollTo({top:pos.top,left:pos.left,behavior:'instant'});window.scrollTo({top:pos.windowY,behavior:'instant'})}triggers.current[old?.id]?.focus({preventScroll:true})})}
 const target=useCallback((id,el)=>setTargets(old=>old[id]===el?old:{...old,[id]:el}),[])
 const rename=useCallback((id,label)=>{if(current.current.some(e=>e.id===id&&e.label!==label)){const next=current.current.map(e=>e.id===id?{...e,label}:e);current.current=next;setPath(next);if(page){page.viewState.destinationPath=next;session?.save()}}},[page,session])
 useEffect(()=>{if(page&&session)session.setRegionVisibility?.('$destination',path.at(-1)?.ownerId||null,page)},[path,page,session])
 useEffect(()=>()=>{if(page&&session)session.setRegionVisibility?.('$destination',null,page)},[page,session])
 useEffect(()=>{if(!path.length)return;const onKey=e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]')){e.preventDefault();back()}};home.current?.closest('.cs-card')?.addEventListener('keydown',onKey);return()=>home.current?.closest('.cs-card')?.removeEventListener('keydown',onKey)},[path,targets])
 return <Context.Provider value={{path,targets,enter,rename}}><div ref={home} className="cs-destination-home" hidden={!!path.length}>{children}</div>{path.map((entry,i)=><DestinationPage key={entry.id} entry={entry} active={i===path.length-1} back={back} target={target}/>)}</Context.Provider>
}
function DestinationPage({entry,active,back,target}){
 const ref=useCallback(el=>target(entry.id,el),[entry.id,target]),heading=useRef(null)
 useLayoutEffect(()=>{if(active)heading.current?.focus({preventScroll:true})},[active])
 return <section className="cs-destination-page" hidden={!active} aria-label={entry.label} data-destination={entry.id}>
  <header><button type="button" aria-label="返回上一层" onClick={back}>← 返回</button><strong ref={heading} tabIndex={-1}>{entry.label}</strong></header><div className="cs-destination-body" ref={ref}/>
 </section>
}
export function Destination({id,label,children,session,ownerId}){
 const host=useContext(Context),active=host?.path.at(-1)?.id===id,entered=host?.path.some(x=>x.id===id)
 useEffect(()=>host?.rename(id,label),[host?.rename,id,label])
 useEffect(()=>{if(!session)return;const page=session.current();session.setRegionVisibility?.(ownerId,!!entered,page);return()=>session.setRegionVisibility?.(ownerId,false,page)},[session,ownerId,entered])
 if(!host)return <details><summary>{label}</summary>{children}</details>
 return <><button type="button" className="cs-destination-entry" onClick={e=>host.enter(id,label,e.currentTarget,ownerId)}><span>{label}</span><span aria-hidden="true">↗</span></button>{entered&&host.targets[id]&&createPortal(<div className="cs-stack">{children}</div>,host.targets[id])}</>
}
