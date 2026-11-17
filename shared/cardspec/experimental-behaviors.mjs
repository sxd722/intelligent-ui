// C1 research-only surface syntax. Disabled callers get byte-identical source.
// This module adds no runtime: all output is ordinary js-v1 CardSpec.
import {inspectCardSource} from './compiler.mjs'

export const BEHAVIOR_REVISION='inspect-return-v1'
export const C1_CONTRACT=`实验行为单元（仅本条件）：可在card根级声明 <behavior id="browse" kind="inspect-return" items={data.records} keyField="id"/>。宿主预展开为现有state/derive/action，没有新运行时。你仍自由写UI：state.browse_selected为字符串实体ID，state.browse_view为list/detail；derived.browse_current为当前完整行或null。onPress="browse_open" args={{id:row.id}}进入详情；onPress="browse_back"返回且保留选择。以state.browse_view切换视图、以derived.browse_current展示详情；不再重复声明这六个ID。keyField须稳定且唯一；缺失/重复ID不能由封装推断。items可为data或binding数组，空/未加载时不允许打开不存在对象。刷新移除对象时current为null，作者展示不可用状态，不自动换选另一实体。无需此机制的任务可不用。只支持js-v1；不改变工具、时钟、布局或业务算法。`

function failure(message,offset=0){return Object.assign(new Error(message),{code:'experimental_behavior',offset})}
const validId=value=>typeof value==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value)
const validKey=value=>typeof value==='string'&&/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(value)&&!['constructor','prototype','__proto__'].includes(value)
const attr=(node,key)=>node.attrs?.[key]?.type==='literal'?node.attrs[key].value:undefined

function expandOne(node,body){
 const id=attr(node,'id'),kind=attr(node,'kind'),field=attr(node,'keyField')??'id'
 if(!validId(id)||id.includes('-'))throw failure('behavior.id must be a JavaScript-safe stable identifier',node.start)
 if(kind!=='inspect-return')throw failure('Only inspect-return is available in C1',node.start)
 if(!validKey(field))throw failure('behavior.keyField must name a safe direct field',node.start)
 if(Object.keys(node.attrs).some(k=>!['id','kind','items','keyField'].includes(k)))throw failure('Unknown behavior attribute',node.start)
 if(!node.closed||node.children.length)throw failure('behavior must be an empty declaration',node.start)
 const span=node.attrSpans.items
 if(!span)throw failure('behavior.items is required',node.start)
 const raw=body.slice(span.start,span.end)
 if(!raw.startsWith('{')||!raw.endsWith('}'))throw failure('behavior.items must be an array expression',node.start)
 const items=raw.slice(1,-1),selected=id+'_selected',view=id+'_view',current=id+'_current',rows=id+'_records',open=id+'_open',back=id+'_back'
 const fieldString=JSON.stringify(field),match=`args.id!=null && derived.${rows}.some(item=>item[${fieldString}]!=null && String(item[${fieldString}])===String(args.id))`
 const source=`<state id="${selected}" type="string" initial=""/>
<state id="${view}" type="string" initial="list"/>
<derive id="${rows}" value={Array.isArray((${items})) ? (${items}) : []}/>
<derive id="${current}" value={derived.${rows}.find(item=>item[${fieldString}]!=null && String(item[${fieldString}])===state.${selected})??null}/>
<action id="${open}"><set target="${selected}" value={String(args.id)} when={${match}}/><set target="${view}" value="detail" when={${match}}/></action>
<action id="${back}"><set target="${view}" value="list"/></action>`
 return {source,id,generatedIds:[selected,view,rows,current,open,back]}
}

export function expandExperimentalBehaviors(source,{enabled=false,dialect='js-v1'}={}){
 source=String(source)
 if(!enabled)return {source,originalSource:source,expandedSource:source,applied:false,revision:null,sourceMap:[],generatedIds:[]}
 if(dialect!=='js-v1')throw failure('C1 inspect-return requires the existing js-v1 dialect')
 const prefix=source.match(/^\s*```(?:xml|html|dil)?\s*\n/i)?.[0]||''
 const suffix=source.match(/\n```\s*$/)?.[0]||''
 const body=source.slice(prefix.length,suffix?source.length-suffix.length:source.length)
 const root=inspectCardSource(body),all=[],macros=[]
 function walk(nodes,parent){for(const node of nodes){all.push(node);if(node.name==='behavior'){if(parent?.name!=='card')throw failure('behavior must be a direct child of card',node.start+prefix.length);macros.push(node)}walk(node.children||[],node)}}
 walk(root.children,root)
 if(!macros.length)return {source,originalSource:source,expandedSource:source,applied:false,revision:BEHAVIOR_REVISION,sourceMap:[],generatedIds:[]}
 const ids=new Set(all.filter(n=>n.name!=='behavior').map(n=>attr(n,'id')).filter(Boolean)),generatedIds=[],expansions=[]
 for(const node of macros){
  const expansion=expandOne(node,body)
  for(const id of expansion.generatedIds){if(ids.has(id))throw failure('behavior generated ID collision: '+id,node.start+prefix.length);ids.add(id);generatedIds.push(id)}
  expansions.push({node,...expansion})
 }
 let cursor=0,out=prefix;const sourceMap=[]
 for(const e of expansions.sort((a,b)=>a.node.start-b.node.start)){
  out+=body.slice(cursor,e.node.start)
  const start=out.length;out+=e.source
  sourceMap.push({behaviorId:e.id,kind:'inspect-return',originalStart:e.node.start+prefix.length,originalEnd:e.node.end+prefix.length,expandedStart:start,expandedEnd:out.length,generatedIds:e.generatedIds})
  cursor=e.node.end
 }
 out+=body.slice(cursor)+suffix
 return {source:out,originalSource:source,expandedSource:out,applied:true,revision:BEHAVIOR_REVISION,sourceMap,generatedIds}
}

export function mapExpansionOffset(offset,expansion){
 let delta=0
 for(const span of expansion.sourceMap||[]){
  if(offset<span.expandedStart)break
  if(offset<span.expandedEnd)return {offset:span.originalStart,behaviorId:span.behaviorId,generated:true}
  delta+=(span.expandedEnd-span.expandedStart)-(span.originalEnd-span.originalStart)
 }
 return {offset:offset-delta,generated:false}
}
