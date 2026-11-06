// Screen-space separation only: leader lines retain the actual geographic point.
// Stable input numbering survives omitted coordinates and arbitrary string IDs.
export function separateMapPins(points,width,height,reserved=[]){
 const gap=46,pad=24,placed=[]
 // Reserve isolated anchors first; dense clusters should not push a distant
 // landmark across the map simply because it came last in the data array.
 const ordered=points.map((point,index)=>({...point,index,crowding:points.filter(q=>q!==point&&Math.hypot(point.x-q.x,point.y-q.y)<gap).length})).sort((a,b)=>a.crowding-b.crowding||a.index-b.index)
 for(const point of ordered){
  const clamp=(v,min,max)=>Math.max(min,Math.min(Math.max(min,max),v))
  let best=null
  for(let ring=0;ring<12&&!best;ring++){
   const count=ring?ring*8:1
   for(let i=0;i<count;i++){
    const angle=i/count*Math.PI*2
    const x=clamp(point.x+Math.cos(angle)*ring*gap,pad,width-pad),y=clamp(point.y+Math.sin(angle)*ring*gap,pad,height-pad-20)
    const blocked=reserved.some(r=>x+22>r.left&&x-22<r.right&&y+22>r.top&&y-22<r.bottom)
    if(!blocked&&placed.every(p=>Math.hypot(p.x-x,p.y-y)>=gap-1)){best={...point,x,y};break}
   }
  }
  placed.push(best||{...point})
 }
 return placed.sort((a,b)=>a.index-b.index).map((p,i)=>({...p,displaced:Math.hypot(p.x-points[i].x,p.y-points[i].y)>2}))
}
