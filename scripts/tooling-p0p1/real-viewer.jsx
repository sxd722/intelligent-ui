import React from 'react'
import {createRoot} from 'react-dom/client'
import {CardRenderer} from '../../src/cardspec/Renderer.jsx'
import {CardSizeOverride} from '../../src/CardSize.jsx'
import {makeScope} from '../../shared/cardspec/store.mjs'
import '../../src/styles/tokens.css'
import '../../src/styles/themes.css'
const p=new URLSearchParams(location.search),id=p.get('id')||'trip',width=Number(p.get('width')||432),size=p.get('size')||'square',r=await fetch('./'+id+'.json').then(r=>r.json())
window.qaCalls=[]
const transport=async(req,signal)=>{const call={tool:req.tool,input:req.input,startedAt:Date.now()};window.qaCalls.push(call);const response=await fetch('/api/tools/invoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...req,requestId:crypto.randomUUID(),pageId:'p0p1-live-'+id,sessionId:'p0p1-real-composition',cause:'user',target:'binding'}),signal});call.events=(await response.text()).split('\n').filter(l=>l.startsWith('data:')).map(l=>JSON.parse(l.slice(5)));call.elapsedMs=Date.now()-call.startedAt;const error=call.events.find(e=>e.type==='error');if(error)throw Error(error.error);const result=call.events.find(e=>e.type==='result')?.result;if(!result)throw Error('No tool result');return result}
if(r.spec)createRoot(document.getElementById('root')).render(<CardSizeOverride.Provider value={size}><main style={{width,maxWidth:'100%'}}><CardRenderer spec={r.spec} transport={transport} persistenceKey={'p0p1-real:'+id} onDebugSession={s=>{window.qaSession=s;window.qaView=()=>{const page=s.current(),scope=makeScope(page.spec,page.store,{bindings:page.bindings});return Object.keys(page.spec.derived).map(k=>scope.derived[k]).find(v=>v?.version===1)}}}/></main></CardSizeOverride.Provider>)
else document.getElementById('root').textContent='生成未通过，请查看trace'
