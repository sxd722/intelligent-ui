import {resultCoverage} from '../../shared/cardspec/result-pagination.mjs'
import {ToolStage,STAGED_KINDS} from './ToolStage.jsx'
import React,{useState,useContext,useId,useLayoutEffect} from 'react'
import {useViewState} from './view-state.jsx'
import {ToolSettings} from './ToolCard.jsx'
import {TOOLS} from '../../shared/cardspec/tools.mjs'
import {mapToolPresentation,TOOL_VIEW_KINDS} from '../../shared/cardspec/tool-presentations.mjs'
import {resultImageSources,safeLink,displayValue,detailRequests} from '../../shared/cardspec/result-view.mjs'
import {PointMap} from './Experience.jsx'
import {useCardSize} from '../CardSize.jsx'
import {useCompositionSpace} from './useCompositionSpace.js'
import './tool-view.css'
import {TaskToolView} from './TaskToolView.jsx'
import {NativeDecisionView} from './NativeDecisionView.jsx'
import {decisionProfile} from '../../shared/cardspec/decision-profile.mjs'

function Thumb({item}){
 const [failed,setFailed]=useState([]),src=[...(typeof item.raw.assetRef==='string'?['/api/tools/assets/'+encodeURIComponent(item.raw.assetRef)]:[]),...resultImageSources(item.raw)].find(u=>!failed.includes(u))
 return <span className="tv-thumb">{src?<img src={src} loading="lazy" referrerPolicy="no-referrer" alt={item.title} onError={()=>setFailed(v=>[...v,src])}/>:<span aria-label="无来源图片">{item.title.slice(0,1)}</span>}</span>
}
function WeatherVisual(){const id=useId();return <svg className="tv-weather-art" viewBox="0 0 160 100" aria-label="天气主题插画（非实时天气图标）"><defs><radialGradient id={id}><stop stopColor="currentColor"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></radialGradient></defs><circle cx="80" cy="50" r="46" fill={`url(#${id})`} opacity=".3"/><g className="tv-orbit" stroke="currentColor" strokeWidth="2">{Array.from({length:8},(_,i)=><path key={i} transform={`rotate(${i*45} 80 50)`} d="M80 12v9"/>)}</g><circle cx="80" cy="50" r="20" fill="currentColor" opacity=".65"/></svg>}
export function ToolView(props){const profile=decisionProfile(props.runtime.spec.bindings?.[props.p.binding]?.tool),task=props.p.task;return profile&&!task?.groupBy&&!task?.aggregate&&!(profile.kind==='poster'&&(task?.pin||task?.selection==='single'||task?.compare===false))?<NativeDecisionView {...props}/>:task?<TaskToolView {...props}/>:<StandardToolView {...props}/>}
function StandardToolView({p,runtime,scope,fire}){
 const size=useCardSize(),[root,height]=useCompositionSpace({sharePage:true})
 const [cardWidth,setCardWidth]=useState(320)
 useLayoutEffect(()=>{const stage=root.current?.closest('.cs-stage');if(!stage)return;const update=()=>setCardWidth(stage.clientWidth);const ro=new ResizeObserver(update);ro.observe(stage);update();return()=>ro.disconnect()},[root])
 const pageSize=size==='square'?Math.max(1,Math.min(2,Math.floor(((height??cardWidth-72)-148)/90))):3
 const enabled=useContext(ToolSettings),[view,set]=useViewState('collection',{query:'',facet:'',page:0,selected:null}),[raw,setRaw]=useState(false)
 const definition=runtime.spec.bindings?.[p.binding],record=runtime.page?.bindings?.[p.binding]||scope?.bindings?.[p.binding],tool=definition?.tool,t=TOOLS[tool]
 const value=record?.value,coverage=resultCoverage(value),model=mapToolPresentation(tool,value),busy=record?.status==='loading',session=runtime.session
 const ready=enabled&&!runtime.streaming&&!!session?.complete&&!session?.busy
 const pageContext=p.binding+':'+(record?.valueInputKey||record?.definitionKey||'')
 const change=patch=>set(v=>({...v,...patch,pageContext}))
 const browse=()=>session?.openResults(p.binding)
 const error=model.ok?null:model.error
 const loaded=!!(record?.updatedAt||record?.status==='success'||value?.items?.length)
 const rows=model.ok?model.items:[],query=view.query.toLowerCase(),facets=[...new Set(rows.map(r=>r.facet).filter(Boolean))].slice(0,8)
 const filtered=rows.filter(r=>(!view.facet||r.facet===view.facet)&&(!query||[r.title,r.subtitle,r.summary].some(s=>s?.toLowerCase().includes(query))))
 const page=Math.min(view.pageContext===pageContext?view.page:0,Math.max(0,Math.ceil(filtered.length/pageSize)-1)),selected=rows.find(r=>r.key===view.selected)
 const select=item=>{if(fire('onSelect',{id:item.raw.rowKey??item.raw.id??item.key,entityId:item.entityId,viewKey:item.viewKey,value:item.key,item:item.raw})!==false)change({selected:item.key,selectedItem:item.raw})}
 const family=p.style&&p.style!=='auto'?p.style:runtime.spec.design||'default'
 const metric=item=><span className="tv-metric"><b>{displayValue(item.metric)}</b><small>{model.metricLabel||'来源数值'}</small></span>
 return <section ref={root} className="cs-tool-view" style={size==="square"?{maxHeight:height||"calc(100cqw - 72px)"}:undefined} data-size={size} data-family={family} data-kind={model.kind||'fallback'} data-tool-view-error={loaded?error?.code:undefined} aria-label={p.label||'工具视图'}>
  <header><span><small>{TOOL_VIEW_KINDS[model.kind]||'工具数据'}</small><strong>{p.label||t?.site||tool||'工具视图'}</strong></span>{size==="square"&&rows.length>1&&<button aria-label="筛选候选" aria-pressed={!!view.filtersOpen} onClick={()=>change({filtersOpen:!view.filtersOpen})}>筛选</button>}<span className="tv-count">{loaded?(value?.items?.length??rows.length):'—'}<small>已获取</small></span><button aria-expanded={raw} onClick={()=>setRaw(!raw)}>数据</button></header>
  <div className="tv-status" role="status">{!enabled?'工具增强已关闭':busy?'正在更新，保留上次结果':record?.error||(!loaded?'尚未获取数据':coverage.label)}{record?.cache?.status==='hit'?' · 缓存':''}{record?.updatedAt&&<time> · {new Date(record.updatedAt).toLocaleTimeString()}</time>}</div>
  {(!loaded||record?.status==='error')&&t?.readOnly!==false&&<button type="button" disabled={!ready||busy} onClick={()=>session.retry(p.binding)}>{busy?'查询中…':'查询 / 重试'}</button>}
  {!loaded&&t?.readOnly===false&&<small>通过卡片中明确的操作执行后，这里展示回执；不会自动执行或重复操作。</small>}
  <div className="tv-body" hidden={raw} data-layout-scroll={selected||view.filtersOpen||error?"allow":undefined} data-scroll-region="tool-view">
  {loaded&&error?<div className="tv-fallback" role="status"><strong>自动展示暂不可用</strong><small>{error.code} · {error.message}</small><p>原始数据仍保留，可使用现有结果浏览或模型重排。</p><button disabled={!ready} onClick={browse}>浏览原始结果</button><button disabled={!ready||!value?.items?.length} onClick={()=>session.adaptResults(p.binding,'editorial')}>按实际结果重新组织</button></div>:<>
   {selected?<div className="tv-detail"><button onClick={()=>change({selected:null,selectedItem:null})}>← 返回候选</button><div className="tv-detail-head"><Thumb item={selected}/><div><h3>{selected.title}</h3><p>{selected.subtitle}</p></div></div>{selected.metric!=null&&metric(selected)}{selected.summary&&<p className="tv-description">{selected.summary}</p>}{selected.time&&<small>{selected.time}</small>}{safeLink(selected.url)&&<a href={safeLink(selected.url)} target="_blank" rel="noreferrer">查看来源 ↗</a>}{detailRequests(tool,selected.raw).length>0&&<button disabled={!ready} onClick={()=>{browse();session.openDetail(selected.raw)}}>查询完整详情</button>}<details><summary>本条原始信息</summary><pre>{JSON.stringify(selected.raw,null,2)}</pre></details></div>:<>
    {rows.length>1&&(size!=="square"||view.filtersOpen)&&<div className="tv-filter"><input aria-label="筛选已获取候选" placeholder="筛选已获取候选…" value={view.query} onChange={e=>change({query:e.target.value,page:0})}/>{facets.length>1&&<div className="tv-facets"><button aria-pressed={!view.facet} onClick={()=>change({facet:'',page:0})}>全部</button>{facets.map(f=><button key={f} aria-pressed={view.facet===f} onClick={()=>change({facet:f,page:0})}>{f}</button>)}</div>}</div>}
    {!(size==='square'&&view.filtersOpen)&&<>
    {STAGED_KINDS.includes(model.kind)?<ToolStage scope={tool+':'+(record?.valueInputKey||'')} availableHeight={size==='square'?(height??cardWidth-72)-110:Infinity} model={model} rows={filtered} format={p.format||((height??300)<250?'2x2':size==='square'?'4x4':'miniapp')} onInspect={select} onChoose={(item,items)=>fire('onSelect',{id:item.raw.rowKey??item.raw.id??item.key,entityId:item.entityId,viewKey:item.viewKey,value:item.key,item:item.raw,items:items.map(i=>i.raw),ids:items.map(i=>i.key)})}/>:<>
    {model.kind==='places'&&rows.some(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lon))&&<PointMap p={{items:filtered.map(r=>({...r.raw,id:r.key,title:r.title,lat:r.lat,lon:r.lon}))}} fire={(_,e)=>{const r=rows.find(r=>r.key===e.id);if(r)select(r)}}/>}
    {model.kind==='weather'&&<WeatherVisual/>}
    <div className="tv-items">
     {filtered.slice(page*pageSize,page*pageSize+pageSize).map((item,i)=><button type="button" key={item.key} className="tv-item" onClick={()=>select(item)} aria-label={`查看 ${item.title}`}>
      {model.kind==='media'?<Thumb item={item}/>:<span className="tv-index">{String(page*pageSize+i+1).padStart(2,'0')}</span>}
      <span className="tv-item-main"><strong>{item.title}</strong>{item.subtitle&&<small>{item.subtitle}</small>}{model.kind==='route'&&<span className="tv-route"><span><b>{item.departure}</b>{item.from}</span><svg viewBox="0 0 80 20" aria-hidden="true"><path d="M3 10H77" stroke="currentColor" strokeDasharray="3 4"/><circle cx="6" cy="10" r="3" fill="currentColor"/><path d="m68 5 8 5-8 5" fill="none" stroke="currentColor"/></svg><span><b>{item.arrival}</b>{item.to}</span></span>}{item.time&&<small>{item.time}</small>}{model.kind==='detail'&&item.summary&&<span className="tv-excerpt">{item.summary}</span>}
       {model.kind==='metrics'&&typeof item.metric==='number'&&<svg className="tv-bar" viewBox="0 0 200 14" aria-label={`${item.title} ${item.metric}`}><path d="M100 0v14" stroke="currentColor" opacity=".3"/><rect x={item.metric<0?100-Math.abs(item.metric)/Math.max(1,...rows.map(r=>Math.abs(r.metric||0)))*96:100} y="3" width={Math.abs(item.metric)/Math.max(1,...rows.map(r=>Math.abs(r.metric||0)))*96} height="8" rx="4" fill="currentColor"/></svg>}
      </span>{item.metric!=null&&metric(item)}{item.secondary!=null&&model.secondaryLabel&&<span className="tv-secondary">{model.secondaryLabel} {displayValue(item.secondary)}</span>}
     </button>)}
    </div>
    </>}
    {loaded&&!filtered.length&&<p>{rows.length?'当前筛选没有匹配项':'来源返回空结果'}{model.partial?'（仅覆盖已获取样本）':''}</p>}
    {!STAGED_KINDS.includes(model.kind)&&filtered.length>pageSize&&<nav aria-label="工具候选分页"><button disabled={!page} onClick={()=>change({page:page-1})}>上一组</button><span>{page+1} / {Math.ceil(filtered.length/pageSize)}</span><button disabled={(page+1)*pageSize>=filtered.length} onClick={()=>change({page:page+1})}>下一组</button></nav>}
    </>}
   </>}
  </>}
  </div>
  <footer><small>{model.source||value?.source||tool}</small></footer>
  {raw&&<div className="tv-raw" data-layout-scroll="allow" data-scroll-region="tool-data">{loaded&&t?.readOnly!==false&&<button disabled={!ready||busy} onClick={()=>session.retry(p.binding)}>刷新数据</button>}<pre>{value?JSON.stringify(value,null,2):'尚无工具结果'}</pre></div>}
 </section>
}
