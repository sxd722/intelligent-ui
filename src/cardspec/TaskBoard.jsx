import {MockDesignContext,MockCrop} from './MockDesignContext.jsx'
import {staticBoard} from '../../shared/cardspec/static-board.mjs'
import {BoardImage} from './BoardImage.jsx'
import React from 'react'
import {useViewState} from './view-state.jsx'
import {useCompositionSpace} from './useCompositionSpace.js'
import {useCardSize} from '../CardSize.jsx'
import {GeographicMap} from './GeographicMap.jsx'
import {boardDesign} from '../../shared/cardspec/board-design.mjs'
import './task-board.css'
import {NativeDecisionView} from './NativeDecisionView.jsx'
import {decisionProfile} from '../../shared/cardspec/decision-profile.mjs'

function Artwork({item,number}){
 const mock=React.useContext(MockDesignContext),tile=mock?.tiles?.[item.mockTile]
 const [failed,setFailed]=React.useState(''),ref=item.assetRef
 return <span className="tb-artwork" data-image={!!ref&&failed!==ref}><span className="tb-cover" aria-hidden="true"><i>{String(number+1).padStart(2,'0')}</i><b>{item.title.slice(0,12)}</b><span>{item.source.split('.')[1]||'COLLECTION'}</span></span>{!ref&&!item.imageQuery&&tile&&<MockCrop design={mock} rect={tile} label={item.title}/>} {(!ref||failed===ref)&&item.imageQuery&&<BoardImage query={item.imageQuery} title={item.title}/>} {ref&&failed!==ref&&<img src={'/api/tools/assets/'+encodeURIComponent(ref)} alt={item.title} onError={()=>setFailed(ref)}/>}</span>
}
export function TaskBoard(props){
 const {p,runtime}=props,bindings=p.view?.sourceBindings,ids=Object.values(bindings||{}),profiles=ids.map(id=>decisionProfile(runtime?.spec.bindings[id]?.tool));
 // Equivalent native tasks delegate; mixed sources and explicit view callbacks
 // retain composition semantics and never lose filtering or related evidence.
 if(!p.view?.viewFilter&&!p.onSelect&&!p.onDateChange&&!['map','evidence','plan','detail'].includes(p.layout)&&ids.length&&profiles.every(Boolean)&&(ids.length===1||ids.length<=4&&profiles.every(x=>x.kind==='tickets')))
  return <NativeDecisionView {...props} p={{...p,binding:ids[0],...(ids.length>1?{bindings}:{})}}/>;
 return <CompositionTaskBoard {...props}/>;
}
function CompositionTaskBoard({p,fire}){
 const mock=React.useContext(MockDesignContext)
 const v=p.view||staticBoard(p.items,p.label),[root,height]=useCompositionSpace({sharePage:true}),size=useCardSize(),design=boardDesign(v,p),{layout,skin}=design
 const [narrow,setNarrow]=React.useState(false)
 React.useLayoutEffect(()=>{const el=root.current;if(!el)return;const ro=new ResizeObserver(()=>setNarrow(el.clientWidth<350||(size==='square'&&el.clientHeight<(mock?200:330))));ro.observe(el);setNarrow(el.clientWidth<350||(size==='square'&&el.clientHeight<(mock?200:330)));return()=>ro.disconnect()},[root,size,mock])
 const [searchOpen,setSearchOpen]=React.useState(false)
 const initial={scope:v.scope,source:'',page:0,tab:layout==='map'?'map':layout==='detail'?'details':'main',query:'',selected:[],focusId:'',submitted:''}
 const [saved,set]=useViewState('task-board',initial),state=saved.scope===v.scope?{...initial,...saved}:initial
 const update=patch=>set({...state,...patch,scope:v.scope})
 const items=v.items.filter(i=>(!state.source||i.provenance.some(s=>s.tool===state.source))&&(!state.query||[i.title,i.summary,i.author].join(' ').toLocaleLowerCase().includes(state.query.toLocaleLowerCase())))
 if(layout==='evidence')items.sort((a,b)=>(Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0))
 const selected=v.items.filter(i=>state.selected.includes(i.id)),focus=v.focus||v.items.find(i=>i.id===state.focusId)||(layout==='detail'?items[0]:null)
 const toggle=item=>update({selected:selected.some(i=>i.id===item.id)?selected.filter(i=>i.id!==item.id).map(i=>i.id):[...selected,item].slice(-4).map(i=>i.id)})
 const limit=size==='square'?(narrow?1:2):4,page=Math.min(state.page,Math.max(0,Math.ceil(items.length/limit)-1)),shown=items.slice(page*limit,(page+1)*limit)
 const pick=(item,detail=false)=>{update({focusId:item.id,...(detail?{tab:'details'}:{})});fire('onSelect',{id:item.id,value:item.id,entityId:item.entityId,item})}
 const facts=item=><span className="tb-facts">{item.metrics.filter(m=>m.value!==null).map(m=><small key={m.key}>{m.label}<b>{m.value}<em>{m.unit}</em></b></small>)}</span>
 const row=(item,i)=><article key={item.id} className="tb-tile" data-chosen={selected.some(s=>s.id===item.id)}><button type="button" className="tb-row" data-entity={item.id} aria-label={'查看 '+item.title} onClick={()=>pick(item,true)}><Artwork item={item} number={page*limit+i}/><span className="tb-copy"><strong>{item.title}</strong>{facts(item)}<small>{layout==='evidence'?(item.publishedAt||'时间未知'):(item.author||item.source.split('.')[1]||item.source)}</small></span></button><button className="tb-pick" aria-label={'加入对比 '+item.title} aria-pressed={selected.some(s=>s.id===item.id)} onClick={()=>toggle(item)}>{selected.some(s=>s.id===item.id)?'✓':'＋'}</button></article>
 const related=v.related.filter(i=>i.kind!=='place'||v.mode==='map')
 const difference=selected.length===2?selected[0].metrics.map(a=>{const b=selected[1].metrics.find(b=>b.key===a.key&&b.label===a.label&&b.unit===a.unit);return b&&Number.isFinite(a.value)&&Number.isFinite(b.value)?{...a,other:b.value}:null}).filter(Boolean):[]
 return <section ref={root} className="cs-task-board" data-composite={layout} data-skin={skin} data-narrow={narrow} aria-label={p.label||'组合任务'} style={{...design.tokens,...(size==='square'?{height:height||'calc(100cqw - 72px)'}:{})}}>
  <header><div><span className="tb-eyebrow">{layout==='evidence'?'EVIDENCE / 证据':layout==='map'?'FIELD NOTES / 探索':layout==='plan'?'YOUR SELECTION / 方案':'CURATED / 精选'}</span><strong>{p.label||'探索与选择'}</strong></div><div className="tb-header-actions">{p.onRefresh&&<button type="button" className="tb-refresh" aria-label="刷新数据" title="刷新当前来源" disabled={v.loading} onClick={()=>fire('onRefresh',{role:v.primary})}>↻</button>}<button className="tb-status" aria-label="来源状态" onClick={()=>update({tab:v.statuses.length?(state.tab==='sources'?'main':'sources'):'main'})}>{v.loading?'更新中':v.partial?'部分来源受限':items.length+' 项'} <span>↗</span></button></div></header>
  <nav aria-label="任务视角">{searchOpen?<div className="tb-search"><input autoFocus aria-label="筛选候选" placeholder="输入关键词" value={state.query} onChange={e=>update({query:e.target.value,page:0,tab:'main'})}/><button aria-label="收起筛选" onClick={()=>setSearchOpen(false)}>×</button></div>:<>{v.mode==='map'&&<button onClick={()=>update({tab:'map'})} aria-pressed={state.tab==='map'}>地图</button>}<button onClick={()=>update({tab:'main'})} aria-pressed={state.tab==='main'}>候选</button><button onClick={()=>update({tab:'compare'})} aria-pressed={state.tab==='compare'} disabled={!selected.length}>已选 {selected.length||''}</button>{focus&&<button onClick={()=>update({tab:'details'})} aria-pressed={state.tab==='details'}>详情</button>}{p.onDateChange&&v.dates?.length>0&&<select aria-label="出游日期" value={v.date||v.dates[0]} onChange={e=>fire('onDateChange',{date:e.target.value,value:e.target.value})}>{v.dates.map(d=><option key={d} value={d}>{d}</option>)}</select>}</>}<button className="tb-search-toggle" aria-label="筛选候选入口" aria-pressed={searchOpen} onClick={()=>setSearchOpen(!searchOpen)}>⌕</button></nav>
  <div key={state.tab} className="tb-body" data-layout-scroll="allow" data-scroll-region="task-board">
  {state.tab==='compare'?<><div className="tb-comparison">{selected.map((i,n)=><article key={i.id}><button className="tb-detail-pick" onClick={()=>pick(i,true)}><Artwork item={i} number={n}/><strong>{i.title}</strong></button>{facts(i)}<p>{i.summary||'详细信息未取得'}</p><button onClick={()=>toggle(i)}>移除</button></article>)}</div>{difference.length>0&&<div className="tb-differences" aria-label="同口径差异">{difference.slice(0,3).map(m=><div key={m.key}><span>{m.label}</span><span className="tb-bars">{[m.value,m.other].map((x,i)=><i key={i} style={{width:(Math.abs(x)/Math.max(1,Math.abs(m.value),Math.abs(m.other))*100)+'%'}}/>)}</span><b>{m.value} / {m.other}{m.unit}</b></div>)}</div>}</>:state.tab==='sources'?v.statuses.map(s=><div key={s.role} className="tb-source"><strong>{s.tool||s.role}</strong><span>{s.status}</span>{v.issues.filter(i=>i.role===s.role).map((i,n)=><small key={n}>{i.message}</small>)}{p.onRefresh&&<button onClick={()=>fire('onRefresh',{role:s.role})}>重试 {s.role}</button>}</div>):state.tab==='details'?<>
   {focus?<><div className="tb-detail-hero"><Artwork item={focus} number={items.indexOf(focus)}/><div><strong data-focus-title>{focus.title}</strong>{facts(focus)}</div></div><p className="tb-description">{focus.detail||focus.summary||'详细信息未取得，保留来源入口。'}</p>{focus.url&&<a href={focus.url} target="_blank" rel="noreferrer">打开原始来源 ↗</a>}{related.length>0&&<><small>相关搜索资料 · 未认定为同一实体</small>{related.map(i=><article key={i.id} className="tb-related"><strong>{i.title}</strong><p>{i.summary}</p>{facts(i)}{i.url&&<a href={i.url} target="_blank" rel="noreferrer">查看来源 ↗</a>}</article>)}</>}</>:<p>先从候选选择对象。</p>}
  </>:state.tab==='map'?<>
   {v.mapItems.length>0?<div className="tb-map"><GeographicMap p={{items:v.mapItems,selectedId:focus?.id,selectedIds:selected.map(i=>i.id),label:'地点与周边'}} fire={(_,e)=>{const item=v.items.find(i=>i.id===e.id);if(item)pick(item)}}/></div>:<div className="tb-location-empty"><span>⌖</span><strong>地点已找到，坐标待确认</strong><p>保留候选选择；取得可信坐标后显示地图。</p><button onClick={()=>update({tab:'main'})}>浏览地点</button></div>}
   {v.observations.map(o=><div className="tb-weather" key={o.id}><span>{o.title} {o.summary}</span>{facts(o)}</div>)}
  </>:<>
   {v.mode==='feed'&&v.counts.bySource.length>1&&<div className="tb-filters"><button aria-pressed={!state.source} onClick={()=>update({source:'',page:0})}>全部</button>{[...new Set(v.counts.bySource.map(s=>s.source).filter(Boolean))].map(s=><button key={s} aria-pressed={state.source===s} onClick={()=>update({source:s,page:0})}>{s.split('.')[1]||s}</button>)}</div>}
   <div className="tb-candidates">{shown.map(row)}</div>{!items.length&&<div className="tb-empty"><strong>{v.loading?'正在加载':'暂无匹配结果'}</strong><button onClick={()=>update({query:'',source:'',page:0})}>清除筛选</button></div>}
  </>}
  </div>
  <footer>{state.tab==='main'?<div className="tb-page-control"><button aria-label="前一组" disabled={!page} onClick={()=>update({page:page-1})}>‹</button><span>{items.length?page+1:0}<small> / {Math.max(1,Math.ceil(items.length/limit))}</small></span><button aria-label="后一组" disabled={(page+1)*limit>=items.length} onClick={()=>update({page:page+1})}>›</button></div>:<button className="tb-back" onClick={()=>update({tab:'main'})}>← 返回候选</button>}{p.onApply?<button className="tb-apply" disabled={!selected.length} onClick={()=>{fire('onApply',{ids:selected.map(i=>i.id),items:selected,scope:v.scope,date:v.date});update({submitted:JSON.stringify(selected.map(i=>i.id))})}}>{state.submitted===JSON.stringify(selected.map(i=>i.id))?'已提交':p.applyLabel||'确认选择'} {selected.length||''} <span>↗</span></button>:<span className="tb-footer-hint">{selected.length?'已选 '+selected.length+' 项':'点图片看详情 · ＋ 加入对比'}</span>}</footer>
 </section>
}
