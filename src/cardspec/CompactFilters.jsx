import React,{useLayoutEffect,useRef,useState} from 'react'
import './compact-filters.css'
// Keep children mounted: collapsing must not reset drafts or selected values.
export function FilterDisclosure({label='筛选',summary='',children,open,onChange,onClear}){
 const [local,setLocal]=useState(false),expanded=open??local,root=useRef(null)
 const change=value=>{setLocal(value);onChange?.(value)}
 return <div className="cs-filter-bar"><details ref={root} open={expanded} onToggle={e=>{if(e.currentTarget.open!==expanded)change(e.currentTarget.open)}} onKeyDown={e=>{if(e.key==='Escape'){change(false);root.current.querySelector('summary').focus()}}}><summary title={summary||label}><span>{label}</span><small>{summary||'全部'}</small><span aria-hidden="true">⌄</span></summary><div className="cs-filter-options">{children}<button type="button" className="cs-button" onClick={()=>change(false)}>完成筛选</button></div></details>{onClear&&summary&&<button type="button" className="cs-filter-clear" aria-label="清除筛选" onClick={onClear}>清除</button>}</div>
}
export function CompactChipGroup({attrs,flow,label,children}){
 const body=useRef(null),[info,setInfo]=useState({count:0,selected:''})
 useLayoutEffect(()=>{
  const el=body.current;if(!el)return
  const update=()=>{const buttons=[...el.querySelectorAll('button')];const chosen=buttons.filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.textContent.trim()||b.getAttribute('aria-label'));const selected=chosen.slice(0,2).join(' · ')+(chosen.length>2?' +'+(chosen.length-2):'');setInfo(old=>old.count===buttons.length&&old.selected===selected?old:{count:buttons.length,selected})}
  update();const observer=new MutationObserver(update);observer.observe(el,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['aria-pressed','aria-label']});return()=>observer.disconnect()
 },[children])
 const options=<div ref={body} className="cs-chip-strip" role="group" aria-label={label} style={flow}>{children}</div>
 // A stable disclosure tree prevents a count change from remounting action nodes.
 return <div {...attrs} className="cs-compact-chips" data-many={info.count>4}><FilterDisclosure label={label||'选项'} summary={info.selected} open={info.count>4?undefined:true}>{options}</FilterDisclosure></div>
}
