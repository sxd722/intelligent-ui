import {Collection} from './Collection.jsx'
import {ViewStateProvider} from './view-state.jsx'
import React,{useState} from 'react'
import {useCardSize} from '../CardSize.jsx'
import {isPartialToolResult} from '../../shared/cardspec/tools.mjs'
import {displayValue,resultTitle,resultImageSources,safeLink,fieldLabels,detailRequests,detailPresentation} from '../../shared/cardspec/result-view.mjs'
import {DetailFacts} from './DetailFacts.jsx'
function Thumbnail({row}){
  const [failed,setFailed]=useState([]),src=resultImageSources(row).find(url=>!failed.includes(url))
  return <span className="cs-result-thumbnail">{src?<img key={src} src={src} alt="条目图片" loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(previous=>[...previous,src])}/>:<span aria-label="暂无图片">{resultTitle(row).slice(0,1)}</span>}</span>
}
export function ResultBrowser({page,session,footer,overlay}){
  const cardSize=useCardSize()
  const {tool,value,row,details,loading,error}=page.resultView,view=page.viewState
  const layout=view.layout||'list',query=view.query||'',saved=!!view.saved
  const rows=value.items.filter(r=>(!saved||session.isFavorite(tool,r))&&Object.values(r).some(v=>typeof v==='string'&&v.toLowerCase().includes(query.toLowerCase())))
  const columns=[...new Set(rows.flatMap(r=>Object.keys(r)))].filter(k=>!['rowKey','url'].includes(k)&&!/(image|poster|cover|thumbnail)/i.test(k)).slice(0,5)
  const tablePage=Math.min(view.tablePage||0,Math.max(0,Math.ceil(rows.length/6)-1))
  const detail=detailPresentation(row||{},details)
  const favorite=r=>session.toggleFavorite(tool,r)
  return <section className="cs-result-card" data-card-size={cardSize} aria-label={row?'条目详情':'工具结果浏览'}>
    <header><strong>{row?resultTitle(row):'浏览查询结果'}</strong><small>{value.source} · {value.fetchedAt?new Date(value.fetchedAt).toLocaleString():''}</small>{isPartialToolResult(tool,value)&&<small>仅展示已获取的部分结果</small>}</header>
    {!row&&<form className="cs-result-form" onSubmit={e=>e.preventDefault()}><input aria-label="筛选已获取结果" placeholder="筛选已获取结果…" value={query} onChange={e=>session.setResultView({query:e.target.value})}/><div><select aria-label="结果呈现方式" value={layout} onChange={e=>session.setResultView({layout:e.target.value})}><option value="list">紧凑列表</option><option value="gallery">图片图库</option><option value="table">对照表格</option></select><label><input type="checkbox" checked={saved} onChange={e=>session.setResultView({saved:e.target.checked})}/>只看收藏</label></div></form>}
    <div className="cs-result-scroll" tabIndex={0}>
      {row?<><div className="cs-result-hero"><Thumbnail row={session.resultMedia(tool,row)}/><div><strong>{detail.title}</strong><p>{loading?'正在补充详情…':details?'来源详情':'所选条目'}</p></div></div><DetailFacts model={detail}/>{error&&<p role="alert">{error}</p>}</>:
      layout==='table'?<><div className="cs-table-scroll"><table><thead><tr>{columns.map(c=><th key={c}>{fieldLabels[c]||c}</th>)}<th>详情</th></tr></thead><tbody>{rows.slice(tablePage*6,tablePage*6+6).map(r=><tr key={r.rowKey||r.id}>{columns.map(c=><td key={c}>{displayValue(r[c])}</td>)}<td><button onClick={()=>session.openDetail(r)}>查看</button></td></tr>)}</tbody></table></div>{rows.length>6&&<nav className="cs-row" aria-label="结果表格分页"><button disabled={!tablePage} onClick={()=>session.setResultView({tablePage:tablePage-1})}>上一组</button><span>{tablePage+1} / {Math.ceil(rows.length/6)}</span><button disabled={(tablePage+1)*6>=rows.length} onClick={()=>session.setResultView({tablePage:tablePage+1})}>下一组</button></nav>}</>:
      <ViewStateProvider value={{values:page.viewState.collection||=( {}),save:()=>session.save()}}><Collection p={{items:rows.map(r=>session.resultMedia(tool,r)),presentation:layout==='gallery'?'gallery':'compact',label:'查询结果',partial:isPartialToolResult(tool,value)}} fire={(_name,event)=>session.openDetail(event.item)}/></ViewStateProvider>}
      {!row&&!rows.length&&<p>当前筛选没有匹配项{isPartialToolResult(tool,value)?'（数据可能不完整）':''}。</p>}
    </div>
    <footer>{row?<><button type="button" aria-pressed={session.isFavorite(tool,row)} onClick={()=>favorite(row)}>{session.isFavorite(tool,row)?'已收藏':'加入收藏'}</button>{detailRequests(tool,row).length>0&&<button type="button" disabled={loading} onClick={()=>session.loadDetails()}>{loading?'查询中…':'加载详情与图片'}</button>}{safeLink(row.url)&&<a href={safeLink(row.url)} target="_blank" rel="noreferrer">查看来源 ↗</a>}</>:<small>显示 {rows.length} / {value.items.length} 条 · 点击条目查看详情</small>}</footer>
    {footer}{overlay}
  </section>
}
