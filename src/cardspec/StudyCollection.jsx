import React from 'react'
import {useViewState} from './view-state.jsx'
import {useCompositionSpace} from './useCompositionSpace.js'
import {collectionTitle} from '../../shared/cardspec/collection.mjs'

// Host geometry is decorative. Only labels/data describe the selected object.
function Artwork({seed=0,engraving=false}){
 return <svg viewBox="0 0 200 220" aria-hidden="true" className="cs-study-art">
  {engraving?<><path d="M48 186Q33 80 66 47Q106 18 135 55Q155 94 128 183L91 203Z" fill="currentColor" opacity=".1"/>
   {Array.from({length:19},(_,i)=><path key={i} d={`M${51+i*3} ${55+i%3*4}Q${35+i*5} 118 ${62+i*3} 189`} fill="none" stroke="currentColor" opacity=".25"/>)}
   <path d="M53 83Q78 65 90 87M100 85Q123 69 135 91M94 89L85 125 105 129M71 155Q99 131 121 157Q100 182 71 155Z" fill="none" stroke="currentColor" strokeWidth="2"/>
   <path d={`M10 ${40+seed%3*22}Q150 10 170 99T32 211`} stroke="#a83e31" fill="none" strokeWidth="2"/>
  </>:<><path d="M20 206V76Q24 35 100 12Q176 35 180 76V206Z" fill="none" stroke="currentColor" opacity=".5"/>
   <circle cx="100" cy="113" r={43+seed%3*4} fill="none" stroke="currentColor" opacity=".65"/>
   <ellipse cx="100" cy="113" rx="58" ry="23" fill="none" stroke="currentColor" transform={`rotate(${30+seed%5*18} 100 113)`}/>
   <path d={`M100 ${50+seed%3*6}L${132+seed%5*3} 113 100 174 64 113Z`} fill="currentColor" opacity=".22"/>
   <path d="M100 51V174M64 113H138" stroke="currentColor" opacity=".65"/>
   {Array.from({length:7},(_,i)=><circle key={i} cx={25+(i*29+seed*11)%150} cy={38+(i*37)%151} r="1.5" fill="currentColor"/>)}
  </>}
 </svg>
}
const hash=id=>[...String(id)].reduce((a,c)=>a+c.charCodeAt(0),0)
export function StudyCollection({p,fire}){
 const [root,space]=useCompositionSpace(),[view,set]=useViewState('study',{selected:null,start:0})
 const items=p.items||[],deck=p.presentation==='spread',selectedId=p.selectedId??view.selected
 const index=Math.max(0,items.findIndex(r=>String(r.rowKey??r.id)===String(selectedId))),selected=items[index]
 const page=Math.min(Math.floor(view.start/3),Math.max(0,Math.ceil(items.length/3)-1)),revealed=p.revealed!==false
 const pick=i=>{const item=items[i];if(item&&fire('onSelect',{id:item.rowKey??item.id,value:item.rowKey??item.id,item})!==false)set({...view,selected:item.rowKey??item.id})}
 const title=r=>collectionTitle(r,p.titleKey),description=r=>String(r?.[p.subtitleKey||'description']??'')
 return <section ref={root} className={'cs-study '+(deck?'cs-study-spread':'cs-study-folio')} style={space?{'--study-space':space+'px'}:undefined} aria-label={p.label||'探索集合'}>
  {!selected?<p>暂无内容</p>:deck?<>
   <div className="cs-study-deck" data-revealed={revealed}>{items.slice(page*3,page*3+3).map((item,j)=><button key={item.rowKey??item.id} disabled={!revealed} aria-label={revealed?title(item):`第${page*3+j+1}张 · 尚未揭示`} aria-pressed={String(item.rowKey??item.id)===String(selected.rowKey??selected.id)} onClick={()=>pick(page*3+j)} style={{'--card-order':j}}>
    <span className="cs-study-card-inner"><span className="cs-study-back"><Artwork seed={0}/></span><span className="cs-study-front"><Artwork seed={hash(item.rowKey??item.id)}/><strong>{title(item)}</strong></span></span>
   </button>)}</div>
   <div className="cs-study-reading" aria-live="polite"><strong>{revealed?title(selected):'等待揭示'}</strong><p>{revealed?description(selected):'选择一个主题，再揭示这组内容。'}</p></div>
   {items.length>3&&<nav><button disabled={!page} onClick={()=>set({...view,start:(page-1)*3})}>上一组</button><span>{page+1} / {Math.ceil(items.length/3)}</span><button disabled={(page+1)*3>=items.length} onClick={()=>set({...view,start:(page+1)*3})}>下一组</button></nav>}
  </>:<>
   <div className="cs-study-scene"><div className="cs-study-copy"><small>{String(index+1).padStart(2,'0')} / {String(items.length).padStart(2,'0')}</small><h3>{title(selected)}</h3><p>{description(selected)}</p></div><Artwork engraving seed={hash(selected.rowKey??selected.id)}/></div>
   <nav><button disabled={!index} onClick={()=>pick(index-1)} aria-label="前一章">←</button><span>{p.label||'章节'}</span><button disabled={index===items.length-1} onClick={()=>pick(index+1)} aria-label="后一章">→</button></nav>
  </>}
 </section>
}
