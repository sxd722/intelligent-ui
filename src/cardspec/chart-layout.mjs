export function chartDomain(data,kind='line'){
 let values=data.map(d=>d.value)
 if(kind==='stacked')values=[...new Set(data.map(d=>d.label))].flatMap(label=>{const rows=data.filter(d=>d.label===label);return [rows.reduce((s,d)=>s+Math.max(0,d.value),0),rows.reduce((s,d)=>s+Math.min(0,d.value),0)]})
 if(!values.length)return {min:0,max:1}
 const lo=Math.min(...values),hi=Math.max(...values)
 if(kind!=='line')return {min:Math.min(0,lo),max:Math.max(0,hi)|| (lo<0?0:1)}
 const pad=hi===lo?Math.max(Math.abs(hi)*.02,1):(hi-lo)*.1
 return {min:lo-pad,max:hi+pad}
}
export function chartTicks(count,width){
 if(!count)return []
 if(count===1)return [0]
 const n=Math.min(count,Math.max(2,Math.min(5,Math.floor((width-48)/74))))
 return [...new Set(Array.from({length:n},(_,i)=>Math.round(i*(count-1)/(n-1))))]
}
export function axisLabel(label){const text=String(label);return /^\d{4}-\d{2}-\d{2}/.test(text)?text.slice(5,10):text.length>10?text.slice(0,9)+'…':text}
export function axisNumber(value,span){
 const abs=Math.abs(value),precision=span>0?Math.min(12,Math.max(3,Math.ceil(Math.log10(Math.max(abs,1)/span))+2)):3
 for(const [scale,suffix]of [[1e9,'B'],[1e6,'M'],[1e3,'k']])if(abs>=scale)return Number((value/scale).toPrecision(precision))+suffix
 return String(Number(value.toPrecision(precision)))
}
