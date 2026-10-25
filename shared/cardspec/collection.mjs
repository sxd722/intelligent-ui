export function collectionRows(items,view,groupBy){return items.filter(r=>(!view.group||String(r[groupBy]??'')===view.group)&&(!view.query||Object.values(r).some(v=>typeof v!=='object'&&String(v??'').toLowerCase().includes(view.query.toLowerCase()))))}
export const collectionTitle=(r,key)=>String(r[key]??r.title??r.name??r.label??r.train_code??r.code??r.user??r.author??r.car??r.id??r.rowKey??'条目')
export function collectionPage(length,view,size='auto',capacity){
 const pageSize=capacity|| (size==='square'?2:4),count=Math.max(1,Math.ceil(length/pageSize))
 // Persist a row offset, not a size-dependent page number. Old view snapshots
 // used four-row pages; a size change must keep their anchor row reachable.
 const anchor=Number.isFinite(view.pageStart)?Math.max(0,view.pageStart):Math.max(0,(view.page||0)*4)
 const page=Math.min(Math.floor(anchor/pageSize),count-1)
 return {pageSize,count,page,start:page*pageSize,end:(page+1)*pageSize}
}
export function collectionFields(items,fields){return fields?.length?fields:[...new Set(items.flatMap(Object.keys))].filter(k=>!['id','rowKey','title','name','label','assetRef'].includes(k)&&!/(url|image|poster|thumbnail|content|description|summary)/i.test(k)).slice(0,3)}
