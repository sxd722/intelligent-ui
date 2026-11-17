import React,{useLayoutEffect,useRef,useState,useId} from 'react'
import {useViewState} from './view-state.jsx'
import {useChartMotion} from './useChartMotion.js'
import {chartNumber} from '../../shared/cardspec/widgets.mjs'
import {chartDomain,chartTicks,axisLabel,axisNumber} from './chart-layout.mjs'
import './compact-chart.css'
const colors=['var(--cs-accent,#369b84)','#cb6177','#7c82c2','#c79544','#578db1','#878787']
export function CompactChart({p,fire,selectionKey='selection'}){
 const root=useRef(null),[width,setWidth]=useState(320),gradient=useId().replaceAll(':','')
 const animated=useChartMotion(p.data,root),[local,setLocal]=useViewState(selectionKey,null)
 useLayoutEffect(()=>{const el=root.current;if(!el)return;const update=()=>{const w=Math.floor(el.getBoundingClientRect().width);if(w>0)setWidth(old=>Math.abs(old-w)>1?w:old)};const ro=new ResizeObserver(update);ro.observe(el);update();return()=>ro.disconnect()},[])
 const data=p.data,series=[...new Set(data.map(d=>d.series||''))],multi=series.length>1||p.kind==='stacked',labels=multi?[...new Set(data.map(d=>d.label))]:data.map(d=>d.label)
 const indexFor=d=>multi?labels.indexOf(d.label):data.findIndex(p=>p.id===d.id)
 const {min,max}=chartDomain(data,p.kind),left=43,right=12,top=15,bottom=125,plot=Math.max(1,width-left-right)
 const x=i=>left+(p.kind==='line'?(labels.length===1?.5:i/(labels.length-1)):(i+.5)/labels.length)*plot
 const y=v=>top+(max-v)/(max-min||1)*(bottom-top),ticks=chartTicks(labels.length,width)
 const selected=data.find(d=>d.id===(p.selectedId??local))||data.at(-1),selectedIndex=data.indexOf(selected)
 const pick=point=>{if(point&&fire('onSelect',{id:point.id,value:point.value,label:point.label,series:point.series||'',recordIds:point.recordIds||[]})!==false)setLocal(point.id)}
 const pointer=(e,force=false)=>{const rect=e.currentTarget.getBoundingClientRect(),px=(e.clientX-rect.left)*width/rect.width,py=(e.clientY-rect.top)*158/rect.height;let winner;let distance=Infinity;for(const d of data){const dist=Math.abs(px-x(indexFor(d)))*5+Math.abs(py-y(d.value));if(dist<distance){distance=dist;winner=d}}if(winner&&(force||winner.id!==selected?.id))pick(winner)}
 return <section ref={root} className="cs-chart cs-chart-fit" aria-label={p.label}>
  <strong>{p.label}{p.unit?`（${p.unit}）`:''}</strong>
  {!data.length?<p>暂无数据</p>:<>
   {series.length>1&&<div className="cs-chart-legend">{series.map((s,i)=><span key={s} style={{color:colors[i%colors.length]}}>● {s||'数值'}</span>)}</div>}
   <div className="cs-chart-pan cs-chart-viewport">
    <svg viewBox={`0 0 ${width} 158`} width="100%" height="158" role="img" aria-label={`${p.label}，${data.length}项数据，数值范围${chartNumber(min)}至${chartNumber(max)}`} onPointerDown={e=>{e.stopPropagation();pointer(e,true);e.currentTarget.setPointerCapture?.(e.pointerId)}} onPointerMove={e=>{if(e.buttons===1){e.stopPropagation();pointer(e)}}} onPointerUp={e=>{e.stopPropagation();if(e.currentTarget.hasPointerCapture?.(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}}>
     <defs>{series.map((s,i)=><linearGradient id={`${gradient}-${i}`} key={s} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={colors[i%colors.length]} stopOpacity=".22"/><stop offset="1" stopColor={colors[i%colors.length]} stopOpacity="0"/></linearGradient>)}</defs>
     {[max,(max+min)/2,min].map((v,i)=><g key={i} className="cs-chart-axis"><line x1={left} x2={width-right} y1={y(v)} y2={y(v)} stroke="currentColor" opacity=".12" strokeDasharray="3 4"/><text x={left-6} y={y(v)+3} textAnchor="end">{axisNumber(v,max-min)}</text></g>)}
     {p.kind!=='line'&&<line x1={left} x2={width-right} y1={y(0)} y2={y(0)} stroke="currentColor" opacity=".3"/>}
     {series.map((s,si)=>{const rows=animated.filter(d=>(d.series||'')===s),points=rows.map(d=>`${x(indexFor(d))},${y(d.value)}`).join(' '),color=colors[si%colors.length];return <g key={s} fill={color}>
      {p.kind==='line'&&rows.length>1&&<><polygon points={`${x(indexFor(rows[0]))},${bottom} ${points} ${x(indexFor(rows.at(-1)))},${bottom}`} fill={`url(#${gradient}-${si})`}/><polyline points={points} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"/></>}
      {rows.map(d=>{const active=selected?.id===d.id,ix=indexFor(d),step=plot/Math.max(1,labels.length),bw=Math.max(1,Math.min(28,step*.72/(p.kind==='stacked'?1:series.length))),offset=p.kind==='stacked'?animated.filter(a=>a.label===d.label&&series.indexOf(a.series||'')<si&&Math.sign(a.value)===Math.sign(d.value)).reduce((sum,a)=>sum+a.value,0):0,cx=x(ix)+(p.kind==='stacked'?0:(si-(series.length-1)/2)*bw);return <g key={d.id} className="cs-chart-point" data-point-id={d.id} data-selected={active||undefined}>{p.kind==='line'?<circle cx={x(ix)} cy={y(d.value)} r={active?4:rows.length>12?1.8:2.6} opacity={active?1:.7}/>:<rect x={cx-bw/2} y={Math.min(y(offset),y(offset+d.value))} width={Math.max(1,bw-1)} height={Math.max(1,Math.abs(y(offset+d.value)-y(offset)))} rx={2} opacity={active?1:.65}/>}</g>})}
     </g>})}
     {selected&&<line x1={x(indexFor(selected))} x2={x(indexFor(selected))} y1={top} y2={bottom} stroke="currentColor" opacity=".3" strokeDasharray="2 3"/>}
     {ticks.map(i=><text key={i} className="cs-chart-axis" x={x(i)} y="149" textAnchor={i===0?'start':i===labels.length-1?'end':'middle'}>{axisLabel(labels[i])}</text>)}
    </svg>
   </div>
   <div className="cs-chart-inspect"><button type="button" aria-label="上一个数据点" disabled={selectedIndex<=0} onClick={()=>pick(data[selectedIndex-1])}>‹</button><label><span className="cs-chart-a11y">查看数据点</span><select aria-label={`${p.label}：查看数据点`} value={selected?.id||''} onChange={e=>pick(data.find(d=>d.id===e.target.value))}>{data.map(d=><option key={d.id} value={d.id}>{d.label}{d.series?' · '+d.series:''}</option>)}</select><output aria-live="polite" title={selected?String(selected.value):undefined}>{selected?chartNumber(selected.value):''}{p.unit||''}</output></label><button type="button" aria-label="下一个数据点" disabled={selectedIndex>=data.length-1} onClick={()=>pick(data[selectedIndex+1])}>›</button></div>
   <details className="cs-chart-data"><summary>全部数据 · {data.length}</summary><div>{data.map(d=><button type="button" key={d.id} aria-label={`${d.label} ${d.value}${p.unit||''}`} aria-pressed={selected?.id===d.id} onClick={()=>pick(d)}><span>{d.label}{d.series?' · '+d.series:''}</span><b>{chartNumber(d.value)}{p.unit||''}</b></button>)}</div></details>
  </>}
 </section>
}
