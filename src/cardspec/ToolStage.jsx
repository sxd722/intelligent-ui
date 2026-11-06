import React from 'react'
import {useViewState} from './view-state.jsx'
import {GeographicMap} from './GeographicMap.jsx'
import {resultImageSources} from '../../shared/cardspec/result-view.mjs'
import './tool-stage.css'

export const STAGED_KINDS=['weather','places','media','route','metrics']
export function ToolStage({model,rows,format='4x4',availableHeight,onInspect,onChoose,scope='' }){
 const [saved,set]=useViewState('tool-stage',{scope,index:0,chosen:[],difference:false})
 const view=saved.scope===scope?saved:{scope,index:0,chosen:[],difference:false}
 const index=Math.min(view.index,Math.max(0,rows.length-1)),item=rows[index],compact=format==='2x2'||availableHeight<220
 const update=patch=>set({...view,...patch,scope}),chosen=model.items.filter(r=>view.chosen.includes(r.key))
 const toggle=()=>{const keys=view.chosen.includes(item.key)?view.chosen.filter(k=>k!==item.key):[...(model.kind==='route'?[]:view.chosen.slice(model.kind==='places'?-2:-1)),item.key];if(onChoose?.(item,model.items.filter(r=>keys.includes(r.key)))!==false)update({chosen:keys})}
 if(!item)return null
 const num=n=>typeof n==='number'&&Number.isFinite(n),show=n=>n==null?'—':n
 const metric=<span className="ts-number">{show(item.metric)}<small>{model.metricLabel}</small></span>
 const inspect=<button onClick={()=>onInspect(item)} aria-label={'查看 '+item.title}>查看详情 ↗</button>
 const pager=rows.length>1&&<nav className="ts-pager" aria-label="工具舞台切换"><button aria-label="上一项" disabled={index===0} onClick={()=>update({index:index-1})}>‹</button><span>{index+1} / {rows.length}</span><button aria-label="下一项" disabled={index===rows.length-1} onClick={()=>update({index:index+1})}>›</button></nav>
 let visual
 if(model.kind==='weather'){
  const days=rows.slice(0,3),values=days.flatMap(r=>[r.metric,r.secondary]).filter(num),lo=Math.min(...values),hi=Math.max(...values),y=v=>92-(v-lo)/Math.max(1,hi-lo)*58
  visual=<><div className="ts-headline"><span><strong>{item.title}</strong><span>{item.subtitle}</span></span>{metric}</div>{!compact&&<svg className="ts-weather" viewBox="0 0 300 120" role="img" aria-label="三日温度范围，同一摄氏温度坐标轴">{days.map((r,i)=><g key={r.key} role="button" tabIndex={0} aria-label={'天气 '+r.title} onClick={()=>update({index:i})} onKeyDown={e=>e.key==='Enter'&&update({index:i})}><rect x={i*98+2} y={8} width={92} height={108} rx={14} fill="currentColor" opacity={index===i?.12:.035}/>{num(r.metric)&&num(r.secondary)&&<><path d={`M${i*98+48} ${y(r.metric)}V${y(r.secondary)}`} stroke="currentColor" strokeWidth="9" strokeLinecap="round"/><text x={i*98+60} y={y(r.metric)+4}>{r.metric}°</text><text x={i*98+60} y={y(r.secondary)+4}>{r.secondary}°</text></>}<text x={i*98+48} y={112} textAnchor="middle">{r.title.slice(5)}</text></g>)}</svg>}<span className="ts-caption">最低 {show(item.secondary)}°C{item.raw?.location?' · '+item.raw.location:''}</span></>
 }else if(model.kind==='media'){
  visual=<><div className="ts-posters">{rows.slice(Math.max(0,index-1),index+2).map(r=><button key={r.key} className={r.key===item.key?'is-focus':''} onClick={()=>update({index:rows.indexOf(r)})} aria-label={'聚焦 '+r.title}><StageImage item={r}/><span>{r.title}</span></button>)}</div><div className="ts-headline"><strong>{item.title}</strong>{metric}</div><div className="ts-controls"><div className="ts-actions"><button aria-pressed={view.chosen.includes(item.key)} onClick={toggle}>加入对比</button>{inspect}</div>{pager}</div>{chosen.length>0&&<div className="ts-compare" aria-label="电影对比">{chosen.map(r=><span key={r.key}>{r.title}<b>{show(r.metric)} <small>{model.metricLabel}</small></b></span>)}</div>}</>
 }else if(model.kind==='route'){
  visual=<><div className="ts-ticket"><div className="ts-headline"><strong>{item.title}</strong><span>{item.time}</span></div><div className="ts-rail"><span><b>{item.departure}</b>{item.from}</span><svg viewBox="0 0 100 20" aria-hidden="true"><path d="M6 10H94" stroke="currentColor" strokeDasharray="2 5"/><circle cx="6" cy="10" r="4" fill="currentColor"/><circle cx="94" cy="10" r="4" fill="currentColor"/></svg><span><b>{item.arrival}</b>{item.to}</span></div>{metric}</div><div className="ts-controls"><div className="ts-actions"><button aria-pressed={view.chosen.includes(item.key)} onClick={toggle}>固定车次</button>{inspect}</div>{pager}</div>{chosen.length>0&&<div className="ts-compare" aria-label="固定车次">{chosen.map(r=><span key={r.key}>{r.title} · {r.departure} → {r.arrival}</span>)}</div>}</>
 }else if(model.kind==='metrics'){
  const data=rows.slice(index,index+(compact?1:availableHeight<340?2:4)),values=rows.flatMap(r=>[r.metric,r.secondary]).filter(num),min=Math.min(0,...values),max=Math.max(1,...values),x=v=>18+(v-min)/Math.max(1,max-min)*244,comparative=!!model.secondaryLabel
  visual=<><div className="ts-controls">{pager}{comparative&&<button className="ts-mode" aria-pressed={view.difference} onClick={()=>update({difference:!view.difference})}>{view.difference?'显示绝对评分':'显示同级差值'}</button>}</div><div className="ts-dimensions">{data.map(r=><button key={r.key} onClick={()=>onInspect(r)}><span>{r.title}</span><b>{view.difference?(num(r.metric)&&num(r.secondary)?((r.metric-r.secondary)>=0?'+':'')+(r.metric-r.secondary).toFixed(2):'—'):show(r.metric)}</b><svg viewBox="0 0 280 24" role="img" aria-label={`${r.title} 评分 ${show(r.metric)}，同级均值 ${show(r.secondary)}`}>{num(r.metric)&&num(r.secondary)&&<path d={`M${x(r.metric)} 12H${x(r.secondary)}`} stroke="currentColor" strokeWidth="3" opacity=".5"/>}{num(r.secondary)&&<circle cx={x(r.secondary)} cy={12} r={5} fill="none" stroke="currentColor"/>}{num(r.metric)&&<circle cx={x(r.metric)} cy={12} r={6} fill="currentColor"/>}</svg></button>)}</div><small>● {model.metricLabel||'来源数值'}{comparative?'　○ '+model.secondaryLabel:''}</small></>
 }else{
  const mapped=rows.filter(r=>r.raw.coordSystem==='WGS84'&&num(r.raw.lat??r.raw.latitude)&&num(r.raw.lon??r.raw.longitude)).map(r=>({id:r.key,title:r.title,lat:r.raw.lat??r.raw.latitude,lon:r.raw.lon??r.raw.longitude}))
  visual=<>{!compact&&mapped.length>0&&<div className="ts-map"><GeographicMap p={{items:mapped,selectedId:item.key,label:'已核实坐标的地点'}} fire={(_,e)=>{const n=rows.findIndex(r=>r.key===e.id);if(n>=0)update({index:n})}}/></div>}<div className="ts-place"><StageImage item={item}/><div><strong>{item.title}</strong><span>{item.subtitle||item.facet}</span>{metric}</div></div>{!mapped.length&&!compact&&<small>来源未提供已确认坐标，保留地点选择。</small>}<div className="ts-controls"><div className="ts-actions"><button aria-pressed={view.chosen.includes(item.key)} onClick={toggle}>选入地点</button>{inspect}</div>{pager}</div>{chosen.length>0&&<span className="ts-caption" aria-label="已选地点">{chosen.map(r=>r.title).join(' · ')}</span>}</>
 }
 return <div className="tool-stage" data-format={compact?'2x2':format} data-constrained={Number.isFinite(availableHeight)} data-presentation={model.kind}>{visual}{model.kind==='weather'&&pager}</div>
}
function StageImage({item}){
 const [failed,setFailed]=React.useState([]),raw=item.raw||{},src=[...(typeof raw.assetRef==='string'?['/api/tools/assets/'+encodeURIComponent(raw.assetRef)]:[]),...resultImageSources(raw)].find(s=>!failed.includes(s))
 return <span className="ts-image">{src?<img src={src} alt={item.title} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(f=>[...f,src])}/>:<span aria-label="暂无来源图片">{item.title.slice(0,2)}</span>}</span>
}
