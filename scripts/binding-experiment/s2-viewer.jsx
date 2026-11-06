import React from 'react'
import {createRoot} from 'react-dom/client'
import {CardRenderer} from '../../src/cardspec/Renderer.jsx'
import {CardSizeOverride} from '../../src/CardSize.jsx'
import {S2_CASES,transportFor} from './s2-engine.mjs'
import '../../src/styles/tokens.css'
import '../../src/styles/themes.css'
const p=new URLSearchParams(location.search),id=p.get('id'),width=Number(p.get('width')||432),size=p.get('size')||'square',r=await fetch('./runs/'+id+'.json').then(r=>r.json()),c=S2_CASES.find(c=>c.id===r.case)
window.qaCalls=[];window.qaRun=r
const baseTransport=transportFor(c,r.arm,window.qaCalls)
const transport=async request=>{
 if(p.get('fault')==='error'){
  window.qaCalls.push({tool:request.tool,input:request.input,fixtureFault:true})
  throw Object.assign(Error('受控工具失败，结果未确认'),{code:'NETWORK'})
 }
 return baseTransport(request)
}
if(r.spec)createRoot(document.getElementById('root')).render(<CardSizeOverride.Provider value={size}><main style={{width,maxWidth:'100%'}}><CardRenderer spec={r.spec} persistenceKey={'binding-s2:'+id} transport={transport} onDebugSession={s=>{window.qaSession=s}} debugAuthorizeWrite={async()=>true}/></main></CardSizeOverride.Provider>)
else document.getElementById('root').textContent='编译未通过'
