import React from 'react'
import {useViewState} from './view-state.jsx'
import {useCompositionSpace} from './useCompositionSpace.js'
export function ComparisonChart({p,fire}){
 const [root,height]=useCompositionSpace(),[view,set]=useViewState('comparison',{start:0,selected:null})
 const max=p.scaleMax||Math.max(1,...p.data.map(d=>Math.abs(d.value))),capacity=Math.max(1,Math.floor(((height||260)-(p.data.length*48+30<=(height||260)?30:74))/48)),pages=Math.max(1,Math.ceil(p.data.length/capacity)),page=Math.min(Math.floor(view.start/capacity),pages-1)
 return <section className="cs-comparison" ref={root} aria-label={p.label}>
  <header><strong>{p.label}</strong><small>共用 ±{max}{p.unit||''}</small></header>
  <div>{p.data.slice(page*capacity,(page+1)*capacity).map(d=><button key={d.id} aria-label={`${d.label}：${d.value}${p.unit||''}`} aria-pressed={String(p.selectedId??view.selected)===String(d.id)} onClick={()=>{if(fire('onSelect',{id:d.id,value:d.value,label:d.label,series:'',recordIds:d.recordIds||[]})!==false)set({...view,selected:d.id})}}>
   <span>{d.label}</span><span className="cs-comparison-track" aria-hidden="true"><i style={{left:(d.value<0?50-50*Math.abs(d.value)/max:50)+'%',width:50*Math.abs(d.value)/max+'%'}} data-negative={d.value<0}/></span><b>{d.value>0?'+':''}{d.value}{p.unit||''}</b>
  </button>)}</div>
  {pages>1&&<nav><button disabled={!page} onClick={()=>set({...view,start:(page-1)*capacity})}>上一组</button><span>{page+1} / {pages}</span><button disabled={page===pages-1} onClick={()=>set({...view,start:(page+1)*capacity})}>下一组</button></nav>}
 </section>
}
