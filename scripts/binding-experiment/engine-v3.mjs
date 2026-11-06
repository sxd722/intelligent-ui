import {messagesFor as legacyMessages,compile as legacyCompile,transportFor as legacyTransport,autoPrelude,checkInteraction as legacyCheck} from './engine.mjs'
import {CASES,envelope} from './cases.mjs'
import {registryReference} from '../../shared/cardspec/registry.mjs'
import {compileCard} from '../../shared/cardspec/compiler.mjs'
import {projectToolRows} from '../../shared/cardspec/tool-slots.mjs'
export {CASES}
export const ROOT='artifacts/tool-binding-qa/deepseek-v4-flash-20261102-v5'
export const DEST='dist/tool-binding-v3'
export function transportFor(c,arm,map,calls){
 const transport=legacyTransport(c,'A0',map,calls)
 if(arm==='A0')return transport
 return async request=>{
  const result=await transport(request)
  // The provider response envelope remains unchanged. Raw records stay in the
  // host fixture store, not as an invented property of the CLI schema.
  if(request.tool===c.tool){const p=projectToolRows(c.tool,result.value.items);if(!p.ok)throw Error(p.code);return {...result,value:{...result.value,items:p.items}}}
  return {...result,value:envelope([{body:result.value.items.map(x=>Object.values(x).join(' · ')).join('\n')}])}
 }
}
export function compile(c,arm,source){
 if(arm==='A0')return legacyCompile(c,arm,source)
 const prelude=autoPrelude(c).replace('String(r.title ?? "")','(r.title ?? "")').replaceAll('r.id===state.selected.id','r.viewKey===state.selected.viewKey').replaceAll('r.id!==state.selected.id','r.viewKey!==state.selected.viewKey').replaceAll('state.selected.id','state.selected.entityId')
 const expanded=source.trim().replace(/^```[^\n]*\n|\n```$/g,'').replace(/(<card\b[^>]*>)/,(_,open)=>open+prelude)
 return {...compileCard(expanded,{final:true,cardId:'binding-'+c.id+'-'+arm,context:{expressionDialect:'js-v1'}}),expanded}
}
const syntax='\n唯一合法根标签是小写 card，必须以 <card schemaVersion="1" actionMode="snapshot"> 开头、</card> 结束，不是root、CardSpec或React。最小语法示例：<card schemaVersion="1" actionMode="snapshot"><title>标题</title><text>正文</text></card>。属性数值/布尔用{表达式}；文字属性用双引号。只用注册属性，不用padding/style/class。'
export function messagesFor(c,arm){
 if(arm==='A0')return legacyMessages(c,'A0',c.map).map(m=>({...m,content:m.content.replace('和surface="bare"','；surface="bare"只用于支持它的子组件，根card无surface属性')+(m.role==='system'?syntax:'')}))
 if(c.static)return legacyMessages(c,'A0',c.map)
 const parts=['title','caption','text','button','input','collection','row','stack','if','each']
 const contract=c.write?'宿主注入binding feed和action pause。按钮 onPress="pause"，执行回执读取 bindings.feed.value.items[0]?.title；初始显示待命，不自动执行。':`宿主注入state.query（字符串）、state.selected（空对象或完整显示行）、state.chosen（比较行数组）、state.detailOpen；derived.rows是筛选后候选。显示行只有title、summary（已带中文标签单位的完整摘要）、viewKey（选择键）、entityId（真实外部ID，可能null）。collection原样传items={derived.rows}，字段展示由宿主负责，勿写fields/titleKey/subtitleKey。onSelect="select"。input label="筛选" value={state.query} onChange="filter"；按钮onPress="refresh"刷新。选中反馈用state.selected.title和state.selected.summary，不读取原始字段。${c.compare?'按钮label="加入比较" onPress="compare"，未选中用disabled={!state.selected.viewKey}；用each items={state.chosen} as="item" itemKey={item.viewKey}展示每项title与summary。':''}${c.detail?'按钮label="查看详情" onPress="detail" disabled={!state.selected.entityId}。if test={state.detailOpen}中展示bindings.detail.value.items[0]?.body，按钮label="返回" onPress="back"；不要region role=details或另造弹窗，详情就地替换候选区域。':''}`
 return [{role:'system',content:`只输出完整CardSpec。根可选design属性（business、pearl、atlas、default中选一），不要surface。模型只负责UI构图；binding/state/derive/action/data由宿主注入，禁止重复声明。表达式js-v1，事件属性用带引号action ID。每个信息只展示一次；320px下操作可达，候选用宿主collection，details和compare按需展开，勿重复标题。\n${registryReference({compact:true,names:parts})}\n${contract}${syntax}`},{role:'user',content:JSON.stringify({request:c.prompt,requiredLabels:c.write?['暂停']:['筛选','刷新',...(c.detail?['查看详情','返回']:[]),...(c.compare?['加入比较']:[])],sample:c.write?null:projectToolRows(c.tool,c.rows).items.slice(0,2).map(({title,summary,viewKey,entityId})=>({title,summary,viewKey,entityId})),dataMode:'合成受控工具测试，非真实数据'})}]
}
// Same interaction assertions as v2 with only the transport projection changed.
// A generated spec is executed directly; no UI controls are inserted by tests.
export {legacyCheck}
