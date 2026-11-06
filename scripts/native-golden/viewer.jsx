import {auditLayout} from '../../src/cardspec/layout-audit.js'
import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import {makeScope} from '../../shared/cardspec/store.mjs'
import {CardDeck} from '../../src/cardspec/CardDeck.jsx'
import {CardSizeOverride} from '../../src/CardSize.jsx'
import {SandboxSettings} from '../../src/SandboxMode.jsx'
import {toolTransport} from '../../src/cardspec/tool-session.mjs'
import '../../src/styles/tokens.css'
import '../../src/styles/themes.css'
const p=new URLSearchParams(location.search),id=p.get('id')||'trip',r=await fetch('./runs/'+id+'.json').then(r=>r.json())
window.qaAudit=()=>auditLayout(document.querySelector('.cs-card'),{noScroll:true});window.qaCalls=[];window.qaRun=r
const transport=async(payload,signal,onProgress)=>{
 const call={tool:payload.tool,input:payload.input,target:payload.target,startedAt:new Date().toISOString(),events:[]};window.qaCalls.push(call)
 try{const result=await toolTransport(payload,signal,e=>{call.events.push(e);onProgress?.(e)});call.result=result;return result}catch(e){call.error=e.message;throw e}finally{call.finishedAt=new Date().toISOString()}
}
function App(){const [width,setWidth]=useState(Number(p.get('width')||432)),[size,setSize]=useState(p.get('size')||'square');return <>
 <header className="qa-toolbar"><a href="./report.html">验收报告</a><strong>{r.title}</strong><label>宽度<select aria-label="验收宽度" value={width} onChange={e=>setWidth(+e.target.value)}>{[320,360,432].map(w=><option key={w}>{w}</option>)}</select></label><label>尺寸<select aria-label="验收尺寸" value={size} onChange={e=>setSize(e.target.value)}><option value="square">square</option><option value="auto">auto</option></select></label></header>
 <SandboxSettings.Provider value={r.spec?.context?.renderMode||'native'}><CardSizeOverride.Provider value={size}><main style={{width,maxWidth:'100%',margin:'auto'}}>{r.spec?<CardDeck deck={r.metadata?.card_deck} spec={r.spec} resources={r.metadata?.resources} toolsReady={r.status==='succeeded'||r.status==='diagnostic'} transport={transport} storageNamespace={'native-golden:'+id} onDebugSession={s=>{window.qaSession=s;window.qaScope=()=>makeScope(s.current().spec,s.current().store,{bindings:s.current().bindings})}}/>:<p role="alert">生成未通过：{r.events?.find(e=>e.type==='stream_error')?.error?.message||r.error}</p>}</main></CardSizeOverride.Provider></SandboxSettings.Provider>
 <details className="qa-prompt"><summary>完整需求 / 生成边界</summary>{r.prompt}<p>真实生成与当前工具调用；没有替身。报告中的已录制结果保留当时来源与时间。</p></details>
 </>}
createRoot(document.getElementById('root')).render(<App/>);
