import React from 'react'
import {detailLabel,displayValue,safeLink} from '../../shared/cardspec/result-view.mjs'
function Value({value}){
 if(value===null||value===undefined||value==='')return <span className="cs-detail-empty">暂无数据</span>
 if(Array.isArray(value))return value.every(v=>v==null||typeof v!=='object')?<span className="cs-detail-tags">{value.map((v,i)=><span key={i}>{displayValue(v)}</span>)}</span>:<div className="cs-detail-nested">{value.map((v,i)=><details key={i}><summary>第 {i+1} 项</summary><Value value={v}/></details>)}</div>
 if(typeof value==='object')return <dl className="cs-detail-properties">{Object.entries(value).map(([k,v])=><React.Fragment key={k}><dt>{detailLabel(k)}</dt><dd><Value value={v}/></dd></React.Fragment>)}</dl>
 return <span>{displayValue(value)}</span>
}
export function DetailFacts({model}){
 return <div className="cs-detail-body">
  {model.records?.map((record,i)=><section key={i} aria-label={record.title}><h4>{record.title}</h4><DetailFacts model={record}/></section>)}
  {model.metrics.length>0&&<section className="cs-detail-metrics" aria-label="关键数据">{model.metrics.map(f=><div key={f.id}><span>{f.label}</span><strong>{displayValue(f.value)}</strong></div>)}</section>}
  {model.facts.length>0&&<section aria-label="基本信息"><h4>基本信息</h4><dl className="cs-detail-properties">{model.facts.map(f=><React.Fragment key={f.id}><dt>{f.label}</dt><dd><Value value={f.value}/></dd></React.Fragment>)}</dl></section>}
  {model.narrative.map(f=><section className="cs-detail-narrative" key={f.id}><h4>{f.label}</h4>{typeof f.value==='string'&&f.value.length>160?<><p>{f.value.slice(0,100)}…</p><details><summary>展开{f.label}</summary><p>{f.value}</p></details></>:<Value value={f.value}/>}</section>)}
  {model.technical.length>0&&<details className="cs-detail-source"><summary>来源与标识 · {model.technical.length}</summary><dl className="cs-detail-properties">{model.technical.map(f=><React.Fragment key={f.id}><dt>{f.label}</dt><dd>{/url$/i.test(f.key)&&safeLink(f.value)?<a href={safeLink(f.value)} target="_blank" rel="noreferrer">打开来源 ↗</a>:<Value value={f.value}/>}</dd></React.Fragment>)}</dl></details>}
 </div>
}
