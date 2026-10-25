import {useChartMotion} from './useChartMotion.js'
import React,{useRef} from 'react'
import {useViewState} from './view-state.jsx'
import {chartNumber} from '../../shared/cardspec/widgets.mjs'
const colors=['#369b84','#cb6177','#7c82c2','#c79544','#578db1','#878787']
export function SeriesChart({p,fire}){
 const paintRef=useRef(null),animated=useChartMotion(p.data,paintRef)
 const [selection,set]=useViewState('series-selection',null),selected=p.selectedId??selection,series=[...new Set(p.data.map(d=>d.series||'数值'))],labels=[...new Set(p.data.map(d=>d.label))]
 const stacks=labels.map(label=>p.data.filter(d=>d.label===label).reduce((s,d)=>s+Math.max(0,d.value),0))
 const top=Math.max(0,...(p.kind==='stacked'?stacks:p.data.map(d=>d.value))),bottom=Math.min(0,...p.data.map(d=>d.value)),span=top-bottom||1,w=Math.max(260,labels.length*65)
 const x=i=>(i+.5)*w/labels.length,y=v=>12+(top-v)/span*105
 const pick=d=>{if(fire('onSelect',{id:d.id,label:d.label,value:d.value,series:d.series||'',recordIds:d.recordIds||[]})!==false)set(d.id)}
 return <section ref={paintRef} className="cs-chart" aria-label={p.label}><strong>{p.label}</strong><div className="cs-row">{series.map((s,i)=><small key={s} style={{color:colors[i%colors.length]}}>● {s}</small>)}</div><div className="cs-chart-pan" tabIndex={0}><div style={{width:w,minWidth:'100%'}}>
  <svg viewBox={`0 0 ${w} 130`} width="100%" height="130" role="img" aria-label={p.label}>
   <line x1="0" x2={w} y1={y(0)} y2={y(0)} stroke="currentColor" opacity=".3"/>
   {series.map((s,si)=>{const points=animated.filter(d=>(d.series||'数值')===s);return <g key={s} fill={colors[si%colors.length]}>
    {p.kind==='line'&&<polyline points={points.map(d=>`${x(labels.indexOf(d.label))},${y(d.value)}`).join(' ')} fill="none" stroke={colors[si%colors.length]} strokeWidth="2"/>}
    {points.map(d=>{const ix=labels.indexOf(d.label),offset=p.kind==='stacked'?animated.filter(a=>a.label===d.label&&series.indexOf(a.series||'数值')<si).reduce((n,a)=>n+a.value,0):0,bw=p.kind==='stacked'?28:Math.min(18,40/series.length),cx=x(ix)+(p.kind==='stacked'?0:(si-(series.length-1)/2)*bw);return p.kind==='line'?<circle key={d.id} cx={x(ix)} cy={y(d.value)} r={selected===d.id?5:3}/>:<rect key={d.id} x={cx-bw/2} y={Math.min(y(offset),y(offset+d.value))} width={bw-1} height={Math.max(1,Math.abs(y(offset+d.value)-y(offset)))} rx="2"/>})}
   </g>})}
  </svg><div className="cs-chart-labels" style={{gridTemplateColumns:`repeat(${labels.length},minmax(0,1fr))`}}>{labels.map(label=><div key={label}><small>{label}</small>{p.data.filter(d=>d.label===label).map(d=><button type="button" key={d.id} title={String(d.value)} aria-pressed={selected===d.id} aria-label={`${d.label} ${d.series||''} ${d.value}`} onClick={()=>pick(d)}>{chartNumber(d.value)}</button>)}</div>)}</div>
 </div></div></section>
}
