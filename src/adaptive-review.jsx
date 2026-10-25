import React,{useEffect,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {CardRenderer} from './cardspec/Renderer.jsx'
import {ToolSettings} from './cardspec/ToolCard.jsx'
import {CardSizeControl} from './CardSize.jsx'
import './styles/tokens.css'
import './styles/themes.css'
const box={background:'#fff',borderRadius:18,padding:18,minWidth:0}
function Review(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[selected,setSelected]=useState('01-counter'),[feedback,setFeedback]=useState({})
 useEffect(()=>{fetch('/adaptive-eval/data.json').then(r=>{if(!r.ok)throw Error('评估结果尚未生成');return r.json()}).then(setData).catch(e=>setError(e.message));try{setFeedback(JSON.parse(localStorage.getItem('rsi-adaptive-feedback'))||{})}catch{}},[])
 if(!data)return <p>{error||'加载对照…'}</p>
 const entries=data.records.filter(r=>r.result.id===selected),current=entries.find(r=>r.result.profile==='adaptive-v1'),old=entries.find(r=>r.result.profile==='legacy')
 const hash=current?.artifactHash,note=feedback[hash]?.note||'',baseline=data.html?.find(r=>r.id===selected)
 const save=value=>{const next={...feedback,[hash]:{caseId:current?.caseId,track:current?.track,artifactHash:hash,note:value,reviewStatus:'unreviewed',trainingEligible:false}};setFeedback(next);try{localStorage.setItem('rsi-adaptive-feedback',JSON.stringify(next))}catch{setError('浏览器存储不足，请立即导出意见')}}
 const exportFeedback=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(Object.values(feedback),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='rsi-adaptive-feedback.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 const card=(entry,label)=><section style={box}><h2 style={{fontSize:18}}>{label}</h2><p>{entry?.result.status||'未测试'} · {((entry?.result.elapsed||0)/1000).toFixed(1)} 秒 · 修复 {entry?.result.repairCount??'—'}</p>{entry?.message?.metadata?.card_spec?<ToolSettings.Provider value={false}><CardRenderer key={entry.artifactHash} spec={entry.message.metadata.card_spec} resources={entry.message.metadata.resources||{}} streaming={false} toolsReady={false}/></ToolSettings.Provider>:<p>{entry?.result.error||'无有效卡片'}</p>}<details><summary>生成诊断与原文</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:400,overflow:'auto'}}>{JSON.stringify({diagnostics:entry?.message?.metadata?.diagnostics,budget:entry?.metadata?.generationBudget},null,2)}{'\n'}{entry?.source}</pre></details></section>
 return <main style={{fontFamily:'system-ui',background:'#f2f4f8',color:'#1b2433',minHeight:'100vh',padding:24}}>
  <header style={{maxWidth:1450,margin:'auto'}}><small>RSI / LOCAL EXPERIMENT</small><h1>更短契约是否带来更好体验？</h1><p>同题对照；生成通过不代表功能通过。此页禁用工具调用，操作状态留在当前页面。意见绑定产物 hash，不能直接进入训练。</p><a href="/h5-baseline/index.html" target="_blank" rel="noreferrer">五个 H5 基线 ↗</a> · <a href="/adaptive-eval/report.html">完整统计报告 ↗</a><p><select aria-label="案例" value={selected} onChange={e=>setSelected(e.target.value)}>{data.cases.map(c=><option key={c.id} value={c.id}>{c.id} · {c.area||c.prompt.slice(0,24)}</option>)}</select></p><CardSizeControl/><p>{data.cases.find(c=>c.id===selected)?.prompt}</p></header>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,340px),1fr))',gap:20,maxWidth:1450,margin:'24px auto'}}>
   {card(old,'对照 · 原生成流程')}{card(current,'实验 · Adaptive CardSpec')}
   {baseline&&<section style={box}><h2 style={{fontSize:18}}>历史 HTML Reference</h2><p>历史模型输出；不同批次，耗时不作同期比较。离线预览禁用外链图片及脚本，不用于完整视觉评分。</p><iframe title="HTML reference" sandbox="allow-scripts" referrerPolicy="no-referrer" style={{border:0,width:'100%',height:450,borderRadius:16}} srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'">${baseline.source}`}/></section>}
  </div><section style={{...box,maxWidth:950,margin:'auto'}}><h2>下一轮反馈</h2><p>表达是否贴合任务？哪些操作有价值，哪些信息缺失？请区分视觉偏好与业务错误。</p><textarea aria-label="评估意见" style={{boxSizing:'border-box',width:'100%',minHeight:140,font:'inherit'}} value={note} onChange={e=>save(e.target.value)} disabled={!hash}/><button type="button" onClick={exportFeedback}>导出反馈 JSON</button>{error&&<p role="alert">{error}</p>}<small>artifact: {hash||'无'}</small></section>
 </main>
}
createRoot(document.getElementById('root')).render(<Review/>)
