import {StudyCollection} from './StudyCollection.jsx'
import React,{useEffect,useState} from 'react'
import {useViewState} from './view-state.jsx'
import {useCardSize} from '../CardSize.jsx'
import {collectionRows,collectionFields,collectionTitle,collectionPage} from '../../shared/cardspec/collection.mjs'
import {fieldLabels,displayValue,detailPresentation} from '../../shared/cardspec/result-view.mjs'
import {DetailFacts} from './DetailFacts.jsx'
import {useCompositionSpace} from './useCompositionSpace.js'
function Cover({row}){const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[row.assetRef]);return row.assetRef&&!failed?<img src={'/api/tools/assets/'+encodeURIComponent(row.assetRef)} alt="来源图片" onError={()=>setFailed(true)} loading="lazy"/>:<span className="cs-collection-mark" aria-hidden="true">{collectionTitle(row).slice(0,1)}</span>}
export function Collection({p,fire}){return ["folio","spread"].includes(p.presentation)?<StudyCollection p={p} fire={fire}/>:<StandardCollection p={p} fire={fire}/>}
function StandardCollection({p,fire}){
 const [root,height]=useCompositionSpace()
 const size=useCardSize()
 const [view,set]=useViewState('collection',{query:'',group:'',page:0,selected:null}),items=p.items||[],fields=collectionFields(items,p.fields)
 const groups=p.groupBy?[...new Set(items.map(r=>String(r[p.groupBy]??'')))].filter(Boolean):[]
 const selectedId=p.selectedId===undefined?view.selected:p.selectedId
 const hasFilter=items.length>4||view.query||view.group
 const capacity=height===null?undefined:Math.max(1,Math.min(size==='square'?2:4,Math.floor((height-66-(hasFilter?32:0))/(p.presentation==='poster'?70:100))))
 const rows=collectionRows(items,view,p.groupBy),{count,page,pageSize,start,end}=collectionPage(rows.length,view,size,capacity),selected=items.find(r=>String(r.rowKey??r.id)===String(selectedId))
 const patch=value=>set({...view,...value})
 const filters=<><label className="cs-field"><span>筛选已获取结果</span><input value={view.query} onChange={e=>patch({query:e.target.value,page:0,pageStart:0})}/></label>{!!groups.length&&<select aria-label="结果分组" value={view.group} onChange={e=>patch({group:e.target.value,page:0,pageStart:0})}><option value="">全部分组</option>{groups.map(g=><option key={g}>{g}</option>)}</select>}</>
 return <section ref={root} className="cs-collection" aria-label={p.label||'候选集合'}>
  <header><strong>{p.label||'候选'}</strong><small>{rows.length} / {items.length} 项{p.partial?' · 部分结果':''}</small></header>
  {hasFilter&&(size==='square'?<details className="cs-collection-filter" open={!!view.filtersOpen} onToggle={e=>{if(e.currentTarget.open!==!!view.filtersOpen)patch({filtersOpen:e.currentTarget.open})}}><summary>筛选{view.query||view.group?' · '+[view.query,view.group].filter(Boolean).join(' / '):'已获取结果'}</summary>{filters}</details>:filters)}
  <div className={'cs-collection-items '+(p.presentation||'compact')}>
   {rows.slice(start,end).map(r=><button type="button" className="cs-collection-item" aria-pressed={String(selectedId)===String(r.rowKey??r.id)} key={r.rowKey??r.id} onClick={()=>{if(fire('onSelect',{id:r.rowKey??r.id,value:r.rowKey??r.id,item:r})!==false)patch({selected:String(r.rowKey??r.id),selectedItem:r})}}>{p.presentation==="poster"&&r[p.timeKey||"time"]!=null?<time className="cs-collection-time">{String(r[p.timeKey||"time"])}</time>:<Cover row={r}/>}<span><strong>{collectionTitle(r,p.titleKey)}</strong>{p.presentation==="poster"?<span className="cs-collection-tag">{displayValue(r[p.subtitleKey||"note"])}</span>:<span className="cs-collection-facts">{fields.slice(0,3).map(f=><span key={f}><small>{fieldLabels[f]||f}</small>{displayValue(r[f])}</span>)}</span>}</span></button>)}
  </div>
  {!rows.length&&<p>当前筛选没有匹配项{p.partial?'（来源数据不完整）':''}</p>}
  {count>1&&<nav className="cs-row" aria-label="集合分页"><button className="cs-button" disabled={!page} onClick={()=>patch({pageStart:(page-1)*pageSize})}>上一组</button><span>{page+1} / {count}</span><button className="cs-button" disabled={page===count-1} onClick={()=>patch({pageStart:(page+1)*pageSize})}>下一组</button></nav>}
  {selected&&p.detailMode!=='external'&&<details className="cs-collection-detail"><summary>{collectionTitle(selected,p.titleKey)} · 详情</summary><DetailFacts model={detailPresentation(selected)}/></details>}
 </section>
}
