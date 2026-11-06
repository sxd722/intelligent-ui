import React from 'react'
import {createRoot} from 'react-dom/client'
import {CardRenderer} from '../../src/cardspec/Renderer.jsx'
import {CardSizeOverride} from '../../src/CardSize.jsx'
import {CASES,transportFor} from './engine-v3.mjs'
import '../../src/styles/tokens.css'
import '../../src/styles/themes.css'
const p=new URLSearchParams(location.search),id=p.get('id'),width=Number(p.get('width')||432),size=p.get('size')||'square'
const r=await fetch('./runs/'+id+'.json').then(r=>r.json()),c=CASES.find(c=>c.id===r.case)
window.qaCalls=[];window.qaRun=r
if(r.spec)createRoot(document.getElementById('root')).render(<CardSizeOverride.Provider value={size}><main style={{width,maxWidth:'100%'}}><CardRenderer spec={r.spec} persistenceKey={'binding-v3:'+id} transport={transportFor(c,r.arm,c.map,window.qaCalls)} onDebugSession={s=>{window.qaSession=s}} debugAuthorizeWrite={async()=>true}/></main></CardSizeOverride.Provider>)
else document.getElementById('root').textContent='编译未通过'
