import {installSandboxTheme} from './sandbox-theme.mjs'
import {compactWorkspace} from './compact-workspace.mjs'
import {installContentHeight} from './content-height.mjs'
import React from 'react'
import * as ReactDOMClient from 'react-dom/client'
import {createPortal,flushSync} from 'react-dom'
import {applyWebStateUpdate} from '../../shared/cardspec/web-state.mjs'
import {auditVisuals} from './visual-audit.mjs'
import {standaloneGraphic} from './graphic-dom.mjs'
import {createWebGraphics} from './web-graphics.mjs'

// Trusted bootstrap inside the opaque iframe. Generated modules never run in
// the application origin. Only finite JSON state and confirmed action requests
// cross the boundary; ordinary browser interaction stays within this frame.
const token=document.documentElement.dataset.webToken
const post=value=>parent.postMessage({web:token,...value},'*')
const contentHeight=installContentHeight(document.getElementById('root'),post)
const themeSurface=installSandboxTheme(document.getElementById('root'))
let App,root,initialization,update,initDone=false,pendingState,lastState='',saveTimer
const graphics=createWebGraphics({enabled:document.documentElement.dataset.webGraphics==='true',report:value=>post({type:'graphics',value}),environment:()=>({active:initialization?.active,reducedMotion:document.documentElement.dataset.reducedMotion==='true'})})
addEventListener('pagehide',()=>graphics.dispose())
document.addEventListener('visibilitychange',()=>graphics.refresh())
let visualTimer,visualSignature=''
function scheduleVisualAudit(){
 if(visualTimer)return
 visualTimer=setTimeout(()=>{
  visualTimer=null
  const surface=document.getElementById('root'),graphic=standaloneGraphic(surface)
  surface.querySelectorAll('[data-host-graphic-fill]').forEach(e=>{if(!graphic?.wrappers.includes(e))e.removeAttribute('data-host-graphic-fill')})
  graphic?.wrappers.forEach(e=>e.setAttribute('data-host-graphic-fill','true'))
  document.documentElement.dataset.hostGraphic=graphic?'true':'false'
  post({type:'graphic',value:graphic?{kind:graphic.kind,ratio:graphic.ratio,minimum:graphic.minimum}:null})
  compactWorkspace(surface)
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
 }catch(e){post({type:'persistence_warning',message:'存档未更新，已保留上次有效存档：'+e.message})}
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
  try{return applyWebStateUpdate(previous,update,result=>post({type:'persistence_warning',message:'历史记录已自动清理最早的 '+result.totalRemoved+' 项；当前状态保留，仅可撤销保留的历史。'}))}
  catch(error){post({type:'persistence_warning',message:'本次状态未保存，保留上次有效状态：'+error.message});return previous}
 }),[])
 const [environment,setEnvironment]=React.useState(initialization)
 update=setEnvironment
 React.useEffect(()=>{save(state)},[state])
 React.useEffect(()=>{post({type:'ready'})},[])
 return <Boundary><App data={environment.data||{}} state={state} setState={setState} bridge={bridge} graphics={graphics} active={environment.active!==false}/></Boundary>
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
  contentHeight(value.contentHeight)
  themeSurface.apply(value.theme||{})
  for(const [key,v] of Object.entries(value.theme||{}))if(key.startsWith('--cs-')&&typeof v==='string')document.documentElement.style.setProperty(key,v)
  document.documentElement.dataset.reducedMotion=value.reducedMotion?'true':'false'
  graphics.refresh()
  if(initialization){initialization={...initialization,data:value.data,active:value.active};update?.(initialization)}
 }
})
addEventListener('error',e=>post({type:'error',message:String(e.message||'Resource failed to load').slice(0,1000)}))
addEventListener('unhandledrejection',e=>post({type:'error',message:String(e.reason?.message||e.reason||'Unhandled rejection').slice(0,1000)}))
post({type:'boot'})
