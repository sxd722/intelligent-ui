import React,{useLayoutEffect,useRef,useState,useEffect} from 'react'
import {useViewState} from './view-state.jsx'
import {useCompositionSpace} from './useCompositionSpace.js'
import {collectionTitle,collectionFacts} from '../../shared/cardspec/collection.mjs'
import {studyLayout,studyPreview} from '../../shared/cardspec/study-layout.mjs'
import {useCardSize} from '../CardSize.jsx'
import './study-spread.css'

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
function StudyCover({item,fields,title,index,labelWidth,focus}){
 const [failed,setFailed]=useState(false)
 useEffect(()=>setFailed(false),[item.assetRef])
 const asset=typeof item.assetRef==='string'&&/^asset\.v1\.[\w-]+\.[\w-]+$/.test(item.assetRef)&&item.assetRef.length<=3000
 const meta=collectionFacts(item,fields).map(f=>`${f.label} ${f.text}`).filter(v=>v&&v!==title)
 return <><span className="cs-spread-number" aria-hidden="true">{String(index+1).padStart(2,'0')}</span>
  <span className="cs-spread-illustration" aria-hidden="true">{asset&&!failed?<img src={'/api/tools/assets/'+encodeURIComponent(item.assetRef)} alt="" onError={()=>setFailed(true)}/>:<Artwork seed={hash(item.rowKey??item.id)}/>}</span>
  <span className="cs-spread-label"><strong>{studyPreview(title,labelWidth/14*(focus?1:2)*.85)}</strong>{meta.length>0&&<small>{studyPreview(meta[0],labelWidth/10*.85)}</small>}</span>
 </>
}
export function StudyCollection({p,fire}){
 const size=useCardSize(),[root,space]=useCompositionSpace({fill:p.presentation!=='spread'||size!=='auto'}),[view,set]=useViewState('study',{selected:null,start:0})
 const [width,setWidth]=useState(400),dialog=useRef(null)
 useLayoutEffect(()=>{const el=root.current;if(!el)return;const read=()=>{if(el.clientWidth)setWidth(el.clientWidth)};const ro=new ResizeObserver(read);ro.observe(el);read();return()=>ro.disconnect()},[])
 const items=p.items||[],deck=p.presentation==='spread',selectedId=p.selectedId??view.selected
 const index=Math.max(0,items.findIndex(r=>String(r.rowKey??r.id)===String(selectedId))),selected=items[index]
 const revealed=p.revealed!==false
 const pick=i=>{const item=items[i];if(item&&fire('onSelect',{id:item.rowKey??item.id,value:item.rowKey??item.id,item})!==false)set({...view,selected:item.rowKey??item.id})}
 const title=r=>collectionTitle(r,p.titleKey),description=r=>String(r?.[p.subtitleKey||'description']??(r?.$display?collectionFacts(r,p.fields).map(f=>`${f.label}：${f.text}`).join(' · '):''))
 const layout=studyLayout({width,space:space??280,size,titles:items.map(title),count:items.length,start:view.start})
 return <section ref={root} className={'cs-study '+(deck?'cs-study-spread':'cs-study-folio')} data-spread-layout={deck?layout.mode:undefined} data-spread-compact={deck&&layout.compact||undefined} style={deck?{'--study-space':layout.height+'px','--spread-columns':layout.capacity,'--spread-reading':layout.reading+'px'}:space?{'--study-space':space+'px'}:undefined} aria-label={p.label||'探索集合'}>
  {!selected?<p>暂无内容</p>:deck?<>
   <header className="cs-spread-heading"><span>{p.label||'选择一张，展开探索'}</span><small>{items.length} 项</small></header>
   <div className="cs-study-deck" data-revealed={revealed}>{items.slice(layout.start,layout.end).map((item,j)=><button type="button" key={item.rowKey??item.id} disabled={!revealed} aria-label={revealed?title(item):`第${layout.start+j+1}张 · 尚未揭示`} aria-pressed={String(item.rowKey??item.id)===String(selectedId)} onClick={()=>pick(layout.start+j)} style={{'--card-order':j}}>
    <span className="cs-study-card-inner"><span className="cs-study-back" aria-hidden="true"><Artwork seed={0}/></span><span className="cs-study-front" aria-hidden={!revealed}><StudyCover item={item} fields={p.fields} title={title(item)} index={layout.start+j} labelWidth={layout.mode==='focus'?width-110:width/layout.capacity-30} focus={layout.compact}/></span></span>
   </button>)}</div>
   <button type="button" className="cs-spread-reading" disabled={!revealed} onClick={()=>dialog.current?.showModal()} aria-label={revealed?`${title(selected)} · 查看完整解读`:'等待揭示'}>
    <span aria-live="polite"><strong>{revealed?studyPreview(title(selected),(width-80)/14*.85):'等待揭示'}</strong><span className="cs-spread-excerpt">{revealed?studyPreview(description(selected),(width-80)/12*(layout.compact?1:2)*.8):'使用卡片的揭示操作展开内容。'}</span></span><span className="cs-spread-read-hint" aria-hidden="true">解读 ↗</span>
   </button>
   {layout.pages>1&&<nav aria-label="牌阵分组"><button type="button" aria-label="上一组" disabled={!layout.page} onClick={()=>set({...view,start:(layout.page-1)*layout.capacity})}>←</button><span>{layout.page+1} / {layout.pages}</span><button type="button" aria-label="下一组" disabled={layout.page===layout.pages-1} onClick={()=>set({...view,start:(layout.page+1)*layout.capacity})}>→</button></nav>}
   <dialog ref={dialog} className="cs-spread-dialog" aria-label="完整解读"><header><strong>{title(selected)}</strong><button type="button" aria-label="关闭解读" onClick={()=>dialog.current?.close()}>×</button></header>{(p.fields||[]).map(key=>selected[key]).filter(v=>typeof v==='string'||typeof v==='number').map((v,i)=><small key={i}>{String(v)}</small>)}<p>{description(selected)}</p></dialog>
  </>:<>
   <div className="cs-study-scene"><div className="cs-study-copy"><small>{String(index+1).padStart(2,'0')} / {String(items.length).padStart(2,'0')}</small><h3>{title(selected)}</h3><p>{description(selected)}</p></div><Artwork engraving seed={hash(selected.rowKey??selected.id)}/></div>
   <nav><button disabled={!index} onClick={()=>pick(index-1)} aria-label="前一章">←</button><span>{p.label||'章节'}</span><button disabled={index===items.length-1} onClick={()=>pick(index+1)} aria-label="后一章">→</button></nav>
  </>}
 </section>
}
