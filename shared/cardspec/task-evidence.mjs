// Conservative, effect-free coverage. Date fields are observed metadata, not
// verified event dates; an acquisition timestamp can never satisfy a period.
export function isoDay(value){
 if(typeof value!=='string')return null
 const m=value.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T| )/)
 if(!m){
  // RSS commonly uses RFC 2822. Require an explicit year and zone; never let
  // Date.parse interpret an absent date, relative label or locale ambiguity.
  if(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) 20\d{2} \d{2}:\d{2}:\d{2} (?:GMT|UTC|[+-]\d{4})$/.test(value)){const d=new Date(value);return Number.isFinite(+d)?d.toISOString().slice(0,10):null}
  return null
 }
 const s=m.slice(1).join('-'),d=new Date(s+'T12:00:00Z')
 return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s?s:null
}
export function requestedPeriod(goal='',input={}){
 const direct=isoDay(input.date);if(direct)return {start:direct,end:direct,origin:'input.date'}
 // Only explicit unambiguous calendar periods, never infer "latest" or parse
 // unrelated numbers, durations, relative dates or a year alone.
 const matches=[...String(goal).matchAll(/\b(20\d{2})[年.\/-](0?[1-9]|1[0-2])(?:月|(?=[^\d]|$))/g)]
 const periods=[...new Set(matches.map(m=>`${m[1]}-${m[2].padStart(2,'0')}`))]
 if(periods.length!==1)return null
 const month=periods[0],end=new Date(Date.UTC(+month.slice(0,4),+month.slice(5),0)).toISOString().slice(0,10)
 return {start:month+'-01',end,origin:'explicit-month'}
}
export function auditResultCoverage({goal='',input={},value={},tool='',dateField}={}){
 const rows=Array.isArray(value?.items)?value.items:[],requested=requestedPeriod(goal,input)
 const keys=dateField?[dateField]:['publishedAt','published_at','pubDate','date','datetime']
 const observed=rows.map((row,i)=>{const field=keys.find(k=>isoDay(row?.[k]));return {id:String(row?.rowKey??row?.id??i),field,date:field?isoDay(row[field]):null}})
 const dated=observed.filter(x=>x.date),days=dated.map(x=>x.date).sort(),unknown=rows.length-dated.length
 const inside=requested?dated.filter(x=>x.date>=requested.start&&x.date<=requested.end):dated
 const outside=requested?dated.filter(x=>x.date<requested.start||x.date>requested.end):[]
 const status=!requested?'unconstrained':!rows.length?'empty':!dated.length?'unknown':!inside.length?'mismatch':outside.length||unknown||value.truncated?'partial':'covered'
 return {status,requested,observed:{total:rows.length,dated:dated.length,unknown,within:inside.length,outside:outside.length,start:days[0]||null,end:days.at(-1)||null,fields:[...new Set(dated.map(x=>x.field))]},truncated:!!value?.truncated,tool,fetchedAt:value?.fetchedAt||null,
  ...(status==='mismatch'?{message:`结果日期 ${days[0]}–${days.at(-1)} 未覆盖 ${requested.start}–${requested.end}；当前仅能作为历史资料，不能称本期结果。`}:{}),
  scope:'Returned date metadata only; not article/event verification or proof of complete source coverage.'}
}
export function coverageDiagnostics(spec,records=[]){
 const goal=spec?.context?.userGoal||'',issues=[]
 for(const record of records){
  if(!record?.value?.items)continue
  const audit=auditResultCoverage({goal,...record})
  if(audit.status==='mismatch')issues.push({severity:'warning',code:'task_period_mismatch',message:`${record.id||record.tool}: ${audit.message} Adjust a supported query or retain historical results with the host coverage notice; do not invent dates.`,evidence:audit})
 }
 return issues.slice(0,4)
}

// Host-owned immutable operations shared by both expression dialects. No eval,
// arbitrary callbacks, mutation or network access.
const rows=v=>{if(!Array.isArray(v)||v.length>1000)throw Error('task operation expects at most 1000 rows');return v}
const field=k=>{if(typeof k!=='string'||!k||['__proto__','prototype','constructor'].includes(k))throw Error('invalid task field');return k}
export const TASK_HELPERS={
 orderBy(items,key,direction='asc'){
  field(key);if(!['asc','desc'].includes(direction))throw Error('orderBy direction must be asc/desc')
  return rows(items).map((value,i)=>({value,i})).sort((a,b)=>{const x=a.value?.[key],y=b.value?.[key];if(x==null||y==null)return x==null&&y==null?a.i-b.i:x==null?1:-1;return (x<y?-1:x>y?1:0)*(direction==='desc'?-1:1)||a.i-b.i}).map(x=>x.value)
 },
 groupCounts(items,key){
  field(key);const groups=new Map()
  for(const row of rows(items)){const value=row?.[key],k=value==null||value===''?null:value;if(k!==null&&!['string','number','boolean'].includes(typeof k))throw Error('groupCounts needs a scalar field');if(!groups.has(k))groups.set(k,{id:k,label:k===null?'未知':String(k),value:0,items:[]});const g=groups.get(k);g.value++;g.items.push(row)}
  return [...groups.values()]
 },
 replaceBy(items,key,replacement){
  field(key);if(!replacement||typeof replacement!=='object'||Array.isArray(replacement)||replacement[key]==null)throw Error('replaceBy needs a complete replacement with stable key')
  const list=rows(items);if(list.filter(x=>x?.[key]===replacement[key]).length!==1)throw Error('replaceBy requires exactly one matching entity')
  return list.map(row=>row?.[key]===replacement[key]?replacement:row)
 },
 addMinutes(time,amount){
  if(typeof time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||!Number.isFinite(amount))return null
  const n=+time.slice(0,2)*60+ +time.slice(3)+amount
  // Never silently wrap to yesterday/tomorrow. Cross-day tasks use ISO dates.
  if(n<0||n>=1440||!Number.isInteger(n))return null
  return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`
 },
 minutesBetween(start,end){
  if([start,end].some(t=>typeof t!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))return null
  return (+end.slice(0,2)*60+ +end.slice(3))-(+start.slice(0,2)*60+ +start.slice(3))
 }
}
export const TASK_OPERATION_REFERENCE='宿主纯函数：orderBy(rows,"date","desc")稳定排序(空值末尾)；groupCounts(rows,"type")→[{id,label,value,items}]含未知组，图表点组后用该组items展示记录；replaceBy(rows,"id",完整新对象)整条替换，不残留旧实体字段；addMinutes("06:00",30)、minutesBetween("06:00","07:00")为同日时间，跨日用日期。参数变化须重算、查询或标过期，不能只改标题/输入回显；JS的sort/toSorted返回副本，可用纯比较回调；详情要新增信息，只有索引就称来源/原文。选择器紧邻结果，设置可折叠。'
