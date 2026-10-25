export const recordId=(r,i)=>String(r.rowKey??r.id??i)
// Controlled selections mirror onSelect. Apply-only planners keep a local
// draft, initialized/reset by an external selection change, not every render.
export function experienceSelection(props,view){
 const external=Array.isArray(props.selectedIds)?props.selectedIds.map(String):null
 const source=external===null?null:JSON.stringify(external)
 const ids=external!==null&&(props.onSelect||source!==view.selectionSource)?external:(view.selected||[]).map(String)
 return {ids,source}
}
export function selectRecords(items,ids){const selected=new Set(ids.map(String));return items.filter((r,i)=>selected.has(recordId(r,i)))}
// A filtered item list is not the selection universe. Keep the selected row
// snapshots through filtering/restoration; never reinterpret a saved row using
// a newer query's row with the same ID. Unknown identities remain unresolved.
export function experienceSelectedRecords(items,ids,cached=[]){
 const records=new Map(items.map((r,i)=>[recordId(r,i),r]))
 for(const [i,row]of cached.entries())records.set(recordId(row,i),row)
 return [...new Set(ids.map(String))].flatMap(id=>records.has(id)?[records.get(id)]:[])
}
export function toggleSelection(ids,id,multiple=true,limit=Infinity){id=String(id);return multiple?(ids.includes(id)?ids.filter(x=>x!==id):ids.length>=limit?[...ids]:[...ids,id]):[id]}
export function facetCounts(items,field){const counts=new Map();for(const row of items){const v=row[field];if(v==null||typeof v==='object')continue;const k=String(v);counts.set(k,(counts.get(k)||0)+1)}return [...counts].sort((a,b)=>b[1]-a[1]).slice(0,12)}
export function compositionRows(items,{query='',facets={}}={}){
 return items.filter(r=>Object.entries(facets).every(([k,v])=>!v||String(r[k]??'')===v)&&(!query||Object.values(r).some(v=>v!=null&&typeof v!=='object'&&String(v).toLowerCase().includes(query.toLowerCase()))))
}
export function geoPoints(items){
 return items.flatMap((row,i)=>{
  const lat=row.latitude??row.lat,lon=row.longitude??row.lng??row.lon
  if(typeof lat!=='number'||typeof lon!=='number'||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>85||Math.abs(lon)>180)return []
  return [{id:recordId(row,i),label:String(row.title??row.name??row.label??recordId(row,i)),lat,lon,item:row}]
 })
}
export function projectPoints(items){
 const points=geoPoints(items).map(p=>({...p,mx:(p.lon+180)/360,my:(1-Math.log(Math.tan(Math.PI/4+p.lat*Math.PI/360))/Math.PI)/2}))
 const minX=Math.min(...points.map(p=>p.mx)),maxX=Math.max(...points.map(p=>p.mx)),minY=Math.min(...points.map(p=>p.my)),maxY=Math.max(...points.map(p=>p.my))
 const span=Math.max(maxX-minX,maxY-minY,0.00001)
 return points.map(p=>({...p,x:50+(p.mx-(minX+maxX)/2)/span*74,y:50+(p.my-(minY+maxY)/2)/span*66}))
}
