import {taskOutputSnapshot} from '../shared/cardspec/task-behavior.mjs'
import React from 'react'
import {MapEnvironment} from './cardspec/MapEnvironment.jsx'
import {SandboxSettings} from './SandboxMode.jsx'
import {createRoot} from 'react-dom/client'
import {CardRenderer} from './cardspec/Renderer.jsx'
import {CardDeck} from './cardspec/CardDeck.jsx'
import {CardSizeOverride} from './CardSize.jsx'
import {createDebugTransport} from '../shared/cardspec/debug-fixtures.mjs'
import {experimentLiveRead} from './cardspec/experiment-live-read.mjs'
import {debugControls} from './cardspec/debug-controls.mjs'
import {auditLayout} from './cardspec/layout-audit.js'
import './styles/tokens.css'
import './styles/dil.css'
import './styles/themes.css'

const root=createRoot(document.getElementById('root'))
let session,calls=[],coverage=[],renderSurface
const text=el=>String(el.innerText||el.textContent||'').trim()
window.cardDebug={
 mount(spec,{scenario='normal',width=432,size='square',restore=false,persistenceKey='debug-only',deck,streaming=false,snapshots=[],replayMode,liveReadTools=[]}={}){
  session=null;calls=[];coverage=[];if(!restore)sessionStorage.clear()
  // Never inherit arbitrary production state. Explicit host snapshots must,
  // however, seed manual bindings just as at delivery (e.g. prior analysis).
  // Replaying only network requests leaves manual bindings falsely empty.
  spec=structuredClone(spec);delete spec.prefetched;delete spec.research;delete spec.generationPlan
  if(scenario==='normal')spec.prefetched=structuredClone(snapshots)
  if(deck)deck=structuredClone(deck).map(c=>{delete c.spec?.prefetched;delete c.spec?.research;return {...c,status:'ready'}})
  const Surface=deck?CardDeck:CardRenderer
  const transport=liveReadTools.length?experimentLiveRead({allowed:liveReadTools,calls,coverage}):createDebugTransport({scenario,calls,coverage,snapshots,replayMode})
  document.body.style.cssText=`margin:0;padding:0;width:${width}px;background:#eceff3`
  const instanceKey=crypto.randomUUID()
  renderSurface=(preview=false)=>root.render(<MapEnvironment.Provider value="offline"><SandboxSettings.Provider value={spec.context?.renderMode||'native'}><CardSizeOverride.Provider value={size}><div style={{width}}><Surface deck={deck} storageNamespace="debug-deck" key={instanceKey} streaming={preview} spec={spec} persistenceKey={persistenceKey} transport={transport} debugAuthorizeWrite={payload=>{coverage.push({tool:payload.tool,reason:'external write not executed'});throw Error('DEBUG_UNSUPPORTED: 外部写操作未执行')}} onDebugSession={s=>{session=s}}/></div></CardSizeOverride.Provider></SandboxSettings.Provider></MapEnvironment.Provider>)
  renderSurface(streaming)
 },
 setStreaming:value=>renderSurface?.(!!value),
 ready:()=>!!session,
 snapshot(){
  const stage=document.querySelector('.cs-stage')
  const scope=session?.scope(),derived={};if(scope)for(const key of Object.keys(scope.derived).slice(0,30))try{const v=scope.derived[key];if(JSON.stringify(v)?.length<5000)derived[key]=v}catch{}
  const results=scope?taskOutputSnapshot(session.current().spec,scope):{}
  // Native composite widgets own internal state; the DSL view alone does not
  // change when their displayed subset/detail changes. Observe actual output.
  for(const el of stage?.querySelectorAll('[data-evidence-result]')||[])try{results['evidence:'+el.closest('[data-cs-node]')?.getAttribute('data-cs-node')]=JSON.parse(el.getAttribute('data-evidence-result'))}catch{}
  const errorElements=[...document.querySelectorAll('.cs-recovery,.cs-node-recovery,.cs-action-error,[data-cs-error],.cs-logic-error,.cs-sandbox [role=alert],[data-task-audit="failed"]')].filter(el=>!(el.classList.contains('cs-action-error')&&/^DEBUG_(SIMULATED_FAILURE|UNSUPPORTED)/.test(text(el))))
  return {results,derived,text:text(stage||document.body).slice(0,6000),visualCount:[...(stage?.querySelectorAll('svg,canvas,progress,meter,[role=progressbar],[role=meter],.cs-sandbox[data-sandbox-graphic="true"][data-sandbox-ready="true"]')||[])].filter(e=>e.getBoundingClientRect().height>0).length,state:session?.current().store.values,
   empty:!!stage&&!text(stage.querySelector('.cs-card')||stage)&&!stage.querySelector('.cs-card svg,.cs-card img,.cs-card canvas,.cs-card input,.cs-card button'),
   componentState:Object.fromEntries(Object.entries(session?.current().viewState.components||{}).map(([id,v])=>[id,Object.fromEntries(Object.entries(v).map(([key,value])=>[key,key==='logic'?value?.state:value]))])),
   errors:errorElements.map(text).filter(Boolean).slice(0,8),
   errorDetails:errorElements.map(el=>({message:text(el),node:el.closest('[data-cs-node]')?.getAttribute('data-cs-node')})).filter(e=>e.message).slice(0,8),
   handledMockErrors:[...document.querySelectorAll('.cs-action-error')].map(text).filter(t=>/^DEBUG_(SIMULATED_FAILURE|UNSUPPORTED)/.test(t)),
   controls:debugControls(stage?.closest('.cs-tool-card')||stage?.querySelector('.cs-card')),
   horizontalOverflow:!!stage&&stage.scrollWidth>stage.clientWidth+2,
   layout:stage?auditLayout(stage):null,
   bindings:Object.fromEntries(Object.entries(session?.current().bindings||{}).map(([k,v])=>[k,{status:v.status,error:v.error}])),calls,coverage}
 },
 save:()=>session?.save()
}
