import React,{useRef,useState} from 'react'
import './compact-choices.css'
export function CardSettings({children,label="偏好设置"}){
 const dialog=useRef(null),[open,setOpen]=useState(false)
 return <div className="cs-card-settings"><button type="button" aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={()=>{dialog.current.showModal();setOpen(true)}}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--cs-bg,#eef3f4)"/><circle cx="15" cy="17" r="3" fill="var(--cs-bg,#eef3f4)"/></svg></button><dialog ref={dialog} className="cs-dialog cs-settings-dialog" aria-label={label} onClose={()=>setOpen(false)}><header><strong>{label}</strong><button type="button" aria-label={label==="偏好设置"?"关闭设置":"关闭"+label} onClick={()=>dialog.current.close()}>×</button></header><div className="cs-stack">{children}</div><button type="button" className="cs-button" onClick={()=>dialog.current.close()}>完成</button></dialog></div>
}
export function ChoiceTile({p,fire,children,attrs}){
 const selected=p.selected??p.variant==='primary'
 // Photo attribution is a separate button, never nested in the selection button.
 return <article {...attrs} className="cs-choice-tile" data-selected={selected}><div className="cs-choice-avatar">{children[0]}<button type="button" className="cs-choice-hit" aria-label={`选择 ${p.label||'候选'}`} aria-pressed={!!selected} disabled={p.disabled} onClick={()=>fire('onPress')}>{selected&&<span aria-hidden="true">✔</span>}</button></div><div className="cs-choice-summary">{children.slice(1)}{typeof p.summary==='string'&&<span className="cs-choice-description" title={p.summary}>{p.summary}</span>}{typeof p.rating==='number'&&<small>★ {p.rating}</small>}</div></article>
}
