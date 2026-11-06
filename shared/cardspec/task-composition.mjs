// Pure, source-aware projection shared by native UI and sandbox inputs.
// No tool execution, inferred sentiment, ID matching or coordinate conversion.
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v
export const compositionKey=v=>JSON.stringify(canonical(v))
const text=v=>typeof v==='string'?v:typeof v==='number'?String(v):''
const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null
const field=(r,names)=>names.map(k=>r[k]).find(v=>v!==undefined&&v!==null)
const url=v=>{try{const u=new URL(v);if(!['https:','http:'].includes(u.protocol))return '';u.hash='';return u.href}catch{return ''}}
const metric=(r,key,label,unit='')=>({key,label,value:number(r[key]),unit})
export const COMPOSITION_ADAPTERS={
 'opencli.bilibili.search':{kind:'content',id:['bvid'],title:['title'],body:['description'],metrics:[['play','播放','次']]},
 'opencli.xiaohongshu.search':{kind:'content',id:['note_id','id'],title:['title'],body:['desc','description'],metrics:[['likes','点赞','次']]},
 'opencli.hackernews.top':{kind:'content',id:['id'],title:['title'],body:[],metrics:[['score','积分','']]},
 'opencli.hackernews.search':{kind:'content',id:['id'],title:['title'],body:[],metrics:[['score','积分','']]},
 'hackernews.top':{kind:'content',id:['id'],title:['title'],body:[],metrics:[['score','积分','']]},
 'opencli.ctrip.search':{kind:'place',id:['id'],title:['name'],body:['address'],metrics:[['score','评分','']]},
 'opencli.dianping.search':{kind:'place',id:['shop_id'],title:['name'],body:['address','cuisine'],metrics:[['rating','评分',''],['price','人均','元']]},
 'opencli.wttr.forecast':{kind:'observation',id:['date'],title:['date'],body:['description'],metrics:[['avgTempC','平均温度','°C'],['minTempC','最低温度','°C'],['maxTempC','最高温度','°C']]},
 'opencli.douban.top250':{kind:'entity',id:['id'],title:['title'],body:['description','summary'],metrics:[['rating','评分','']]},
 'opencli.douban.movie-hot':{kind:'entity',id:['id'],title:['title'],body:['description','summary'],metrics:[['rating','评分','']]},
 'opencli.douban.search':{kind:'entity',id:['id'],title:['title','name'],body:['description','summary'],metrics:[['rating','评分','']]},
}
export function compositionCapability(tool){const a=Object.hasOwn(COMPOSITION_ADAPTERS,tool)?COMPOSITION_ADAPTERS[tool]:null;return a?{kind:a.kind,fields:['id','title','summary','source','metrics','url'],usage:'compose({role:"bindingId"}, {primary:"role",selectedId:state.selected}) → task-board 或 sandbox.input；相关搜索不等于实体匹配。'}:null}
function normalize(tool,row,role,record,index,ambiguous=false){
 const a=COMPOSITION_ADAPTERS[tool],link=url(row.url),title=text(field(row,a.title))
 const entityId=ambiguous?null:field(row,a.id)??(tool==='opencli.bilibili.search'&&record.input?.type!=='user'?link.match(/^https:\/\/www\.bilibili\.com\/video\/(BV[\w]+)/)?.[1]:tool==='opencli.xiaohongshu.search'?link.match(/^https:\/\/(?:www\.)?xiaohongshu\.com\/(?:explore|search_result)\/([a-f0-9]{24})(?:[/?#]|$)/i)?.[1]:null)
 if(!title)return null
 const identity=ambiguous?compositionKey({title,url:link,lat:row.lat,lon:row.lon}):entityId!=null?String(entityId):link||compositionKey(row)
 const id=compositionKey([tool,identity])
 const lat=number(field(row,['lat','latitude'])),lon=number(field(row,['lon','longitude','lng']))
 const coordinate=lat!==null&&lon!==null&&Math.abs(lat)<=90&&Math.abs(lon)<=180?{lat,lon,system:row.coordSystem==='WGS84'?'WGS84':row.coordSystem==='GCJ02'?'GCJ02':'unknown'}:null
 return {id,kind:a.kind,role,title,entityId:entityId==null?null:String(entityId),summary:text(field(row,a.body)),url:link,
  source:tool,author:text(row.author),publishedAt:text(row.published_at||row.date),year:row.year??null,coordinate,
  assetRef:typeof row.assetRef==='string'?row.assetRef:null,
  metrics:tool==='opencli.bilibili.search'&&row.score!==undefined?[metric(row,'score',record.input?.type==='user'?'粉丝':'播放',record.input?.type==='user'?'人':'次')]:a.metrics.map(([key,label,unit])=>metric(tool==='opencli.xiaohongshu.search'&&key==='likes'&&typeof row.likes==='string'&&/^\d+$/.test(row.likes)&&Number.isSafeInteger(Number(row.likes))?{...row,likes:Number(row.likes)}:row,key,label,unit)),
  provenance:[{tool,binding:record.bindingId||role,input:record.input||{},fetchedAt:record.value?.fetchedAt||record.updatedAt||null,row:index,entityId:entityId==null?null:String(entityId)}]}
}
export function composeTask(sources={},options={},bindings={}){
 if(!sources||typeof sources!=='object'||Array.isArray(sources)||Object.keys(sources).length>8)throw Error('COMPOSITION: use at most eight named bindings')
 const sourceBindings=Object.fromEntries(Object.entries(sources).filter(([,v])=>typeof v==='string'))
 sources=Object.fromEntries(Object.entries(sources).map(([role,value])=>{if(typeof value!=='string')return [role,value];if(!Object.hasOwn(bindings,value))throw Error('COMPOSITION: unknown binding '+value);return [role,bindings[value]]}))
 if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!['primary','selectedId','date','source','query'].includes(k)))throw Error('COMPOSITION: unknown option')
 if(options.primary&&!Object.hasOwn(sources,options.primary))throw Error('COMPOSITION: primary must name a source role')
 const roles={},issues=[],statuses=[],unique=new Map(),duplicates=[]
 for(const [role,record]of Object.entries(sources)){
  if(['__proto__','constructor','prototype'].includes(role))throw Error('COMPOSITION: invalid role')
  roles[role]=[]
  if(Array.isArray(record))throw Error('COMPOSITION: pass bindings.id, not bindings.id.value.items')
  if(!record||!Object.hasOwn(COMPOSITION_ADAPTERS,record.tool)){issues.push({role,code:'UNMAPPED_SOURCE',message:'该来源尚无语义映射，可使用原 binding 自由编排。'});statuses.push({role,status:'unmapped'});continue}
  const state=record.status||'idle',current=record.current!==false
  statuses.push({role,tool:record.tool,status:current?state:'stale',updatedAt:record.updatedAt||null})
  if(state==='error'||state==='cancelled')issues.push({role,code:'SOURCE_ERROR',message:String(record.error||'来源读取失败').slice(0,240)})
  if(!current){issues.push({role,code:'STALE_INPUT',message:'参数已变化，旧结果暂不参与组合。'});continue}
  const rows=record.value?.items;if(!Array.isArray(rows)){if(state==='success')issues.push({role,code:'INVALID_RESPONSE',message:'来源返回结构不匹配，可使用原 binding 自由编排。'});continue}
  if(rows.length>500){issues.push({role,code:'SOURCE_LIMIT',message:'来源超过500条，请分页取数。'});continue}
  if(record.value.truncated||record.value.coverage?.complete===false)issues.push({role,code:'PARTIAL_SOURCE',message:'仅包含已获取样本。'})
  const identities=new Map(),adapter=COMPOSITION_ADAPTERS[record.tool]
  for(const row of rows){if(!row||typeof row!=='object')continue;const id=field(row,adapter.id);if(id==null)continue;const key=String(id),sign=compositionKey({title:field(row,adapter.title),url:url(row.url),lat:row.lat,lon:row.lon});if(!identities.has(key))identities.set(key,new Set());identities.get(key).add(sign)}
  const ambiguous=new Set([...identities].filter(([,v])=>v.size>1).map(([k])=>k))
  if(ambiguous.size)issues.push({role,code:'AMBIGUOUS_ENTITY_ID',message:'来源重复ID对应不同内容，已分开保留；这些记录不能使用该ID自动关联详情。'})
  for(const [index,row]of rows.entries()){
   if(!row||typeof row!=='object'||Array.isArray(row)){issues.push({role,code:'INVALID_ROW',message:'非对象记录已隔离。'});continue}
   const item=normalize(record.tool,row,role,record,index,ambiguous.has(String(field(row,adapter.id))))
   if(!item){issues.push({role,code:'MISSING_TITLE',message:'无可用标题的记录已隔离。'});continue}
   // Only exact source identity / canonical URL deduplication. Never title similarity.
   const canonicalUrl=record.tool==='opencli.xiaohongshu.search'&&/^[a-f0-9]{24}$/i.test(item.entityId||'')&&/^https:\/\/(?:www\.)?xiaohongshu\.com\//i.test(item.url)?'https://www.xiaohongshu.com/explore/'+item.entityId:item.url
   const dedupeKey=item.kind==='content'&&canonicalUrl?'content:'+canonicalUrl:item.id
   const prior=unique.get(dedupeKey)
   if(prior){prior.provenance.push(...item.provenance);duplicates.push({id:prior.id,role});roles[role].push(prior);continue}
   unique.set(dedupeKey,item);roles[role].push(item)
  }
  roles[role]=[...new Map(roles[role].map(i=>[i.id,i])).values()]
 }
 const all=[...unique.values()],primary=options.primary||Object.keys(sources)[0]||'',candidates=roles[primary]||[]
 const primaryKinds=new Set(candidates.map(i=>i.kind))
 const mode=primaryKinds.has('place')?'map':primaryKinds.has('entity')?'entity':'feed'
 const mergeable=mode==='feed'?all.filter(i=>i.kind==='content'):candidates
 const focus=mergeable.find(i=>i.id===options.selectedId)||null
 const items=mergeable.filter(i=>(!options.source||i.provenance.some(p=>p.tool===options.source))&&(!options.query||[i.title,i.summary,i.author].join(' ').toLocaleLowerCase().includes(String(options.query).toLocaleLowerCase())))
 const related=focus&&mode!=='feed'?all.filter(i=>i.role!==primary&&i.kind!=='observation').map(i=>({...i,relation:'related-search',subjectId:focus.id})):[]
 const observations=all.filter(i=>i.kind==='observation'&&(!options.date||i.title===options.date))
 const mapItems=[...candidates,...related.filter(i=>i.kind==='place')].filter(i=>i.coordinate?.system==='WGS84').map(i=>({id:i.id,title:i.title,lat:i.coordinate.lat,lon:i.coordinate.lon,role:i.role}))
 const unlocated=[...candidates,...related.filter(i=>i.kind==='place')].filter(i=>i.kind==='place'&&i.coordinate?.system!=='WGS84').map(i=>i.id)
 const scope=compositionKey(Object.fromEntries(Object.entries(sources).filter(([r])=>r===primary||mode==='feed').map(([r,b])=>[r,{tool:b?.tool,input:b?.input}])) )
 return {version:1,mode,primary,scope,sourceBindings,viewFilter:!!(options.query||options.source||options.selectedId||options.date),items,roles,focus,related,observations,dates:[...new Set(all.filter(i=>i.kind==='observation').map(i=>i.title))],mapItems,unlocated,issues,statuses,
  counts:{fetched:all.length,visible:items.length,duplicates:duplicates.length,bySource:Object.entries(sources).map(([role,r])=>({role,source:r?.tool||'',count:roles[role]?.length||0}))},
  partial:issues.length>0,loading:statuses.some(s=>s.status==='loading'),date:options.date||null}
}
export function projectTaskView(view,size='full'){
 if(!view||view.version!==1)throw Error('COMPOSITION: expected a task view')
 if(!['2x2','2x4','4x4','full'].includes(size))throw Error('COMPOSITION: invalid size')
 if(size==='full')return {...view,size,remaining:0}
 const max=size==='2x2'?1:size==='2x4'?2:4
 const project=item=>({...item,summary:size==='2x2'?'':item.summary,metrics:item.metrics.filter(m=>m.value!==null).slice(0,size==='2x2'?1:3)})
 return {...view,size,items:view.items.slice(0,max).map(project),focus:view.focus?project(view.focus):null,observations:view.observations.slice(0,size==='2x2'?1:3).map(project),remaining:Math.max(0,view.items.length-max)}
}
export const COMPOSITION_REFERENCE=`多来源任务只引用binding的id：<derive id="v" value={compose({main:"a",related:"b"},{primary:"main",selectedId:state.selected})}/><task-board view={derived.v} onSelect="pick"/>。a/b必须是已声明binding id，宿主自动读取状态和数据；不要写value/items。task-board自带筛选、候选、关联详情、多选对比及返回，不接受子节点。layout可选auto/map/decision/detail/evidence/compare/plan；只改变构图，不代替取数或分析。需要确认选择时加onApply，事件为event.items/ids/date；规划动作显式invoke生成或用真实计算，不能只更新提示。
<state id="selected" type="string" initial=""/><action id="pick"><set target="selected" value={event.id}/></action>；target是state的id，不加state.。交互分两种：内容合并的pick只set，不invoke或重新搜索。只有任务明确要求选中实体后补充查询时，才增加state q，相关binding input={{query:state.q}} load="manual"；pick中追加<set target="q" value={event.item.title}/><invoke binding="b" input={{query:next.q}}/>，query替换为工具实际参数名。内容合并时不需要额外搜索。同语义内容合并；异构数据按角色保留；related仅相关搜索，不代表实体匹配。天气可compose选项date:state.date，task-board onDateChange事件为event.date。同一derived.v可传sandbox.input，经actions调用同一pick。未知工具继续原binding自由编排；普通点击不另调模型。`
