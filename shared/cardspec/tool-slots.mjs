import {MAX_TOOL_RESULT_ROWS} from './result-pagination.mjs'
import {durationMinutes} from './decision-profile.mjs'
// Deterministic host projection. Embeddings never decide IDs, units or facts.
import {TOOL_PRESENTATIONS} from './tool-presentation-config.mjs'
const scalar=v=>v===null||['string','number','boolean'].includes(typeof v)
const pathValue=(row,path)=>typeof path==='string'?path.split('.').reduce((v,k)=>v&&Object.hasOwn(v,k)?v[k]:null,row):null
const first=(row,paths)=>{for(const path of [paths].flat()){const value=pathValue(row,path);if(value!==null&&value!==undefined&&value!=='')return {value,path}}return {value:null,path:[paths].flat()[0]}}
const hash=s=>{let h=2166136261;for(const ch of s)h=Math.imul(h^ch.charCodeAt(0),16777619);return (h>>>0).toString(36)}
const canonical=v=>v&&typeof v==='object'?Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v
export const SLOT_LABELS={subtitle:'说明',facet:'类别',metric:'数值',secondary:'补充数值',time:'时间',year:'年份',genres:'类型',rating:'评分',score:'评分',author:'作者',play:'播放量',date:'日期',description:'天气',tempC:'气温',feelsLikeC:'体感',avgTempC:'平均温度',minTempC:'最低温度',maxTempC:'最高温度',start_time:'出发',arrive_time:'到达',second_seat:'二等座',cuisine:'类型',district:'区域',price:'价格',status:'状态',same_level_avg:'同级均值',likes:'点赞',departure:'出发',arrival:'到达',from:'出发地',to:'目的地'}
const f=(path,label,type='text',unit='')=>({key:path,path,label,type,unit})
export const TOOL_SLOT_OVERRIDES={
 'opencli.jd.search':{entity:'sku',title:'title',fields:[f('price','价格','number','元'),f('shop','店铺')]},
 'opencli.ctrip.hotel-search':{entity:'hotelId',title:'name',fields:[f('price','每晚','number','元'),f('score','评分','number'),f('district','区域')]},
 'opencli.douban.top250':{entity:'id',title:'title',fields:[f('year','年份'),f('rating','评分','number'),f('genres','类型','tags'),{...f('duration','片长','number','分钟'),normalize:'duration-minutes'}]},
 'opencli.douban.movie-hot':{entity:'id',title:'title',fields:[f('rating','评分','number'),f('genres','类型','tags'),{...f('duration','片长','number','分钟'),normalize:'duration-minutes'}]},
 'opencli.wttr.forecast':{entity:null,title:'date',fields:[f('description','天气'),f('avgTempC','平均温度','number','°C'),f('minTempC','最低温度','number','°C'),f('maxTempC','最高温度','number','°C')]},
 'opencli.wttr.current':{entity:null,title:'location',fields:[f('description','天气'),f('tempC','气温','number','°C'),f('feelsLikeC','体感','number','°C')]},
 'opencli.12306.trains':{entity:'train_no',title:'code',fields:[f('start_time','出发'),f('arrive_time','到达'),f('second_seat','二等座')]},
 'opencli.dianping.search':{entity:'shop_id',title:'name',fields:[f('district','区域'),f('rating','评分','number'),f('price','人均','number','元'),f('cuisine','类型')]},
 'opencli.dongchedi.score':{entity:null,title:'dimension',fields:[f('score','评分','number'),f('same_level_avg','同级均值','number')]},
 'opencli.bilibili.search':{entity:'bvid',title:'title',fields:[f('author','作者'),f('play','播放量','number','次')]},
 'opencli.spotify.pause':{entity:null,title:'status',fields:[f('status','状态')]}
}
export function slotContract(tool){
 if(Object.hasOwn(TOOL_SLOT_OVERRIDES,tool))return TOOL_SLOT_OVERRIDES[tool]
 const m=Object.hasOwn(TOOL_PRESENTATIONS,tool)?TOOL_PRESENTATIONS[tool]:null;if(!m)return null
 return {entity:null,title:m.fields.title,fields:Object.entries(m.fields).filter(([key])=>!['title','url','lat','lon','summary'].includes(key)).map(([key,path])=>({key,path,label:key==='metric'?m.metricLabel||SLOT_LABELS.metric:key==='secondary'?m.secondaryLabel||SLOT_LABELS.secondary:SLOT_LABELS[path]||SLOT_LABELS[key]||key,type:'scalar',unit:''}))}
}
export function formatSlot(field){
 if(field.status==='invalid')return '格式待核对'
 if(field.value==null)return '未提供'
 const value=Array.isArray(field.value)?field.value.join(' · '):typeof field.value==='boolean'?(field.value?'是':'否'):String(field.value)
 return value+(field.unit||'')
}
export function projectToolRows(tool,rows,contract=slotContract(tool)){
 if(!contract||!contract.title||!Array.isArray(contract.fields))return {ok:false,code:'SLOTS_UNMAPPED',items:[],records:{}}
 if(!Array.isArray(rows)||rows.length>MAX_TOOL_RESULT_ROWS)return {ok:false,code:'SLOTS_SHAPE',items:[],records:{}}
 const items=[],records=Object.create(null),diagnostics=[],seen=new Map()
 for(const [index,raw]of rows.entries()){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {ok:false,code:'SLOTS_ROW',items:[],records:{}}
  const title=first(raw,contract.title).value
  if(!['string','number'].includes(typeof title))return {ok:false,code:'SLOTS_TITLE',items:[],records:{}}
  const identity=contract.entity?first(raw,contract.entity).value:null
  if(identity!=null&&!['string','number'].includes(typeof identity))return {ok:false,code:'SLOTS_ID',items:[],records:{}}
  // viewKey remains distinct from entityId, including duplicate business entities.
  const base=hash(tool+'|'+(raw.rowKey??identity??JSON.stringify(canonical(raw)))),occurrence=seen.get(base)||0
  seen.set(base,occurrence+1)
  const viewKey=`v:${base}:${occurrence}`,rawRef=`r:${viewKey}`
  records[rawRef]=raw
  const fields=contract.fields.map(field=>{
   const source=first(raw,field.path),path=source.path,value=field.normalize==='duration-minutes'?durationMinutes(source.value):source.value;let valid=(field.type==='tags'?value==null||Array.isArray(value)&&value.every(x=>typeof x==='string'):scalar(value))&&!(typeof value==='number'&&!Number.isFinite(value))
   if(field.type==='number'&&value!=null)valid=typeof value==='number'&&Number.isFinite(value)
   if(!valid)diagnostics.push({code:'SLOT_TYPE',row:index,field:field.key,path})
   return {key:field.key,label:field.label,unit:field.unit||'',type:field.type||'scalar',value:valid?value:null,sourcePath:path,status:!valid?'invalid':value==null?'missing':'present'}
  })
  items.push({id:identity,entityId:identity,viewKey,rowKey:viewKey,rawRef,title:String(title),summary:fields.filter(x=>x.value!=null).map(x=>`${x.label}：${formatSlot(x)}`).join(' · '),...(typeof raw.assetRef==='string'?{assetRef:raw.assetRef}:{}),$display:{version:1,tool,title:String(title),viewKey,entityId:identity,fields}})
 }
 return {ok:true,items,records,diagnostics}
}
export function displaySlots(row){return row?.$display?.version===1&&Array.isArray(row.$display.fields)?row.$display.fields.filter(f=>typeof f.key==='string'&&typeof f.label==='string'&&(scalar(f.value)||f.type==='tags'&&Array.isArray(f.value)&&f.value.every(x=>typeof x==='string'))):null}
export function decorateToolRows(tool,rows){
 const projection=projectToolRows(tool,rows)
 return projection.ok?rows.map((row,i)=>row.$display?.version===1&&row.$display?.tool===tool?row:{...row,$display:projection.items[i].$display}):rows
}
export function resolveSlotEntity(projection,row){
 const raw=projection.records?.[row?.rawRef]
 if(!raw||!projection.items.some(x=>x.rawRef===row.rawRef&&x.viewKey===row.viewKey&&x.entityId===row.entityId))throw Error('SLOT_STALE_SELECTION')
 return {raw,entityId:row.entityId,viewKey:row.viewKey}
}
