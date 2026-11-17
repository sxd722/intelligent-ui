import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CardDeck} from '../../src/cardspec/CardDeck.jsx';
import {CardSizeOverride} from '../../src/CardSize.jsx';
import {SandboxSettings} from '../../src/SandboxMode.jsx';
import {toolTransport} from '../../src/cardspec/tool-session.mjs';
import '../../src/styles/tokens.css';
import '../../src/styles/themes.css';
const p=new URLSearchParams(location.search),id=p.get('id')||'earth-sounds',r=await fetch('./runs/'+id+'.json').then(r=>r.json());
const calls=[];let currentSession,update=()=>{};
const transport=async(payload,signal,onProgress)=>{const c={tool:payload.tool,input:payload.input,startedAt:new Date().toISOString(),events:[]};calls.push(c);update();try{c.result=await toolTransport(payload,signal,e=>{c.events.push(e);onProgress?.(e);update()});return c.result}catch(e){c.error=e.message;throw e}finally{c.finishedAt=new Date().toISOString();update()}};
function App(){const [width,setWidth]=useState(Number(p.get('width')||432)),[size,setSize]=useState('square'),[evidence,setEvidence]=useState('');update=()=>setEvidence(JSON.stringify({calls,state:currentSession?.current()?.store?.values},null,2));return <>
 <header><a href="report.html">报告</a><b>{r.title}</b><label>宽度<select aria-label="验收宽度" value={width} onChange={e=>setWidth(+e.target.value)}>{[320,360,432].map(w=><option key={w}>{w}</option>)}</select></label><label>尺寸<select aria-label="验收尺寸" value={size} onChange={e=>setSize(e.target.value)}><option value="square">square</option><option value="auto">auto</option></select></label><button onClick={update}>记录当前证据</button></header>
 <section className="comparison"><article><h2>CardSpec · {r.status==='succeeded'?'真实交互':'未通过诊断稿'}</h2>{r.status!=='succeeded'&&<p role="alert">生成失败；以下仅保留可检查的草稿，本页禁用其工具执行，不算成功交付。</p>}<SandboxSettings.Provider value="hybrid"><CardSizeOverride.Provider value={size}><main style={{width,maxWidth:'100%'}}>{r.spec?<CardDeck deck={r.metadata?.card_deck} spec={r.spec} resources={r.metadata?.resources} toolsReady={r.status==='succeeded'} transport={transport} storageNamespace={'creative-live:'+id} onDebugSession={s=>{currentSession=s;}}/>:<p role="alert">本轮生成未交付卡片：{r.error||r.events?.findLast(e=>e.type==='stream_error')?.error?.message||r.status}</p>}</main></CardSizeOverride.Provider></SandboxSettings.Provider><p>状态：{r.status||'未返回终态'} · {(r.elapsedMs/1000).toFixed(1)} 秒</p></article><article><h2>Stitch · 视觉 Mock</h2><img style={{width,maxWidth:'100%'}} alt="同需求 Stitch 设计稿" src={'/api/stitch-comparisons/'+r.stitchId+'/image'}/><p>按钮与数据只是设计表达，不算功能通过。</p></article></section>
 <details><summary>需求与验收点</summary><p>{r.prompt}</p><ul>{r.requirements.map(x=><li key={x}>{x}</li>)}</ul></details><details><summary>运行时工具与状态证据</summary><pre id="evidence">{evidence}</pre></details>
 </>}
createRoot(document.getElementById('root')).render(<App/>);
