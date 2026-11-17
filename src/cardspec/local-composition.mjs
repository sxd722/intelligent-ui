// Local geometry only. Never move nodes across a region, conditional or logic scope.
export function localComposition(items,width){
 const full=()=>items.map(()=>({column:'1 / -1',row:'auto'}))
 const cells=full()
 const graphic=items.findIndex(x=>x.kind==='graphic')
 if(graphic>=0&&items.filter(x=>x.kind==='graphic').length===1){
  let end=graphic+1
  while(end<items.length&&end-graphic<=4&&['choices','facts','controls'].includes(items[end].kind))end++
  const minimum=Math.max(144,items[graphic].minimum||260)
  const peer=Math.max(140,...items.slice(graphic+1,end).map(x=>x.minimum||140))
  if(end>graphic+1&&width>=minimum+peer+12){
   for(let i=0;i<graphic;i++)cells[i].row=String(i+1)
   cells[graphic]={column:'1',row:`${graphic+1} / span ${end-graphic-1}`}
   for(let i=graphic+1;i<end;i++)cells[i]={column:'2',row:String(i)}
   for(let i=end;i<items.length;i++)cells[i].row=String(i)
   return {kind:'visual-facts',columns:`${minimum}px minmax(0,1fr)`,cells,graphic}
  }
 }
 for(let i=0;i<items.length-1;i++){
  if(items[i].kind==='choices'&&items[i].count>=4&&items[i].count<=6&&items[i+1].kind==='detail'&&width>=(items[i].minimum||180)+180+12){
   items.forEach((_,j)=>cells[j].row=String(j>i?j:j+1))
   cells[i].column='1';cells[i+1].column='2'
   return {kind:'choice-detail',columns:'minmax(0,1fr) minmax(0,1fr)',cells}
  }
 }
 return null
}

export function statPresentation(value,explicit){
 if(explicit==='primary'||explicit==='meta')return explicit
 // Dates/time ranges and words are facts, not quantitative KPIs. Never parse labels.
 if(typeof value==='number')return 'primary'
 const text=String(value??'').trim()
 if(/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(text)||/\d{1,2}:\d{2}/.test(text))return 'meta'
 return /^[+−-]?[\d,.]+\s*(?:%|°[CF]?|[kKmMbB万亿]|元|人|次|个)?$/.test(text)?'primary':'meta'
}
