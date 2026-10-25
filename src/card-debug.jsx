import React from 'react'
import {createRoot} from 'react-dom/client'
import {CardRenderer} from './cardspec/Renderer.jsx'
import {CardSizeOverride} from './CardSize.jsx'
import {createDebugTransport} from '../shared/cardspec/debug-fixtures.mjs'
import {debugControls} from './cardspec/debug-controls.mjs'
import {auditLayout} from './cardspec/layout-audit.js'
import './styles/tokens.css'
import './styles/dil.css'
import './styles/themes.css'

const root=createRoot(document.getElementById('root'))
let session,calls=[],coverage=[]
const text=el=>String(el.innerText||el.textContent||'').trim()
window.cardDebug={
 mount(spec,{scenario='normal',width=432,size='square',restore=false}={}){
  session=null;calls=[];coverage=[];if(!restore)sessionStorage.clear()
  // A copied spec only; production state and prefetched data never enter this renderer.
  spec=structuredClone(spec);delete spec.prefetched;delete spec.research;delete spec.generationPlan
  document.body.style.cssText=`margin:0;padding:0;width:${width}px;background:#eceff3`
  root.render(<CardSizeOverride.Provider value={size}><div style={{width}}><CardRenderer key={crypto.randomUUID()} spec={spec} persistenceKey="debug-only" transport={createDebugTransport({scenario,calls,coverage})} debugAuthorizeWrite={payload=>{coverage.push({tool:payload.tool,reason:'external write not executed'});throw Error('DEBUG_UNSUPPORTED: 外部写操作未执行')}} onDebugSession={s=>{session=s}}/></div></CardSizeOverride.Provider>)
 },
 ready:()=>!!session,
 snapshot(){
  const stage=document.querySelector('.cs-stage')
  return {text:text(stage||document.body).slice(0,2500),state:session?.current().store.values,
   empty:!!stage&&!text(stage.querySelector('.cs-card')||stage)&&!stage.querySelector('.cs-card svg,.cs-card img,.cs-card canvas,.cs-card input,.cs-card button'),
   componentState:Object.fromEntries(Object.entries(session?.current().viewState.components||{}).map(([id,v])=>[id,Object.fromEntries(Object.entries(v).map(([key,value])=>[key,key==='logic'?value?.state:value]))])),
   errors:[...document.querySelectorAll('.cs-recovery,.cs-node-recovery,.cs-action-error,[data-cs-error],.cs-logic-error')].filter(el=>!(el.classList.contains('cs-action-error')&&/^DEBUG_(SIMULATED_FAILURE|UNSUPPORTED)/.test(text(el)))).map(text).filter(Boolean).slice(0,8),
   handledMockErrors:[...document.querySelectorAll('.cs-action-error')].map(text).filter(t=>/^DEBUG_(SIMULATED_FAILURE|UNSUPPORTED)/.test(t)),
   controls:debugControls(stage?.querySelector('.cs-card')),
   horizontalOverflow:!!stage&&stage.scrollWidth>stage.clientWidth+2,
   layout:stage?auditLayout(stage):null,
   bindings:Object.fromEntries(Object.entries(session?.current().bindings||{}).map(([k,v])=>[k,{status:v.status,error:v.error}])),calls,coverage}
 },
 save:()=>session?.save()
}
