import React,{useEffect,useState} from 'react'
import {useViewState} from './view-state.jsx'
import {recordId,toggleSelection,facetCounts,compositionRows,projectPoints,experienceSelection,experienceSelectedRecords} from '../../shared/cardspec/composition.mjs'
import {collectionTitle,collectionFields} from '../../shared/cardspec/collection.mjs'
import {fieldLabels,displayValue,detailPresentation} from '../../shared/cardspec/result-view.mjs'
import {DetailFacts} from './DetailFacts.jsx'
import './experience.css'

function Poster({row}){
 const [failed,setFailed]=useState(false)
 useEffect(()=>setFailed(false),[row.assetRef])
 return row.assetRef&&!failed?<img loading="lazy" src={'/api/tools/assets/'+encodeURIComponent(row.assetRef)} alt={collectionTitle(row)} onError={()=>setFailed(true)}/>:<span className="cs-experience-monogram" aria-hidden="true">{collectionTitle(row).slice(0,1)}</span>
}
export function PointMap({p,fire}){
 const [selected,setSelected]=useViewState('map-selection',''),points=projectPoints(p.items||[]),current=p.selectedId??selected
 return <section className="cs-point-map" aria-label={p.label||'位置分布'}>
  <div className="cs-point-map-canvas" role="group" aria-label="按真实坐标绘制的位置示意">
   <span className="cs-point-map-north">北 ↑</span>
   {points.map((point,index)=><button key={point.id} type="button" title={point.label} aria-label={point.label} aria-pressed={Array.isArray(p.selectedIds)?p.selectedIds.includes(point.id):String(current)===point.id} style={{left:point.x+'%',top:point.y+'%'}} onClick={()=>{if(fire('onSelect',{id:point.id,value:point.id,item:point.item})!==false)setSelected(point.id)}}>{index+1}</button>)}
   {!points.length&&<span>暂无可核实坐标</span>}
  </div><small>位置示意 · 不用于导航{points.length<(p.items||[]).length?` · ${(p.items||[]).length-points.length} 项缺少坐标`:''}</small>
 </section>
}
export function Experience({p,fire,children}){
 const [view,set]=useViewState('experience',{query:'',facets:{},selected:[],page:0,tab:'overview',focus:null})
 const selection=experienceSelection(p,view)
 const items=p.items||[],selected=[...new Set(selection.ids)],rows=compositionRows(items,view),chosen=experienceSelectedRecords(items,selected,view.selectedItems||[])
 const unresolved=selected.length-chosen.length
 const selectionStamp=JSON.stringify([selection.ids,chosen,selection.source])
 useEffect(()=>{set(previous=>JSON.stringify([previous.selected,previous.selectedItems||[],previous.selectionSource??null])===selectionStamp?previous:{...previous,selected:selection.ids,selectedItems:chosen,selectionSource:selection.source})},[selectionStamp])
 const fields=collectionFields(items,p.fields),facets=p.facets||[],page=Math.min(view.page,Math.max(0,Math.ceil(rows.length/3)-1)),multiple=p.preset==='compare'||p.preset==='planner'||p.multiple
 const update=patch=>set({...view,...patch})
 const limit=p.maxSelected??Infinity,full=multiple&&selected.length>=limit
 const pick=row=>{if(unresolved)return false;const id=recordId(row,items.indexOf(row)),ids=toggleSelection(selected,id,multiple,limit),records=experienceSelectedRecords(items,ids,chosen);if((!multiple||selected.includes(id)||selected.length<limit)&&fire('onSelect',{id,value:id,item:row,ids,items:records})===false)return false;update({selected:ids,selectedItems:records,focus:id});return true}
 const focus=items.find((r,i)=>recordId(r,i)===view.focus)
 const group=p.groupBy?facetCounts(rows,p.groupBy):[],mapOverview=view.tab==='overview'&&p.visual==='map'
 return <section className="cs-experience" data-preset={p.preset||'explore'} aria-label={p.label||'探索'}>
  <header><strong>{p.label||'探索'}</strong><small>{p.items===undefined?null:<>{p.partial?'部分样本 · ':''}{items.length} 项{chosen.length?` · 已选 ${chosen.length}`:''}</>}</small></header>
  {!!(items.length||chosen.length)&&<nav aria-label="体验视图" className="cs-experience-tabs">{[['overview','概览'],['results','候选'],...(multiple?[['selected','已选']]:[]),['sources','原始资料']].map(([key,label])=><button type="button" key={key} aria-pressed={view.tab===key} onClick={()=>update({tab:key})}>{label}</button>)}</nav>}
  <div className="cs-experience-body">
   {!!unresolved&&<small role="status">{unresolved} 项已选资料尚未加载；恢复完整候选后可继续操作。</small>}
   {full&&<small role="status">已选 {selected.length} 项，最多 {limit} 项；取消已选后可更换。</small>}
   {!mapOverview&&view.tab!=='selected'&&!!items.length&&<label className="cs-field"><span>筛选当前结果</span><input value={view.query} onChange={e=>update({query:e.target.value,page:0})}/></label>}
   {!mapOverview&&view.tab!=='selected'&&facets.map(field=><div key={field} className="cs-experience-facets" role="group" aria-label={fieldLabels[field]||field}><button type="button" aria-pressed={!view.facets[field]} onClick={()=>update({facets:{...view.facets,[field]:''},page:0})}>全部{fieldLabels[field]||field}</button>{facetCounts(items,field).map(([label,count])=><button type="button" key={label} aria-pressed={view.facets[field]===label} onClick={()=>update({facets:{...view.facets,[field]:view.facets[field]===label?'':label},page:0})}>{label} <small>{count}</small></button>)}</div>)}
   {view.tab==='overview'&&p.visual==='map'&&<PointMap p={{items:rows,selectedId:view.focus,selectedIds:selected,label:p.label}} fire={(_,e)=>pick(e.item)}/>}
   {view.tab==='overview'&&!!group.length&&<div className="cs-experience-bars" aria-label="当前样本分布">{group.map(([label,count])=><button type="button" key={label} onClick={()=>update({facets:{...view.facets,[p.groupBy]:label},page:0,tab:'results'})}><span>{label}</span><meter min="0" max={Math.max(1,rows.length)} value={count}/><b>{count}</b></button>)}</div>}
   {view.tab==='sources'?<div className="cs-experience-sources">{rows.slice(page*3,page*3+3).map((row,i)=><details key={recordId(row,i)}><summary>{collectionTitle(row,p.titleKey)}</summary><DetailFacts model={detailPresentation(row)}/><details><summary>原始输出</summary><pre>{JSON.stringify(row,null,2)}</pre></details></details>)}</div>:
    <div className="cs-experience-results">{(view.tab==='selected'?chosen:mapOverview?(focus?[focus]:[]):rows.slice(page*3,page*3+3)).map((row,i)=><button type="button" className="cs-experience-item" key={recordId(row,i)} aria-pressed={selected.includes(recordId(row,items.indexOf(row)))} onClick={()=>pick(row)}><Poster row={row}/><span><strong>{collectionTitle(row,p.titleKey)}</strong><span>{fields.map(f=><small key={f}>{fieldLabels[f]||f} · {displayValue(row[f])}</small>)}</span></span></button>)}</div>}
   {focus&&view.tab!=='sources'&&<details className="cs-experience-detail"><summary>{collectionTitle(focus,p.titleKey)} · 详情</summary><DetailFacts model={detailPresentation(focus)}/></details>}
   {!rows.length&&!!items.length&&<p>没有匹配项，调整筛选可恢复结果。</p>}
   {view.tab==='selected'&&!chosen.length&&<p>先选择候选，再进行比较或规划。</p>}
   {children}
  </div>
  <footer>
   {!mapOverview&&view.tab!=='selected'&&rows.length>3&&<nav aria-label="候选分页"><button type="button" disabled={!page} onClick={()=>update({page:page-1})}>←</button><span>{page+1}/{Math.ceil(rows.length/3)}</span><button type="button" disabled={(page+1)*3>=rows.length} onClick={()=>update({page:page+1})}>→</button></nav>}
   {p.onApply&&<button type="button" className="cs-button" disabled={!chosen.length||chosen.length>limit||!!unresolved} onClick={()=>fire('onApply',{ids:selected,items:chosen})}>{p.applyLabel||'按选择继续'}</button>}
  </footer>
 </section>
}
