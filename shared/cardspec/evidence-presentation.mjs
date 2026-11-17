import {isoDay} from './task-evidence.mjs'

// Derive affordances from observed fields, not the requested UI or model promises.
export function evidencePresentation(value={}){
 const rows=Array.isArray(value?.items)?value.items:[],n=rows.length
 const count=predicate=>rows.filter(predicate).length
 const present=v=>v!==null&&v!==undefined&&v!==''
 const keys=[...new Set(rows.flatMap(r=>Object.keys(r||{})))].filter(k=>!['__proto__','constructor','prototype'].includes(k))
 const numeric=keys.filter(k=>!/^(id|rank|.*_id|.*Id|lat|lng|lon|latitude|longitude)$/i.test(k)&&rows.some(r=>typeof r[k]==='number'&&Number.isFinite(r[k])))
 const dated=count(r=>['publishedAt','published_at','pubDate','date'].some(k=>isoDay(r[k])))
 const geo=count(r=>{const lat=r.lat??r.latitude,lng=r.lng??r.lon??r.longitude;return typeof lat==='number'&&typeof lng==='number'&&Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180})
 const labels=count(r=>present(r.analysisLabel)&&present(r.analysisQuote)),facets=keys.filter(k=>!/id|url|text|title|description|summary|content|quote/i.test(k)&&rows.some(r=>typeof r[k]==='string')&&new Set(rows.map(r=>r[k]).filter(present)).size>=2&&new Set(rows.map(r=>r[k]).filter(present)).size<=12).slice(0,6)
 const candidates=[
  {kind:'candidates',available:n>0,records:n,component:'tool-view / task-board',why:n?'选择→详情/对比共用实体ID':'空结果先展示空态'},
  {kind:'map',available:geo>0,records:geo,component:'map',why:geo?'只标真实坐标；无坐标项仍保留在候选中':'缺坐标，不合成坐标'},
  {kind:'timeline',available:dated>1,records:dated,component:'chart / timeline',why:'仅使用已返回日期，抓取时间不代替事件日期'},
  {kind:'metrics',available:numeric.length>0,fields:numeric.slice(0,6),component:'chart / stat',why:'数量字段不自动等于情感/评分，保持原单位与口径'},
  {kind:'distribution',available:labels>0&&!!value.analysis,records:labels,component:'chart',why:'有引用的分类样本；未知单列；groupCounts(items,"analysisLabel")由宿主计数'}
 ]
 return {total:n,scope:'observed rows, not population',candidates,facets,
  ownership:'优先hostView；原生chart可用groupCounts，选中组展示该组items。不要复制数据、手写分类关键词或重复计数；缺字段用dataset_enrich，不能只改筛选按钮。',
  ...(value.analysis?{classification:{quoted:labels,unknown:n-labels,source:value.analysis.dataset?.id||null,recipe:'groupCounts(数据路径.items,"analysisLabel")'}}:{})}
}
