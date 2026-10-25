import React, { lazy, Suspense, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useIntrinsicHeight } from './sizing.js'
import './rich-widgets.css'
import { useViewState } from './view-state.jsx'

const MermaidView=lazy(()=>import('./MermaidView.jsx'))
const MathView=lazy(()=>import('./MathView.jsx'))
export function Mermaid(props) { return <Suspense fallback={<span role="status">图形排版中…</span>}><MermaidView {...props}/></Suspense> }
export function MathNode({p}) { return <Suspense fallback={<code>{p.value}</code>}><MathView p={p}/></Suspense> }

export function ChoiceGroup({p,fire,kind}) {
  const track=useRef(null),thumb=useRef(null),name=useId()
  const options=p.options.map(o=>o&&typeof o==='object'?o:{value:o,label:String(o)})
  useLayoutEffect(()=>{
    if(kind!=='segmented') return
    const el=track.current
    const place=()=>{const active=el.querySelector('[aria-checked="true"]');if(!active||!thumb.current)return
      thumb.current.style.width=`${active.offsetWidth}px`;thumb.current.style.height=`${active.offsetHeight}px`;thumb.current.style.transform=`translate(${active.offsetLeft}px,${active.offsetTop}px)`
    }
    const observer=new ResizeObserver(place);observer.observe(el);[...el.querySelectorAll('button')].forEach(n=>observer.observe(n));place()
    return()=>observer.disconnect()
  },[kind,p.value,JSON.stringify(options)])
  if(kind==='select') return <label className="cs-field cs-select"><span>{p.label}</span><select value={p.value??''} disabled={p.disabled} onChange={e=>fire('onChange',{value:e.target.value})}>
    {!options.some(o=>o.value===p.value)&&<option value="" disabled>请选择</option>}{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
  </select></label>
  return <div className={kind==='segmented'?'cs-segmented-field':'cs-radio-field'} data-short-label={[...String(p.label||'')].length<=8||undefined}><span className="cs-control-label">{p.label}</span>
    <div className={kind==='segmented'?'cs-segmented':'cs-radio-group'} ref={track} role="radiogroup" aria-label={p.label}>
      {kind==='segmented'&&<i ref={thumb} className="cs-segmented-thumb" hidden={!options.some(o=>o.value===p.value)} aria-hidden="true"/>}
      {options.map((o,i)=>kind==='radio-group'?<label className="cs-radio-option" key={o.value} data-selected={p.value===o.value||undefined}><input type="radio" name={name} value={o.value} checked={p.value===o.value} disabled={p.disabled} onChange={()=>fire('onChange',{value:o.value})}/><span>{o.label}</span></label>:
        <button type="button" key={o.value} role="radio" disabled={p.disabled} aria-checked={p.value===o.value} data-selected={p.value===o.value||undefined} tabIndex={p.value===o.value||(!options.some(o=>o.value===p.value)&&i===0)?0:-1} onClick={()=>{if(!p.disabled)fire('onChange',{value:o.value})}} onKeyDown={e=>{
          if(p.disabled)return
          const delta=['ArrowRight','ArrowDown'].includes(e.key)?1:['ArrowLeft','ArrowUp'].includes(e.key)?-1:0
          const next=e.key==='Home'?0:e.key==='End'?options.length-1:delta?(i+delta+options.length)%options.length:null
          if(next==null)return;e.preventDefault();fire('onChange',{value:options[next].value});const b=track.current.querySelectorAll('button')[next];b.focus();b.scrollIntoView({block:'nearest',inline:'nearest'})
        }}>{o.label}</button>)}
    </div>
  </div>
}
const cell=(value,format)=>value==null?'—':format==='currency'&&typeof value==='number'?value.toFixed(2):String(value)
export function DataTable({p,fire}) {
  return <div className="cs-table-pan" tabIndex={0} role="region" aria-label={`${p.label}，可横向滚动`}><table className="cs-table"><caption>{p.label}</caption><thead><tr>{p.columns.map(c=><th key={c.key} scope="col">{c.label}</th>)}</tr></thead><tbody>
    {p.rows.map(r=><tr key={r.id} data-selected={p.selectedId===r.id||undefined}>{p.columns.map((c,i)=><td key={c.key} data-format={c.format||'text'}>{i===0&&p.onSelect?<button type="button" aria-pressed={p.selectedId===r.id} onClick={()=>fire('onSelect',{id:r.id,row:r})}>{cell(r[c.key],c.format)}</button>:cell(r[c.key],c.format)}</td>)}</tr>)}
    {!p.rows.length&&<tr><td colSpan={p.columns.length}>暂无记录</td></tr>}
  </tbody></table></div>
}
export function Popover({p,fire,children}) {
  const panel=useRef(null),trigger=useRef(null),id=useId(),[local,setLocal]=useState(false)
  const open=p.open??local
  const change=value=>{setLocal(value);fire('onOpenChange',{open:value})}
  const current=useRef({open,change});current.current={open,change}
  useEffect(()=>{
    const el=panel.current
    const sync=e=>{if(e.newState==='closed'&&current.current.open){current.current.change(false);trigger.current?.focus()}}
    el.addEventListener('toggle',sync);return()=>el.removeEventListener('toggle',sync)
  },[])
  useLayoutEffect(()=>{
    const el=panel.current;if(!el)return
    const position=()=>{const r=trigger.current.getBoundingClientRect(),w=Math.min(300,innerWidth-24),h=Math.min(el.scrollHeight,innerHeight-40)
      el.style.width=`${w}px`;el.style.left=`${Math.max(12,Math.min(r.left,innerWidth-w-12))}px`;el.style.top=`${r.bottom+h+8<innerHeight?r.bottom+8:Math.max(12,r.top-h-8)}px`
    }
    if(open&&!el.matches(':popover-open'))el.showPopover()
    if(!open&&el.matches(':popover-open'))el.hidePopover()
    if(open){position();el.focus()}
    window.addEventListener('resize',position);window.addEventListener('scroll',position,true)
    return()=>{window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true)}
  },[open])
  return <div className="cs-popover-owner"><button type="button" ref={trigger} aria-expanded={open} aria-controls={id} onClick={()=>change(!open)}>{p.label}</button>
    <div ref={panel} id={id} popover="auto" tabIndex={-1} className="cs-popover" role="dialog" aria-label={p.label}>
      <header><strong>{p.label}</strong><button type="button" aria-label="关闭浮层" onClick={()=>change(false)}>×</button></header>{children}
    </div>
  </div>
}
export function SwipeStack({p,fire,streaming}) {
  const [local,setLocal]=useViewState('index',0),[drag,setDrag]=useState(0),start=useRef(null),deck=useRef(null),[locked,setLocked]=useState(false)
  const index=p.index??local, item=p.items[index]
  const size=useIntrinsicHeight(deck,streaming,el=>Math.max(104,...[...el.querySelectorAll('.cs-swipe-item')].map(n=>n.scrollHeight)))
  const swipe=direction=>{if(!item||p.disabled||locked)return
    setLocked(true);setDrag(0);fire('onSwipe',{id:item.id,index,direction,item});if(p.index==null)setLocal(index+1)
  }
  useEffect(()=>{setLocked(false)},[index])
  // A controlled action can intentionally keep the current item (e.g. invalid input).
  useEffect(()=>{if(!locked)return;const t=setTimeout(()=>setLocked(false),240);return()=>clearTimeout(t)},[locked])
  return <section className="cs-swipe" aria-label={p.label}><header><strong>{p.label}</strong><span>{Math.min(index+1,p.items.length)} / {p.items.length}</span></header>
    <div className="cs-swipe-deck" ref={deck} style={{height:(size.height||120)+14}} onPointerDown={e=>{if(!item||p.disabled||e.button!==0)return;start.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(start.current)setDrag(Math.max(-100,Math.min(100,e.clientX-start.current.x)))}} onPointerUp={e=>{const s=start.current;start.current=null;setDrag(0);if(s&&Math.abs(e.clientX-s.x)>55&&Math.abs(e.clientY-s.y)<60)swipe(e.clientX>s.x?'right':'left')}} onPointerCancel={()=>{start.current=null;setDrag(0)}}>
      {p.items.map((n,i)=><article key={n.id} className="cs-swipe-item" aria-hidden={i!==index} data-depth={i-index} style={{visibility:i>=index&&i<index+3?'visible':'hidden',zIndex:p.items.length-i,transform:i===index?`translateX(${drag}px) rotate(${drag/18}deg)`:`translateY(${Math.min(2,Math.max(0,i-index))*6}px) scale(${1-Math.min(2,Math.max(0,i-index))*.035})`}}><strong>{n.title}</strong><p>{n.description}</p></article>)}
      {!item&&<p role="status">已浏览全部卡片</p>}
    </div><div className="cs-swipe-actions"><button type="button" disabled={!item||p.disabled||locked} onClick={()=>swipe('left')}>{p.leftLabel||'跳过'}</button><button type="button" disabled={!item||p.disabled||locked} onClick={()=>swipe('right')}>{p.rightLabel||'保留'}</button></div>
  </section>
}
export function Confetti({p}) {
  const previous=useRef(p.trigger),[burst,setBurst]=useState(0),[active,setActive]=useState(false)
  useEffect(()=>{if(Object.is(previous.current,p.trigger))return;const old=previous.current;previous.current=p.trigger
    if(p.trigger==null||p.trigger===false||(typeof p.trigger==='number'&&typeof old==='number'&&p.trigger<=old)){setActive(false);return}
    setBurst(n=>n+1);setActive(true);const t=setTimeout(()=>setActive(false),1200);return()=>clearTimeout(t)
  },[p.trigger])
  return <span className="cs-celebration" role="status"><span className="cs-sr-only">{burst?p.label||'完成！':''}</span>{active&&<span key={burst} className="cs-confetti" aria-hidden="true">{Array.from({length:16},(_,i)=><i key={i} style={{'--x':`${(i%8-3.5)*24}px`,'--turn':`${i*61}deg`,'--delay':`${i%4*35}ms`}}/>)}</span>}</span>
}
