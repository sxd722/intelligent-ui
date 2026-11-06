import {MAX_TOOL_RESULT_ROWS} from './result-pagination.mjs'
// Reviewed semantic mappings, versioned separately from adapter input schemas.
// No embedding similarity or field-name guessing is used for runtime facts.
export const PRESENTATION_VERSION=1
export const TOOL_VIEW_KINDS={feed:'信息列表',detail:'实体/文章详情',media:'影音与图片',route:'行程票务',places:'地点候选',weather:'天气环境',metrics:'数值指标',receipt:'执行回执'}
import {TOOL_PRESENTATIONS} from './tool-presentation-config.mjs'
import {projectToolRows} from './tool-slots.mjs'
export {TOOL_PRESENTATIONS}

const read=(row,keys)=>{for(const key of [keys].flat()){if(key&&Object.hasOwn(row,key)&&row[key]!=null&&row[key]!=='')return row[key]}return null}
const scalar=v=>typeof v==='string'||typeof v==='number'||typeof v==='boolean'
const text=v=>v==null?null:scalar(v)?String(v):Array.isArray(v)&&v.every(scalar)?v.join(' · '):null
export function presentationFor(tool){return TOOL_PRESENTATIONS[tool]||null}
export function mapToolPresentation(tool,value){
 const mapping=presentationFor(tool)
 const fail=(code,message)=>({ok:false,error:{code,message,tool},fallback:'existing-tool-results'})
 if(!mapping)return fail('VIEW_UNMAPPED','该工具暂未配置展示映射')
 if(!value||!Array.isArray(value.items))return fail('VIEW_SHAPE','工具结果缺少 items 数组')
 if(value.items.length>MAX_TOOL_RESULT_ROWS)return fail('VIEW_LIMIT','结果超过展示映射容量')
 const items=[],projection=projectToolRows(tool,value.items)
 for(const [i,row] of value.items.entries()){
  if(!row||typeof row!=='object'||Array.isArray(row))return fail('VIEW_ROW',`第 ${i+1} 条不是对象`)
  const fields=Object.fromEntries(Object.entries(mapping.fields).map(([k,source])=>[k,read(row,source)]))
  if(!text(fields.title)&&!mapping.allowUntitled)return fail('VIEW_REQUIRED',`第 ${i+1} 条缺少有效标题字段`)
  if(['metrics','weather'].includes(mapping.kind)&&fields.metric!=null&&(typeof fields.metric!=='number'||!Number.isFinite(fields.metric)))return fail('VIEW_NUMBER',`第 ${i+1} 条数值类型与映射契约不符`)
  if(mapping.kind==='route'&&['from','to','departure','arrival'].some(k=>!text(fields[k])))return fail('VIEW_ROUTE',`第 ${i+1} 条行程缺少站点或时间`)
  const projected=projection.ok?projection.items[i]:null
  items.push({...fields,title:text(fields.title)||`结果 ${i+1}`,subtitle:text(fields.subtitle),summary:text(fields.summary),facet:text(fields.facet),time:text(fields.time),key:String(row.rowKey||row.id||projected?.viewKey||`result-${i}`),viewKey:projected?.viewKey||null,entityId:projected?.entityId??null,slots:projected?.$display.fields||[],raw:row})
 }
 return {ok:true,kind:mapping.kind,version:mapping.version,items,metricLabel:mapping.metricLabel,secondaryLabel:mapping.secondaryLabel,source:value.source||tool,fetchedAt:value.fetchedAt||null,partial:value.truncated===true||value.coverage?.complete===false}
}
// Inventory labels only; unmapped commands never inherit a runtime field map.
export function classifyTool(t){
 if(t.readOnly===false)return 'receipt'
 if(presentationFor(t.id))return presentationFor(t.id).kind
 const c=t.columns||[],name=t.command||''
 if(c.includes('field')&&c.includes('value')||/^(subject|book|page|summary|entity|item|video|note|post|series|specs|shop|user)$/.test(name))return 'detail'
 if(t.site==='wttr')return 'weather'
 if(c.includes('start_time')||c.includes('departureTime'))return 'route'
 if(c.includes('latitude')||c.includes('lat')||c.includes('district'))return 'places'
 if(c.includes('changePercent')||c.includes('dimension')||c.includes('metric'))return 'metrics'
 if(['douban','bilibili','youtube','spotify','apple-podcasts','xiaoyuzhou','archive'].includes(t.site))return 'media'
 return 'feed'
}
export const toolViewReference='已映射工具优先用 <tool-view tool="精确工具ID" input={参数对象} style="auto"/>，宿主自动声明只读可见加载、映射字段并提供筛选/选择/详情/刷新/原文；style可选pearl/atlas/field/persona等家族；format可选2x2/2x4/4x4/miniapp，宿主投影字段与视觉主体，完整资料仍可达。已有binding用 <tool-view binding="id"/> 复用，勿重复取数、列表或刷新按钮。onSelect的event.id是本地行键，外部详情优先使用已配置的event.entityId（可能为null），或契约明确的原始业务ID；链接使用原始event.item.url，勿用行键拼接URL。映射失败立即显示具体错误并保留结果，用户可按实际结果重排；不自动调用模型。规划仍可cli_read/web_search，原始返回只作数据。混合模式用独立SVG/Canvas图解绑定选中项或参数，保留原生筛选和操作；动画解释变化，不制造数据。'
