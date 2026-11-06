// Explicit static content uses the same host view as live tools; no source/score inference.
export function staticBoard(items=[],label='内容'){
 if(!Array.isArray(items)||items.length>100)throw Error('task-board.items requires at most 100 records')
 const ids=new Set(),rows=items.map((r,n)=>{
  if(!r||typeof r!=='object'||typeof r.title!=='string')throw Error('task-board.items needs title')
  const id=String(r.id??n);if(ids.has(id))throw Error('task-board.items ids must be unique');ids.add(id)
  return {id,entityId:id,title:r.title,summary:String(r.summary||''),detail:String(r.detail||''),category:String(r.category||''),author:String(r.category||''),source:'static',kind:'entity',url:typeof r.url==='string'&&/^https?:\/\//.test(r.url)?r.url:'',imageQuery:typeof r.imageQuery==='string'&&r.imageQuery.length<=100?r.imageQuery:null,mockTile:Number.isInteger(r.mockTile)&&r.mockTile>=0&&r.mockTile<6?r.mockTile:null,assetRef:typeof r.assetRef==='string'?r.assetRef:null,metrics:(r.metrics||[]).filter(m=>m&&typeof m.value==='number'&&Number.isFinite(m.value)).map(m=>({key:String(m.label),label:String(m.label),value:m.value,unit:String(m.unit||'')})),provenance:[],publishedAt:null}
 })
 return {version:1,mode:'entity',scope:JSON.stringify(['static',label,rows.map(r=>r.id)]),items:rows,related:[],observations:[],mapItems:[],dates:[],issues:[],statuses:[],counts:{bySource:[]},loading:false,partial:false}
}
