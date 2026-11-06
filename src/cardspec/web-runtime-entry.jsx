import React from 'react'
import * as ReactDOMClient from 'react-dom/client'
import {createPortal,flushSync} from 'react-dom'
import {applyWebStateUpdate} from '../../shared/cardspec/web-state.mjs'
import {auditVisuals} from './visual-audit.mjs'

// Trusted bootstrap inside the opaque iframe. Generated modules never run in
// the application origin. Only finite JSON state and confirmed action requests
// cross the boundary; ordinary browser interaction stays within this frame.
const token=document.documentElement.dataset.webToken
const post=value=>parent.postMessage({web:token,...value},'*')
let App,root,initialization,update,initDone=false,pendingState,lastState='',saveTimer
let visualTimer,visualSignature=''
function scheduleVisualAudit(){
 if(visualTimer)return
 visualTimer=setTimeout(()=>{
  visualTimer=null
  const detail=auditVisuals(document.getElementById('root')),signature=JSON.stringify(detail)
  if(signature!==visualSignature){visualSignature=signature;post({type:'visuals',detail})}
 },250)
}
function save(value){
 try{
  const raw=JSON.stringify(value)
  if(!raw||raw.length>65536)throw Error('Persistent state exceeds 64 KiB; keep transient data in local React state')
  if(raw===lastState)return
  pendingState=raw
  if(!saveTimer)saveTimer=setTimeout(()=>{saveTimer=null;lastState=pendingState;post({type:'state',value:JSON.parse(lastState)})},60)
 }catch(e){post({type:'error',message:e.message})}
}
class Boundary extends React.Component{
 state={error:null}
 static getDerivedStateFromError(error){return {error}}
 componentDidCatch(error){post({type:'error',message:String(error.message).slice(0,1000)})}
 render(){return this.state.error?<div role="alert">应用出错：{this.state.error.message}</div>:this.props.children}
}
const bridge=Object.freeze({call(name,payload={}){
 if(!initialization?.actions?.includes(name))throw Error('Host action is not exposed: '+name)
 const raw=JSON.stringify(payload)
 if(!raw||raw.length>4096)throw Error('Host action payload exceeds capacity')
 post({type:'action',name,payload:JSON.parse(raw)})
}})
function Wrapper(){
 const [state,commitState]=React.useState(initialization.state||{})
 const setState=React.useCallback(update=>commitState(previous=>{
  try{return applyWebStateUpdate(previous,update)}
  catch(error){post({type:'error',message:error.message});return previous}
 }),[])
 const [environment,setEnvironment]=React.useState(initialization)
 update=setEnvironment
 React.useEffect(()=>{save(state)},[state])
 React.useEffect(()=>{post({type:'ready'})},[])
 return <Boundary><App data={environment.data||{}} state={state} setState={setState} bridge={bridge} active={environment.active!==false}/></Boundary>
}
function start(){if(!App||!initialization||initDone)return;initDone=true;const el=document.getElementById('root');root=ReactDOMClient.createRoot(el);root.render(<Wrapper/>);new MutationObserver(scheduleVisualAudit).observe(el,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class','hidden','width','height','viewBox','aria-hidden']});new ResizeObserver(scheduleVisualAudit).observe(el);scheduleVisualAudit()}
window.React=React
window.__CARD_WEB__={React,ReactDOM:{...ReactDOMClient,createPortal,flushSync},mount(module){
 if(typeof module.default!=='function'&&typeof module.default!=='object')throw Error('Export a default React component')
 if(module.styles!==undefined){if(typeof module.styles!=='string'||module.styles.length>120000)throw Error('styles must be a CSS string');const style=document.createElement('style');style.textContent=module.styles;document.head.append(style)}
 App=module.default;start()
}}
addEventListener('message',e=>{
 if(e.source!==parent||e.data?.web!==token)return
 const value=e.data
 if(value.type==='init'&&!initialization){initialization=value;start()}
 if(value.type==='environment'){
  for(const [key,v] of Object.entries(value.theme||{}))if(key.startsWith('--cs-')&&typeof v==='string')document.documentElement.style.setProperty(key,v)
  document.documentElement.dataset.reducedMotion=value.reducedMotion?'true':'false'
  if(initialization){initialization={...initialization,data:value.data,active:value.active};update?.(initialization)}
 }
})
addEventListener('error',e=>post({type:'error',message:String(e.message||'Resource failed to load').slice(0,1000)}))
addEventListener('unhandledrejection',e=>post({type:'error',message:String(e.reason?.message||e.reason||'Unhandled rejection').slice(0,1000)}))
post({type:'boot'})
