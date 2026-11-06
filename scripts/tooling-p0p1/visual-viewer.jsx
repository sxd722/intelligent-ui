import React from 'react'
import {createRoot} from 'react-dom/client'
import {CardRenderer} from '../../src/cardspec/Renderer.jsx'
import {CardSizeOverride} from '../../src/CardSize.jsx'
import {MapEnvironment} from '../../src/cardspec/MapEnvironment.jsx'
import {cases} from './visual-cases.mjs'
import '../../src/styles/tokens.css'
import '../../src/styles/themes.css'
const p=new URLSearchParams(location.search),id=p.get('id')||'weather-atlas-4x4',width=Number(p.get('width')||432),size=p.get('size')||'square',r=await fetch('./runs/'+id+'.json').then(r=>r.json()),c=cases.find(c=>c.id===r.case)
window.qaCalls=[];window.qaFail=false
const transport=async req=>{window.qaCalls.push({tool:req.tool,input:req.input});if(window.qaFail)throw Error('受控网络故障');return {kind:'json',value:{items:c.rows.map((r,i)=>({...r,...(p.has('badImage')?{assetRef:'invalid-reference-qa'}:{}),rowKey:'fixture-'+i})),source:'受控测试快照',fetchedAt:new Date().toISOString(),truncated:false}}}
createRoot(document.getElementById('root')).render(<MapEnvironment.Provider value="offline"><CardSizeOverride.Provider value={size}><main style={{width,maxWidth:'100%'}}><CardRenderer spec={r.spec} transport={transport} persistenceKey={'p0p1:'+id} onDebugSession={s=>window.qaSession=s}/></main></CardSizeOverride.Provider></MapEnvironment.Provider>)
