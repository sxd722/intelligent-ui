import React from 'react'
import {PearlSculpture} from './PearlSculpture.jsx'
import {useViewState} from './view-state.jsx'
export function ProportionChart({p,fire}){
 const [local,set]=useViewState('selection',null),data=p.data||[],selected=p.selectedId??local
 const current=data.find(d=>d.id===selected)||data[0],total=data.reduce((s,d)=>s+d.value,0)
 const label=d=>`${d.label} ${Number(d.value.toFixed(2))}${p.unit||''}`
 return <section className="cs-proportion" aria-label={p.label}>
  <PearlSculpture/>
  {current?<><div className="cs-proportion-number">{Number(current.value.toFixed(2))}<small>{p.unit}</small></div><div className="cs-proportion-label">{current.label}</div>
   <div className="cs-proportion-legend">{data.map(d=>p.onSelect?<button key={d.id} aria-pressed={d.id===current.id} onClick={()=>{if(fire('onSelect',{id:d.id,value:d.value,label:d.label,series:'',recordIds:d.recordIds||[]})!==false)set(d.id)}}>{label(d)}</button>:<span key={d.id}>{label(d)}</span>)}</div>
   <div className="cs-proportion-track" role="img" aria-label={p.label+'：'+data.map(label).join('，')}>{data.map(d=><span key={d.id} style={{width:(total?d.value/total*100:0)+'%'}}/>)}</div></>:<p>暂无数据</p>}
 </section>
}
