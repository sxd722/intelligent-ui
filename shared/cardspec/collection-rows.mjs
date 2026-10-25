// Invalid identities get inert placeholders. Never fabricate a key for an
// actionable row, and invalidate BOTH duplicates instead of keeping one.
export function isolateCollectionRows(items,keyOf){
 const rows=items.map((item,index)=>{
  try{const key=keyOf(item,index);if(!['string','number'].includes(typeof key)||typeof key==='number'&&!Number.isFinite(key)||!String(key).trim())throw Error('each requires a nonempty scalar item key');return {item,index,key:String(key)}}
  catch(error){return {item,index,error:String(error.message)}}
 })
 const counts=new Map();for(const r of rows)if(!r.error)counts.set(r.key,(counts.get(r.key)||0)+1)
 return rows.map(r=>!r.error&&counts.get(r.key)>1?{...r,error:'each requires unique item keys; duplicate row is not interactive'}:r)
}
