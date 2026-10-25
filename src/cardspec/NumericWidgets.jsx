import React,{useEffect,useState} from 'react'
import {countdownState} from '../../shared/cardspec/time.mjs'
import './numeric-widgets.css'
import {useViewState} from './view-state.jsx'
import {useCompositionSpace} from './useCompositionSpace.js'

export function Countdown({p}){
 const [now,setNow]=useState(Date.now)
 useEffect(()=>{
  let timer
  const update=()=>{clearTimeout(timer);setNow(Date.now());if(!document.hidden)timer=setTimeout(update,1000-Date.now()%1000+10)}
  update();document.addEventListener('visibilitychange',update)
  return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',update)}
 },[p.target])
 const result=countdownState(p.target,now)
 return <div className="cs-countdown"><span>{p.label||'倒计时'}</span><strong role="timer" aria-live="off" data-status={result.status}>{result.status==='expired'?(p.expiredLabel||result.text):result.text}</strong></div>
}

export function CopyText({p,streaming}){
 const [status,setStatus]=useState('')
 useEffect(()=>setStatus(''),[p.value])
 return <div className="cs-copy"><button type="button" className="cs-button" disabled={streaming} onClick={async()=>{
  try{if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');await navigator.clipboard.writeText(p.value);setStatus('copied')}catch{setStatus('manual')}
 }}>{p.label||'复制'}</button>{status==='copied'&&<small role="status">已复制</small>}{status==='manual'&&<label>请手动复制<textarea readOnly value={p.value} onFocus={e=>e.target.select()}/></label>}</div>
}

export function Heatmap({p,fire}){
 const [root,height]=useCompositionSpace(),[windowStart,setWindowStart]=useViewState('heatmap-window',0)
 const [selection,setSelection]=useViewState('heatmap',null), row=p.selectedRow??selection?.rowId,column=p.selectedColumn??selection?.columnId
 const max=Math.max(1e-12,...p.values.flat().filter(v=>v!==null).map(Math.abs))
 const rowCount=height===null?p.rows.length:Math.max(1,Math.min(p.rows.length,Math.floor((height-72)/41)>=p.rows.length?p.rows.length:Math.floor((height-110)/41)))
 const start=Math.min(Math.max(0,windowStart),Math.max(0,p.rows.length-rowCount))
 return <section ref={root} className="cs-heatmap" aria-label={p.label}><strong>{p.label}</strong><small>负值 / 正值 · — 表示未知</small><div className="cs-heatmap-scroll" tabIndex={0}>
  <div className="cs-heatmap-grid" style={{gridTemplateColumns:`minmax(36px,.8fr) repeat(${p.columns.length},minmax(36px,1fr))`}}><span/>{p.columns.map(c=><span className="cs-heatmap-label" key={c.id}>{c.label}</span>)}
   {p.rows.slice(start,start+rowCount).map((r,offset)=>{const i=start+offset;return <React.Fragment key={r.id}><span className="cs-heatmap-label">{r.label}</span>{p.columns.map((c,j)=>{
    const value=p.values[i][j],selected=row===r.id&&column===c.id,alpha=value===null?0:.12+.65*Math.abs(value)/max
    return <button type="button" key={c.id} data-row-selected={row===r.id||undefined} aria-label={`${r.label} / ${c.label}：${value===null?'未知':value}`} aria-pressed={selected} style={{backgroundColor:value===null?'var(--cs-field-mask)':`rgba(${value<0?'137,115,220':'38,155,137'},${alpha})`}} onClick={()=>{const event={rowId:r.id,columnId:c.id,value};if(fire('onSelect',event)!==false)setSelection(event)}}>{value===null?'—':Number(value.toPrecision(3))}</button>
   })}</React.Fragment>})}
  </div></div>{rowCount<p.rows.length&&<nav className="cs-matrix-pages" aria-label="矩阵行浏览"><button disabled={!start} onClick={()=>setWindowStart(Math.max(0,start-rowCount))}>前组</button><span>{start+1}–{Math.min(start+rowCount,p.rows.length)} / {p.rows.length} 行</span><button disabled={start+rowCount>=p.rows.length} onClick={()=>setWindowStart(start+rowCount)}>后组</button></nav>}</section>
}
