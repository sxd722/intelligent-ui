import {expressionReads} from './dataflow.mjs'
// Small, native presentation recipes; data and actions keep the v1 contract.
export function editorialConnections(spec,nodes=[]){
 const linked=new Set(),selectors=new Set(['segmented','select','radio-group','chips'])
 for(let i=0;i<nodes.length-1;i++){
  const n=nodes[i],next=nodes[i+1];if(!selectors.has(n.type))continue
  const state=expressionReads(spec,n.props?.value,'state')
  if(state.length&&expressionReads(spec,[next.props,next.children],'state').some(id=>state.includes(id)))linked.add(n.id)
 }
 return linked
}
export function editorialPages(items,limit,gap=0){
 const units=[]
 for(let i=0;i<items.length;i++){
  if(!items[i].height)continue
  const unit=[items[i]];while(unit.at(-1).keepNext&&i+1<items.length)unit.push(items[++i]);units.push(unit)
 }
 const pages=[];let page=[],used=0
 for(const unit of units){const height=unit.reduce((n,x)=>n+x.height,0)+Math.max(0,unit.length-1)*gap
  if(page.length&&used+gap+height>limit+1/64){pages.push(page);page=[];used=0}
  used+=height+(page.length?gap:0);page.push(...unit.map(x=>x.id))
 }
 if(page.length)pages.push(page);return pages.length?pages:[[]]
}
export const EXPRESSION_DESIGN='【表达骨架】实现前在本轮确定：用户要做的判断/任务、2–4个不同职责的内容区、选择带来的结果、首屏与展开边界。不另写规划JSON，不增加调用。关系用图，选择用并排对照，准备/记录用分组清单，短事实共享一行；不要所有区块都套summary长段落。选中后至少一个有用结果随之改变，详情补充新信息；纯阅读无需强造操作。180–260字只是首屏目标，不是总知识上限。先使用原生组合，特殊插画/动画才用局部sandbox。'
export function editorialRecipe(goal=''){
 const compare=/比较|选择|推荐|交通|方案|compare|choice|decision/i.test(goal),prepare=/准备|清单|勾选|记录|检查|观察|checklist|prepare|record|observe/i.test(goal),chapter=/阶段|章节|学习|原理|攻略|知识|阅读|chapter|learn|guide/i.test(goal)
 return {version:1,patterns:[...(compare?['compare']:[]),...(prepare?['prepare']:[]),...(chapter?['chapters']:[])],names:[...((compare||chapter)?['segmented']:[]),...((compare||prepare||chapter)?['facts','region']:[]),...(prepare?['checklist']:[])],hint:[compare?'比较：segmented variant="cards"，options附description；event.value改变正文/图/建议。':'',prepare?'准备：checklist items={...} value={state.done} onChange="check"，set done={event.value}；宿主分组和计算当前清单进度。':'',chapter?'章节：segmented variant="chapters"；facts呈现短事实；region overflow="inline"就地展开补充内容。':''].filter(Boolean).join(' ')}
}
export function checklistChange(items,value,id,checked){
 const ids=new Set(value||[])
 if(!items.some(x=>x.id===id))return [...ids]
 checked?ids.add(id):ids.delete(id)
 return [...ids]
}
export function checklistProgress(items,value=[]){const chosen=new Set(value);return {done:items.filter(x=>chosen.has(x.id)).length,total:items.length}}
export function factChanges(items){
 const changes=items.filter(x=>Object.hasOwn(x,'before')&&Object.hasOwn(x,'after'))
 return {changes,changed:changes.filter(x=>!Object.is(x.before,x.after)),unchanged:changes.filter(x=>Object.is(x.before,x.after)).length,ordinary:items.filter(x=>!changes.includes(x))}
}
export function validateEditorial(type,p){
 if(type==='facts'){
  if(!Array.isArray(p.items)||p.items.length>12||p.items.some(x=>!x||typeof x.label!=='string'||['value','before','after'].some(k=>x[k]!=null&&(!['string','number','boolean'].includes(typeof x[k])||typeof x[k]==='number'&&!Number.isFinite(x[k])))||Object.hasOwn(x,'before')!==Object.hasOwn(x,'after')||(x.unit!=null&&typeof x.unit!=='string')))throw Error('facts.items: up to 12 {label,value,unit?} or {label,before,after,unit?}; values must be scalar')
 }
 if(type==='checklist'){
  if(!Array.isArray(p.items)||p.items.length>100||p.items.some(x=>!x||typeof x.id!=='string'||!x.id||typeof x.label!=='string'||['group','description'].some(k=>x[k]!=null&&typeof x[k]!=='string'))||new Set(p.items.map(x=>x.id)).size!==p.items.length)throw Error('checklist.items: up to 100 unique {id:string,label:string,group?:string,description?:string}')
  if(p.value!==undefined&&(!Array.isArray(p.value)||p.value.some(x=>typeof x!=='string')))throw Error('checklist.value: checked string IDs')
 }
}
