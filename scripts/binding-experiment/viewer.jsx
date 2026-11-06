import React from 'react'
import {createRoot} from 'react-dom/client'
import {CardRenderer} from '../../src/cardspec/Renderer.jsx'
import {CardSizeOverride} from '../../src/CardSize.jsx'
import {CASES,transportFor} from './engine.mjs'
import '../../src/styles/tokens.css'
import '../../src/styles/themes.css'
const p=new URLSearchParams(location.search),caseId=p.get('case'),arm=p.get('arm'),width=Number(p.get('width')||432),size=p.get('size')||'square';
const rows=await fetch('./results.json').then(r=>r.json()),r=rows.find(r=>r.case===caseId&&r.arm===arm),c=CASES.find(c=>c.id===caseId)
window.qaCalls=[]
if(r?.spec){const transport=transportFor(c,r.effectiveArm||arm,r.mapping,window.qaCalls);createRoot(document.getElementById('root')).render(<CardSizeOverride.Provider value={size}><main style={{width,maxWidth:'100%'}}><CardRenderer spec={r.spec} persistenceKey={'binding-experiment:'+caseId+':'+arm} transport={transport} onDebugSession={s=>{window.qaSession=s}} debugAuthorizeWrite={async()=>true}/></main></CardSizeOverride.Provider>)}else document.getElementById('root').textContent='该产物未通过编译：'+JSON.stringify(r?.diagnostics||r?.error)
