// Audited semantic profiles. Presentation and enrichment share these contracts.
// Other tools keep their existing native view; no guessed IDs or fuzzy joins.
export const DECISION_PROFILES={
 'opencli.douban.movie-hot':{kind:'poster',entity:'id',enrich:true,fields:['genres','duration','summary','assetRef']},
 'opencli.douban.top250':{kind:'poster',entity:'id',enrich:true,fields:['genres','duration','summary','assetRef']},
 'opencli.12306.trains':{kind:'tickets',entity:'train_no',enrich:false,officialUrl:'https://www.12306.cn/index/',fields:['start_time','arrive_time','second_seat']},
};
export const decisionProfile=tool=>DECISION_PROFILES[tool]||null;
// Only deduplicate an identical literal link owned by an unconditional native view.
// Conditional, custom-action and parameterized links keep their original semantics.
export function projectDecisionActions(nodes,bindings={}){
  const urls=new Set(nodes.filter(n=>n.type==='tool-view'&&!n.props.task&&!n.props.onSelect&&(!n.props.presentation||['auto','decision'].includes(n.props.presentation.value))).map(n=>decisionProfile(bindings[n.props.binding?.value]?.tool)?.officialUrl).filter(Boolean));
 return nodes.filter(n=>!(n.type==='link'&&n.props.url?.type==='literal'&&urls.has(n.props.url.value)&&!Object.keys(n.props).some(k=>k.startsWith('on'))));
}
export const decisionBindings=p=>p.bindings?Object.entries(p.bindings).map(([label,binding])=>({label,binding})):[{label:p.task?.pin||p.label||'候选',binding:p.binding}];
export function durationMinutes(value){if(typeof value==='number')return Number.isFinite(value)&&value>0?value:null;const m=typeof value==='string'&&value.match(/^(\d{1,3})(?:\s*(?:分钟|min)|$)/i);return m?Number(m[1]):null}
export const textList=v=>Array.isArray(v)?v.filter(x=>typeof x==='string'):typeof v==='string'?v.split(/\s*[\/、,，]\s*/).filter(Boolean):[];
export function normalizeDecisionRow(tool,row){if(decisionProfile(tool)?.kind!=='poster')return row;return {...row,duration:durationMinutes(row.duration),genres:textList(row.genres),directors:textList(row.directors),casts:textList(row.casts)}}
export function mergeDecisionDetails(tool,row,value){
 const profile=decisionProfile(tool);if(!profile||!Array.isArray(value?.items))throw Error('TASK_DETAIL_SHAPE');
 const actual=value.items.find(x=>String(x[profile.entity])===String(row[profile.entity]));
 if(!actual||(profile.kind==='poster'&&actual.type&&actual.type!=='movie'))throw Error('TASK_DETAIL_ENTITY_MISMATCH');
 // Nulls explicitly supplied by the detail source clear old facts; raw identity stays stable.
 return normalizeDecisionRow(tool,{...row,...actual,rowKey:row.rowKey,[profile.entity]:row[profile.entity]});
}
export function decisionRequest(tool,row,input,kind='facts'){
 const profile=decisionProfile(tool);if(!profile||row[profile.entity]==null)throw Error('TASK_ENTITY_REQUIRED');
 if(profile.kind==='poster'){
  if(!/^\d+$/.test(String(row.id)))throw Error('TASK_ENTITY_INVALID');
  if(kind==='facts')return {tool:'opencli.douban.subject',input:{id:row.id,type:'movie'}};
  if(kind==='media')return {tool:'opencli.douban.photos',input:{id:row.id,type:'Rb',limit:1}};
 }else if(profile.kind==='tickets'&&['facts','stops'].includes(kind)){
  if(['from','to','date'].some(k=>!input[k]))throw Error('TASK_CONTEXT_REQUIRED');
  return {tool:kind==='stops'?'opencli.12306.train':'opencli.12306.price',input:{trainNo:row.train_no,from:input.from,to:input.to,date:input.date}};
 }
 throw Error('TASK_DETAIL_UNAVAILABLE');
}
export const DECISION_REFERENCE='【工具呈现按任务】tool-view presentation="summary"用于了解/探索的当前对象摘要（完整结果按需可达），presentation="collection"用于普通集合，presentation="decision"才是购票/选电影的完整工作台；auto保留旧默认。不能仅凭工具ID把了解任务变成购买任务。需要多工具+素材围绕同一对象，component_describe("task-board")读取compose短契约。decision已适配影音海报、详情/对比/收藏，票务固定/票价/经停/返回；不要重写同套UI。同类多程可bindings={{去程:"out",回程:"back"}}。绑定参数读取宿主state，load="visible"自动更新，不重复查询按钮；样式只改变视觉，不改变语义。';
