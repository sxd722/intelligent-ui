// Host presentation of observed data; no inferred facts or generated URLs.
import {toolMediaSrc} from './tool-media.mjs'
export const fieldLabels={time:'时间',note:'说明',stage:'舞台',category:'类别',cost:'费用',source:'来源',analysisLabel:'样本分类',analysisQuote:'原文依据',title:'标题',name:'名称',rating:'评分',score:'评分',year:'年份',genres:'类型',directors:'导演',casts:'演员',duration:'时长',summary:'简介',content:'内容',description:'说明',brand:'品牌',official_price:'指导价',dealer_price:'经销商价',dimension:'维度',same_level_avg:'同级均值',author:'作者',user:'用户',rank:'排名',likes:'点赞',comments:'评论',country:'地区',fetchedAt:'获取时间'}
Object.assign(fieldLabels,{originalTitle:'原名',ratingCount:'评分人数',type:'条目类型',authors:'作者',translators:'译者',publisher:'出版社',publishDate:'出版日期',publishYear:'出版年份',pageCount:'页数',binding:'装帧',price:'价格',series:'系列'})
Object.assign(fieldLabels,{sub_brand:'厂商',used_price:'二手报价',review_count:'评价数',reviews:'评价数',models:'在售款型',sale_rank:'销量排名',score_rank:'评分排名',pictures:'图片数',dimensions:'车身尺寸',wheelbase:'轴距',power:'动力',engine:'发动机',gearbox:'变速箱',energy:'能源类型',acceleration:'加速时间',drivetrain:'驱动方式',suspension:'悬挂',airbags:'气囊',address:'地址',hours:'营业时间',features:'服务设施',cuisine:'品类',district:'商圈',taste:'口味',environment:'环境',service:'服务',ingredients:'食材',subway:'交通',url:'来源链接'})
const technicalField=k=>/^(?:rowKey|id|.*_id|.*Id|url|.*_url|fetchedAt)$/.test(k)
Object.assign(fieldLabels,{car:'车型',open:'营业状态'})
const imageField=k=>/^(?:cover|poster|image|thumbnail|thumb_url|image_url|assetRef)$/.test(k)
const narrativeField=k=>/^(?:summary|content|description|review|synopsis|introduction|简介|内容|说明|评价)$/.test(k)
const metricFields=['rating','score','price','official_price','dealer_price','duration','review_count','reviews','ratingCount','models','likes','comments']
export const detailLabel=k=>fieldLabels[k]||k.replace(/_/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2')
// A field/value sheet is one entity, not a list of entities. Keep duplicate
// fields as distinct entries, and let explicit detail nulls override list data.
export function detailPresentation(row={},details){
 const items=Array.isArray(details?.items)?details.items.filter(v=>v&&typeof v==='object'&&!Array.isArray(v)):[]
 const pairs=items.length>0&&items.every(v=>typeof v.field==='string'&&Object.hasOwn(v,'value')&&Object.keys(v).every(k=>['field','value','rowKey'].includes(k)))
 if(items.length>1&&!pairs)return {...detailPresentation(row),records:items.map(item=>detailPresentation(item))}
 const detailEntries=pairs?items.map(v=>[v.field,v.value]):items.flatMap(v=>Object.entries(v))
 const supplied=new Set(detailEntries.map(([k])=>k)),entries=[...Object.entries(row).filter(([k])=>!supplied.has(k)),...detailEntries]
 const title=entries.find(([k,v])=>['title','name'].includes(k)&&typeof v==='string'&&v.trim())?.[1]||resultTitle(row)
 const fields=entries.filter(([k])=>!['rowKey','title','name','label'].includes(k)&&!imageField(k)).map(([key,value],index)=>({key,value,id:key+':'+index,label:detailLabel(key)}))
 const technical=fields.filter(f=>technicalField(f.key)),content=fields.filter(f=>!technicalField(f.key))
 const metrics=metricFields.flatMap(k=>content.filter(f=>f.key===k&&['string','number'].includes(typeof f.value)&&String(f.value).length<=50)).slice(0,4)
 const picked=new Set(metrics)
 return {title,metrics,narrative:content.filter(f=>narrativeField(f.key)),facts:content.filter(f=>!picked.has(f)&&!narrativeField(f.key)),technical}
}
export const displayValue=value=>value==null||value===''?'暂无':typeof value==='boolean'?(value?'是':'否'):Array.isArray(value)&&value.every(v=>v==null||typeof v!=='object')?value.filter(v=>v!=null).join('、'):typeof value==='object'?JSON.stringify(value):String(value)
export function safeLink(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null}catch{return null}}
export function resultImages(row){
  const images=[]
  for(const value of [row.thumb_url,row.thumbnail,row.cover,row.poster,row.image_url,row.image]){
    try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password&&['doubanio.com','hdslb.com','steamstatic.com','steamcdn-a.akamaihd.net','mzstatic.com','douyinpic.com','byteimg.com'].some(d=>u.hostname===d||u.hostname.endsWith('.'+d)))images.push(u.href)}catch{}
  }
  return [...new Set(images)]
}
export const resultImage=row=>resultImages(row)[0]||null
export const resultImageSources=row=>resultImages(row).map(toolMediaSrc)
export const resultTitle=row=>String(row.title||row.name||row.label||row.dimension||row.field||row.code||row.user||row.author||row.car||row.id||'条目').slice(0,200)
export const entityKey=(tool,row)=>`${tool.split('.').slice(0,2).join('.')}:${row.series_id||row.subject_id||row.id||row.appId||row.rowKey||row.url||JSON.stringify(row)}`
// Relations are curated host contracts, not shell commands or model URLs.
export function detailRequests(tool,row){
  if(['opencli.douban.top250','opencli.douban.movie-hot','opencli.douban.search'].includes(tool)&&row.id&&row.type!=='music')return [
    {tool:'opencli.douban.subject',input:{id:row.id,type:row.type==='book'?'book':'movie'},kind:'facts'},
    ...(row.type==='book'?[]:[{tool:'opencli.douban.photos',input:{id:row.id,type:'R',limit:1},kind:'media'}]),
  ]
  if(tool==='opencli.dongchedi.search'&&row.series_id)return [{tool:'opencli.dongchedi.series',input:{series_id:row.series_id},kind:'facts'}]
  if(tool==='opencli.dianping.search'&&row.shop_id)return [{tool:'opencli.dianping.shop',input:{shop_id:row.shop_id},kind:'facts'}]
  return []
}
export function resultContext(tool,value){
  const rows=(value?.items||[]).slice(0,3).map(row=>Object.fromEntries(Object.entries(row).slice(0,14).map(([k,v])=>[k,typeof v==='string'?v.slice(0,450):typeof v==='object'&&v!==null?JSON.stringify(v).slice(0,450):v])))
  return {tool,source:value.source,fetchedAt:value.fetchedAt,truncated:!!value.truncated,totalObserved:value.items.length,sampleOnly:value.items.length>rows.length,items:rows}
}
