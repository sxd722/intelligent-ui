import React from 'react'
import {checklistChange,checklistProgress,factChanges} from '../../shared/cardspec/editorial.mjs'
const shown=v=>v==null?'—':String(v)
export function Facts({p,attrs={}}){
 const {changes,changed,unchanged,ordinary}=factChanges(p.items)
 const list=(items,full=false)=><dl className="cs-facts" aria-label={p.label}>{items.map((x,i)=>{const change=Object.hasOwn(x,'after'),delta=change&&typeof x.before==='number'&&typeof x.after==='number'?Number((x.after-x.before).toPrecision(12)):null;return <div key={i}><dt>{x.label}</dt><dd>{change?(full?`${shown(x.before)} → ${shown(x.after)}`:shown(x.after)):shown(x.value)}{x.unit&&<small>{x.unit}</small>}{change&&!full&&delta!==null&&<small> ({delta>0?'+':''}{delta})</small>}</dd></div>})}</dl>
 if(!changes.length)return <dl {...attrs} className="cs-facts" aria-label={p.label}>{p.items.map((x,i)=><div key={i}><dt>{x.label}</dt><dd>{shown(x.value)}{x.value!=null&&x.unit&&<small>{x.unit}</small>}</dd></div>)}</dl>
 return <section {...attrs} className="cs-facts-history" aria-label={p.label}>{list([...ordinary,...changed])}{unchanged>0&&<small>{unchanged} 项未变化</small>}<details><summary>完整前后值 · {changes.length} 项</summary>{list(changes,true)}</details></section>
}
export function Checklist({p,attrs={},fire}){
 const chosen=new Set(p.value||[]),progress=checklistProgress(p.items,p.value),groups=new Map()
 for(const item of p.items){const key=item.group||'';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item)}
 return <section {...attrs} className="cs-checklist" aria-label={p.label}><header><strong>{p.label}</strong><span aria-live="polite">已完成 {progress.done}/{progress.total}</span></header><progress aria-label={`${p.label}进度`} max={Math.max(1,progress.total)} value={progress.done}/>{[...groups].map(([group,items])=><fieldset key={group}>{group&&<legend>{group}</legend>}{items.map(item=><label key={item.id} data-checked={chosen.has(item.id)||undefined}><input type="checkbox" aria-label={item.label} disabled={p.disabled} checked={chosen.has(item.id)} onChange={e=>fire('onChange',{id:item.id,checked:e.target.checked,value:checklistChange(p.items,p.value,item.id,e.target.checked)})}/><span><strong>{item.label}</strong>{item.description&&<small>{item.description}</small>}</span></label>)}</fieldset>)}{!p.items.length&&<span>当前没有检查项</span>}</section>
}
