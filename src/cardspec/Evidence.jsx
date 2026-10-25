import React from 'react'
import './evidence.css'

const urlFor=source=>{try{const u=new URL(source?.url);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null}catch{return null}}
export function EvidenceText({text,research}){
  if(!research||!text.includes('[S'))return text
  return text.split(/(\[S\d+\])/g).map((part,i)=>{
    const id=part.match(/^\[(S\d+)\]$/)?.[1],source=research.evidence?.find(s=>s.id===id),url=urlFor(source)
    return id?<sup key={i} className="cs-citation">{url?<a href={url} title={`${source.title} · ${source.kind==='page'?'正文节选':'搜索摘要'}`} target="_blank" rel="noreferrer noopener">{part}</a>:<span title="此引用没有可用证据">[来源未核实]</span>}</sup>:part
  })
}
export function EvidenceSources({research}){
  if(!research?.evidence?.length&&!research?.trace?.some(t=>['failed','empty'].includes(t.status)))return null
  const sources=research.evidence||[]
  return <details className="cs-evidence"><summary>参考来源 · {sources.length} <small>来源可追溯，结论仍需核对</small></summary>
    {sources.map(s=><div key={s.id}><a href={urlFor(s)||undefined} target="_blank" rel="noreferrer noopener">[{s.id}] {s.title}</a><small>{s.kind==='page'?'已读正文节选':'搜索摘要'} · 获取于 {new Date(s.fetchedAt).toLocaleString()}{s.publishedAt?` · 发布 ${s.publishedAt}`:''}</small><p>{s.excerpt}</p></div>)}
    {research.trace?.some(t=>['failed','empty'].includes(t.status))&&<small>部分检索失败或未找到来源，缺失信息应视为未核实。</small>}
  </details>
}
