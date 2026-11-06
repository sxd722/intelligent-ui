import {displaySlots,formatSlot,SLOT_LABELS} from './tool-slots.mjs'
export function collectionRows(items,view,groupBy){return items.filter(r=>(!view.group||String(r[groupBy]??'')===view.group)&&(!view.query||Object.values(r).some(v=>typeof v!=='object'&&String(v??'').toLowerCase().includes(view.query.toLowerCase()))))}
export const collectionTitle=(r,key)=>String(r[key]??r.$display?.title??r.title??r.name??r.label??r.train_code??r.code??r.user??r.author??r.car??r.id??r.rowKey??'条目')
export function collectionPage(length,view,size='auto',capacity){
 if(size==='full')return {pageSize:Math.max(1,length),count:1,page:0,start:0,end:length}
 const pageSize=capacity|| (size==='square'?2:4),count=Math.max(1,Math.ceil(length/pageSize))
 // Persist a row offset, not a size-dependent page number. Old view snapshots
 // used four-row pages; a size change must keep their anchor row reachable.
 const anchor=Number.isFinite(view.pageStart)?Math.max(0,view.pageStart):Math.max(0,(view.page||0)*4)
 const page=Math.min(Math.floor(anchor/pageSize),count-1)
 return {pageSize,count,page,start:page*pageSize,end:(page+1)*pageSize}
}
const hidden=k=>/^(raw|rawRef|viewKey|entityId|\$.*|id|rowKey|title|name|label|assetRef)$/.test(k)
const simple=v=>v!=null&&(['string','number','boolean'].includes(typeof v)||Array.isArray(v)&&v.every(x=>x==null||typeof x!=='object'))
export function collectionFields(items,fields){
 const slots=items.map(displaySlots).find(Boolean)
 if(slots)return slots.map(f=>f.key)
 return (fields?.length?fields:[...new Set(items.flatMap(Object.keys))].filter(k=>!/(url|image|poster|thumbnail|content|description|summary)/i.test(k))).filter(k=>typeof k==='string'&&!hidden(k)&&items.some(r=>Object.hasOwn(r,k)&&simple(r[k]))).slice(0,3)
}
export function collectionFacts(row,fields,labels={}){
 const slots=displaySlots(row)
 if(slots)return slots.map(f=>({key:f.key,label:f.label,text:formatSlot(f),status:f.status}))
 return collectionFields([row],fields).map(key=>({key,label:labels[key]||SLOT_LABELS[key]||key,text:row[key]==null?'未提供':Array.isArray(row[key])?row[key].join('、'):typeof row[key]==='boolean'?(row[key]?'是':'否'):String(row[key])}))
}
export function collectionEvent(row){const id=row.rowKey??row.id;return {id,value:id,item:row,viewKey:row.$display?.viewKey??row.viewKey??id,entityId:row.$display?.entityId??row.entityId??null}}
