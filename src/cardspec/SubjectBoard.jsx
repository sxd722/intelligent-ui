import React from 'react'
import {useViewState} from './view-state.jsx'
import {ImageNode} from './MediaImage.jsx'
import {photoKey} from '../../shared/cardspec/images.mjs'
import {formatSlot} from '../../shared/cardspec/tool-slots.mjs'
import {useCardSize} from '../CardSize.jsx'
import './subject-board.css'

// Display roles, not inferred entity joins. Each source retains its own errors,
// input provenance and complete results; one broken tool cannot hide the others.
export function SubjectBoard({p,runtime,fire}){
 const v=p.view,[saved,set]=useViewState('subjectBoard',{}),same=saved.scope===v.scope,opened=same?saved.opened:null
 const compact=useCardSize()==='square',roles=Object.keys(v.roles||{}),active=same&&roles.includes(saved.role)?saved.role:roles[0]
 const update=patch=>set({...saved,...patch,scope:v.scope})
 const select=(item,role)=>{
  const source=item.provenance?.[0],record=runtime?.page?.bindings?.[v.sourceBindings?.[role]],raw=item.raw||record?.value?.items?.[source?.row]||item
  if(!p.onSelect){update({selected:item.id,opened:role,page:0});return}
  if(fire('onSelect',{id:item.id,value:item.id,entityId:item.entityId,item:raw,role,input:source?.input||{}})!==false)update({selected:item.id})
 }
 const roleEntries=Object.entries(v.roles||{}).filter(([role])=>opened?opened===role:!compact||active===role)
 return <section className="cs-subject-board" data-compact={compact||undefined} aria-label={p.label||v.subject?.title||'当前对象资料'} data-subject={v.subject?.id||''}>
  {opened?<header><button className="cs-button" onClick={()=>update({opened:null})}>← 返回概览</button><strong>{opened}</strong></header>:<>
   {v.subject&&<header><strong>{v.subject.title}</strong>{v.subject.summary&&<p>{v.subject.summary}</p>}</header>}
   {!!v.media?.length&&<div className="cs-subject-media">{v.media.map((m,i)=><ImageNode key={m.assetRef||m.query} p={{...m,mediaRole:'thumbnail'}} resource={runtime?.resources?.[photoKey(m.query,'thumbnail')]} streaming={runtime?.streaming||runtime?.spec.context?.archiveReplay} />)}</div>}
  </>}
  {compact&&!opened&&roles.length>1&&<div className="cs-subject-tabs" role="tablist" aria-label="关联资料">{roles.map(role=><button role="tab" key={role} aria-selected={active===role} onClick={()=>update({role})}>{role}</button>)}</div>}
  <div className="cs-subject-roles">{roleEntries.map(([role,items])=>{
   const status=v.statuses?.find(s=>s.role===role),issues=v.issues?.filter(s=>s.role===role)||[]
   const focus=items.find(i=>i.id===p.selectedId||i.entityId!=null&&String(i.entityId)===String(p.selectedId))||items.find(i=>same&&i.id===saved.selected)
   const pageSize=compact?1:3,page=Math.min(same?saved.page||0:0,Math.max(0,Math.ceil(items.length/pageSize)-1))
   const shown=opened?items.slice(page*pageSize,page*pageSize+pageSize):focus?[focus]:items.slice(0,1)
   return <section key={role} className="cs-subject-role" aria-label={role}><h4>{role}</h4>
    {(status?.status==='loading'||status?.status==='idle')&&<small role="status">正在获取…</small>}
    {issues.length>0&&<div role="status" className="cs-subject-issue">{issues.map(i=><small key={i.code}>{i.message}</small>)}</div>}
    {shown.map(item=><article key={item.id} data-selected={focus?.id===item.id||undefined}>
     {p.onSelect||!opened&&items.length>1?<button type="button" className="cs-subject-pick" aria-label={'选择 '+item.title} aria-pressed={focus?.id===item.id} onClick={()=>select(item,role)}><strong>{item.title}</strong><span aria-hidden="true">↗</span></button>:<strong className="cs-subject-title">{item.title}</strong>}
     {item.summary&&!(item.slots||item.metrics||[]).some(f=>String(f.value)===item.summary)&&<p>{item.summary}</p>}
     <dl>{(item.slots||item.metrics||[]).filter(f=>f.value!=null).slice(0,opened?12:3).map((f,i)=><div key={f.key||i}><dt>{f.label}</dt><dd>{formatSlot(f)}</dd></div>)}</dl>
     {item.url&&<a href={item.url} target="_blank" rel="noreferrer">查看来源 ↗</a>}
    </article>)}
    {!items.length&&status?.status==='success'&&<small>没有匹配内容</small>}
    {!opened&&items.length>1&&<button className="cs-subject-more" onClick={()=>update({opened:role,page:0})}>查看{role} · {items.length} 项 →</button>}
    {opened&&items.length>pageSize&&<nav aria-label={role+'结果分组'}><button className="cs-subject-more" disabled={!page} onClick={()=>update({page:page-1})}>← 前一组</button><small>{page*pageSize+1}–{Math.min(items.length,page*pageSize+pageSize)} / {items.length}</small><button className="cs-subject-more" disabled={(page+1)*pageSize>=items.length} onClick={()=>update({page:page+1})}>后一组 →</button></nav>}
    {issues.length>0&&v.sourceBindings?.[role]&&runtime?.session&&<button className="cs-subject-more" onClick={()=>runtime.session.openResults(v.sourceBindings[role])}>查看来源结果 →</button>}
   </section>
  })}</div>
 </section>
}
