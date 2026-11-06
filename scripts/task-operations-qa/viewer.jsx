import React from 'react'
import {createRoot} from 'react-dom/client'
import {CardRenderer} from '../../src/cardspec/Renderer.jsx'
import {CardSizeOverride} from '../../src/CardSize.jsx'
import {detailRequests} from '../../shared/cardspec/result-view.mjs'
import {CASES,env} from './cases.mjs'
import '../../src/styles/tokens.css'
import '../../src/styles/themes.css'
const p=new URLSearchParams(location.search),id=p.get('id'),r=await fetch('./runs/'+id+'.json').then(r=>r.json()),c=CASES.find(c=>c.id===r.case),width=Number(p.get('width')||432),size=p.get('size')||'square'
window.qaCalls=[]
const transport=async req=>{
 window.qaCalls.push({tool:req.tool,input:req.input})
 const source=c.sources.find(s=>s.tool===req.tool&&Object.entries(s.input).every(([k,v])=>req.input[k]===v))
 if(source)return {kind:'json',value:env(source.rows)}
 for(const s of c.sources)for(const row of s.rows){const q=detailRequests(s.tool,row,s.input).find(q=>q.kind==='facts');if(q&&q.tool===req.tool&&Object.entries(q.input).every(([k,v])=>req.input[k]===v))return {kind:'json',value:env([{content:'新增证据：'+(row.title||row.name||row.code)+' 的独立详情。',price:137}])}}
 throw Error('UNEXPECTED_TOOL_OR_ENTITY')
}
if(r.spec)createRoot(document.getElementById('root')).render(<CardSizeOverride.Provider value={size}><main style={{width,maxWidth:'100%'}}><CardRenderer spec={r.spec} persistenceKey={'task-qa:'+id} transport={transport} onDebugSession={s=>{window.qaSession=s}}/></main></CardSizeOverride.Provider>)
else document.getElementById('root').textContent='编译失败'
