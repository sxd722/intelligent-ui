import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import {CardDeck} from '../src/cardspec/CardDeck.jsx'
import {CardSizeOverride} from '../src/CardSize.jsx'
import {SandboxSettings} from '../src/SandboxMode.jsx'
import {toolTransport} from '../src/cardspec/tool-session.mjs'
import '../src/styles/tokens.css'
import '../src/styles/themes.css'
const p=new URLSearchParams(location.search),id=p.get('id')||'movies',round=p.get('round')==='round2'?'round2/':'',r=await fetch('./'+round+'runs/'+id+'.json').then(r=>r.json())
function App(){const [width,setWidth]=useState(432),[size,setSize]=useState('auto');return <>
 <header><a href="report.html">调查与测试报告</a><b>{r.title}</b><label>宽度<select aria-label="宽度" value={width} onChange={e=>setWidth(+e.target.value)}>{[320,360,432].map(w=><option key={w}>{w}</option>)}</select></label><label>尺寸<select aria-label="尺寸" value={size} onChange={e=>setSize(e.target.value)}><option value="square">square</option><option value="auto">auto</option></select></label></header>
 <p>{r.status==='succeeded'?'模型生成通过；完整功能以报告独立操作证据为准。':'未通过生成验收：仅诊断预览，不代表可用交付；本页禁用工具执行。'} · {(r.elapsedMs/1000).toFixed(1)} 秒</p>
 <SandboxSettings.Provider value="native"><CardSizeOverride.Provider value={size}><main style={{width,maxWidth:'100%',margin:'20px auto'}}>{r.spec?<CardDeck spec={r.spec} deck={r.metadata?.card_deck} resources={r.metadata?.resources} toolsReady={r.status==='succeeded'} transport={toolTransport} storageNamespace={'core-task-qa:'+round+id}/>:<p>未生成卡片</p>}</main></CardSizeOverride.Provider></SandboxSettings.Provider>
 <details><summary>用户任务</summary><p>{r.prompt}</p></details><details><summary>任务路由与调用证据</summary><pre>{JSON.stringify(r.events.filter(e=>e.type==='cardplan'||e.type==='research').map(e=>({...e,taskRouting:e.taskRouting})),null,2)}</pre></details>
 </>}
createRoot(document.getElementById('root')).render(<App/>);
