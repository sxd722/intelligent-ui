import {resultCoverage} from '../../shared/cardspec/result-pagination.mjs'
import React,{useContext,useRef,useEffect} from 'react'
import {useViewState} from './view-state.jsx'
import {ToolSettings} from './ToolCard.jsx'
import {useCardSize} from '../CardSize.jsx'
import {useCompositionSpace} from './useCompositionSpace.js'
import {evaluate} from '../../shared/cardspec/expression.mjs'
import {taskDataset,taskSelection,toggleTaskSelection,taskComparison,taskAggregate,taskConstraintLabels,taskStamp} from '../../shared/cardspec/task-operations.mjs'
import {auditTaskConstraints} from '../../shared/cardspec/task-gates.mjs'
import {formatSlot} from '../../shared/cardspec/tool-slots.mjs'
import {detailRequests,detailPresentation} from '../../shared/cardspec/result-view.mjs'
import {DetailFacts} from './DetailFacts.jsx'
import './task-view.css'

export function TaskToolView({p,runtime,scope,fire}){
 const enabled=useContext(ToolSettings),size=useCardSize(),[root,height]=useCompositionSpace({sharePage:true})
 const [view,set]=useViewState('task',{query:'',page:0,selection:{},tab:'candidates',detail:null,error:''})
 const ticket=useRef(0),mounted=useRef(true)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;ticket.current++}},[])
 const definition=runtime.spec.bindings?.[p.binding],record=runtime.page?.bindings?.[p.binding]||scope.bindings?.[p.binding],session=runtime.session,tool=definition?.tool,task=p.task||{}
 const busy=record?.status==='loading',ready=enabled&&!runtime.streaming&&session?.complete&&!session?.busy
 const compact=size==='square'&&(height??220)<250
 const patch=change=>set(v=>({...v,...change,pageContext:stamp}))
 let dataset,error,input
 try{
  input=record?.valueInputKey?JSON.parse(record.valueInputKey):evaluate(definition.input,scope)
  if(record?.value?.items)dataset=taskDataset(tool,record.value,{input,task})
 }catch(e){error=e.message}
 const stamp=dataset?dataset.contextKey+':'+dataset.constraintKey:''
 useEffect(()=>{ticket.current++},[stamp,record?.version])
 const selection=dataset?taskSelection(dataset,view.selection,task):{keys:[]},comparison=dataset?taskComparison(dataset,selection):{items:[],fields:[]}
 const filtered=dataset?.eligible.filter(r=>!view.query||[r.title,r.summary].some(t=>t.toLocaleLowerCase().includes(view.query.toLocaleLowerCase())))||[]
 const pageSize=size==='square'?2:4,page=Math.min(view.pageContext===stamp?view.page||0:0,Math.max(0,Math.ceil(filtered.length/pageSize)-1))
 const audit=dataset?auditTaskConstraints({rows:filtered,constraints:task.where,fields:dataset.columns}):null,aggregate=dataset?taskAggregate(dataset,task):null
 const detail=view.detail?.stamp===stamp&&view.detail?.sourceVersion===(record?.version||0)?view.detail:null
 const choose=row=>{try{
  const next=toggleTaskSelection(dataset,view.selection,row.key,task),items=taskComparison(dataset,next).items,raw=dataset.records[row.rawRef]
  if(fire('onSelect',{id:raw.rowKey??raw.id,viewKey:row.viewKey,entityId:row.entityId,item:raw,items:items.map(r=>dataset.records[r.rawRef]),ids:items.map(r=>r.key),input,role:task.pin||null})===false)return
  patch({selection:next,error:''})
 }catch(e){patch({error:e.message})}}
 const inspect=async row=>{
  const n=++ticket.current,raw=dataset.records[row.rawRef],base={key:row.key,title:row.title,row:raw,stamp,sourceVersion:record.version||0}
  patch({tab:'detail',detail:{...base,loading:true},error:''})
  try{const result=await session.readTaskDetails(p.binding,raw);if(mounted.current&&ticket.current===n)patch({detail:{...base,...result,sourceVersion:record.version||0,loading:false}})}
  catch(e){if(mounted.current&&ticket.current===n)patch({detail:{...base,loading:false,error:e.message}})}
 }
 const facts=row=><span className="task-facts">{row.$display.fields.slice(0,3).map(f=><span key={f.key}><small>{f.label}</small><b>{formatSlot(f)}</b></span>)}</span>
 const apply=()=>fire('onApply',{items:comparison.items.map(r=>dataset.records[r.rawRef]),ids:selection.keys,input,role:task.pin||null})
 return <section ref={root} className="cs-tool-view cs-task-view" aria-label={p.label||'任务视图'} data-task-binding={p.binding} data-task-audit={error?'failed':audit?.status||'pending'} data-task-role={task.pin} data-size={size} data-family={p.style&&p.style!=='auto'?p.style:runtime.spec.design||'default'} style={size==='square'?{maxHeight:height||'calc(100cqw - 64px)'}:undefined}>
  {!compact&&<header><strong>{p.label||'候选与选择'}</strong><button disabled={!ready||busy} onClick={()=>session.retry(p.binding)}>{busy?'更新中…':'刷新'}</button></header>}
  <div className="task-constraints">{dataset&&taskConstraintLabels(task,dataset.columns).map(label=><span key={label}>{label}</span>)}{dataset?.unknown.length>0&&<span>条件数据未知 {dataset.unknown.length} 项</span>}</div>
  {(error||record?.error||view.error)&&<div role="status">{error||record.error||view.error}</div>}
  {!enabled&&<p>工具增强已关闭</p>}
  {!dataset&&!error&&<p role="status">{busy?'正在获取候选…':'等待数据'}</p>}
  {error&&<button disabled={!ready} onClick={()=>session.openResults(p.binding)}>查看原始结果</button>}
  {dataset&&<>
   <small role="status">{resultCoverage(record.value).label}</small>
   <nav aria-label="任务视图切换"><button aria-pressed={view.tab==='candidates'} onClick={()=>{ticket.current++;patch({tab:'candidates'})}}>候选 {filtered.length}</button><button aria-pressed={view.tab==='selected'} onClick={()=>{ticket.current++;patch({tab:'selected'})}}>{task.pin?'已固定':'已选'} {selection.keys.length}</button>{task.compare&&<button disabled={!selection.keys.length} aria-pressed={view.tab==='compare'} onClick={()=>patch({tab:'compare'})}>比较</button>}{compact&&<button aria-label="刷新" disabled={!ready||busy} onClick={()=>session.retry(p.binding)}>↻</button>}</nav>
   <div className="task-body" data-layout-scroll="allow" data-scroll-region="task-view">
   {view.tab==='candidates'&&<>
    <input aria-label="筛选候选名称" placeholder="筛选名称或摘要" value={view.query} onChange={e=>patch({query:e.target.value,page:0})}/>
    {filtered.slice(page*pageSize,(page+1)*pageSize).map(row=><article key={row.key} data-task-row={row.key} className="task-candidate">
     <button className="task-pick" aria-label={(task.pin?'固定 ':'选择 ')+row.title} aria-pressed={selection.keys.includes(row.key)} onClick={()=>choose(row)}>
      <span className="task-avatar">{row.assetRef?<img src={'/api/tools/assets/'+encodeURIComponent(row.assetRef)} alt="" onError={e=>{e.currentTarget.style.visibility='hidden'}}/>:row.title.slice(0,1)}{selection.keys.includes(row.key)&&<i>✓</i>}</span><span><strong>{row.title}</strong>{facts(row)}</span>
     </button>
     {detailRequests(tool,dataset.records[row.rawRef],input).some(r=>r.kind==='facts')&&<button className="task-inspect" disabled={!ready||busy} onClick={()=>inspect(row)} aria-label={'查询详情 '+row.title}>详情 ↗</button>}
    </article>)}
    {!filtered.length&&<p>当前条件下没有已确认候选</p>}
    {filtered.length>pageSize&&<nav aria-label="任务候选分页"><button disabled={!page} onClick={()=>patch({page:page-1})}>上一组</button><span>{page+1}/{Math.ceil(filtered.length/pageSize)}</span><button disabled={(page+1)*pageSize>=filtered.length} onClick={()=>patch({page:page+1})}>下一组</button></nav>}
    {aggregate&&<details><summary>样本统计 · {aggregate.total} 项{aggregate.partial?'（部分数据）':''}</summary>{aggregate.groups.map(g=><p key={g.label}>{g.label}：{g.value??'未提供'} · 已知 {g.known}/{g.count}</p>)}{aggregate.unknown>0&&<p>分组未知：{aggregate.unknown}</p>}</details>}
   </>}
   {view.tab==='selected'&&<div className="task-selection">{!comparison.items.length?<p>尚未{task.pin?'固定':'选择'}候选</p>:comparison.items.map(row=><article key={row.key} data-task-fixed-key={row.key}><strong>{task.pin?task.pin+' · ':''}{row.title}</strong>{facts(row)}{task.pin&&<p className="task-context">{Object.entries(input).filter(([k])=>['from','to','date','checkin','checkout','location','city'].includes(k)).map(([k,v])=>`${k} ${v}`).join(' · ')}</p>}<button onClick={()=>choose(row)}>移除 {row.title}</button></article>)}</div>}
   {view.tab==='compare'&&<div className="task-comparison" data-scroll-region="task-comparison"><table><caption>已选候选对比</caption><thead><tr><th>指标</th>{comparison.items.map(r=><th key={r.key}>{r.title}</th>)}</tr></thead><tbody>{comparison.fields.map(f=><tr key={f.key}><th>{f.label}</th>{f.values.map((v,i)=><td key={i}>{v}</td>)}</tr>)}</tbody></table></div>}
   {view.tab==='detail'&&(!detail?<p>资料已更新，请返回候选重新查看</p>:<article data-task-detail-audit={detail.audit?.status||'pending'}><h3>{detail.title}</h3>{detail.loading?<p role="status">正在读取新增信息…</p>:detail.error?<p role="status">{detail.error}</p>:detail.value?<><p role="status">{detail.audit?.status==='passed'?'已获取新增信息':'本次返回未增加信息'}</p><DetailFacts model={detailPresentation({},detail.value)}/></>:null}</article>)}
   {compact&&<details className="task-raw"><summary>原始资料 · {dataset.items.length} 项</summary><pre>{JSON.stringify(record.value,null,2)}</pre></details>}
   </div>
   {task.pin&&comparison.items.length>0&&<div className="task-pin-receipt" role="status" data-task-pinned={comparison.items[0].key}>{task.pin}已固定：{comparison.items[0].title}{input.date?' · '+input.date:''}</div>}
   {p.onApply&&<button disabled={!selection.keys.length} onClick={apply}>应用选择</button>}
   {!compact&&<details className="task-raw"><summary>原始资料 · {dataset.partial?'部分样本':'已获取'} {dataset.items.length} 项</summary><pre>{JSON.stringify(record.value,null,2)}</pre></details>}
  </>}
 </section>
}
