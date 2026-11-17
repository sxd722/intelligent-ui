import React,{useEffect,useState} from 'react'
import {Markdown} from './md.jsx'
import {flushRsi} from './rsi-client.mjs'
export function RsiFeedback({id,ready}){
 const [open,setOpen]=useState(false),[record,setRecord]=useState(null),[comment,setComment]=useState(''),[status,setStatus]=useState('')
 async function refresh(){try{const r=await fetch('/api/rsi-journal/'+encodeURIComponent(id));if(!r.ok)throw Error('此记录尚未归档；旧卡片没有完整历史 trace。');setRecord(await r.json());setStatus('')}catch(e){setStatus(e.message)}}
 useEffect(()=>{if(!open||!ready)return;void refresh();const t=setInterval(refresh,10000);return()=>clearInterval(t)},[id,open,ready])
 async function save(){try{await flushRsi();const r=await fetch('/api/rsi-journal/'+encodeURIComponent(id)+'/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({comment})});if(!r.ok)throw Error((await r.json()).error);setComment('');setStatus('反馈已保存，建议正在更新');await refresh()}catch(e){setStatus(e.message)}}
 async function analyze(){await flushRsi();const r=await fetch('/api/rsi-journal/'+encodeURIComponent(id)+'/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});setStatus(r.ok?'已启动 GLM-5.3 深度审阅':'启动失败');await refresh()}
 if(import.meta.env.VITE_CLOUD_NO_TOOLS==='1'||!ready)return null
 return <details className="card-prose" style={{maxWidth:800,margin:'12px 0'}} onToggle={e=>setOpen(e.currentTarget.open)}><summary>生成记录与反馈 · RSI</summary>
  <p><a href={'/rsi-journal.html?id='+encodeURIComponent(id)} target="_blank" rel="noreferrer">打开完整记录 / 多次生成</a> · 保存在本机；模型建议需人工审阅。</p>
  <textarea aria-label="卡片反馈" rows={3} style={{width:'100%'}} placeholder="哪些设计或交互有帮助？哪些未达成？" value={comment} maxLength={10000} onChange={e=>setComment(e.target.value)}/>
  <div><button disabled={!comment.trim()||!record} onClick={save}>保存 comment 并更新建议</button> <button disabled={!record||record.analysis?.status==='running'} onClick={analyze}>分析最新交互</button></div>
  <p role="status">{status||({running:'GLM-5.3 深度审阅中…',failed:'建议生成失败：'+record?.analysis?.error,completed:'建议已生成，尚未人工确认'}[record?.analysis?.status]||'')}</p>
  {record?.feedback?.map((f,i)=><blockquote key={i}>{f.comment}<small> · {f.at}</small></blockquote>)}
  {record?.analysis?.content&&<details><summary>GLM-5.3 改进建议（未人工确认）</summary><Markdown text={record.analysis.content}/></details>}
 </details>
}
