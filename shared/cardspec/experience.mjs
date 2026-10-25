import {observableContent} from './feedback-diagnostics.mjs'
import {createStore,makeScope,executeAction} from './store.mjs'
import {evaluate} from './expression.mjs'
import {eventSamples} from './registry.mjs'
export const EXPERIENCE_PATTERNS=['relations','compare','quantities','process','observe','explore','reading','utility']
// Default stays direct until paired quality gates pass. Both modes remain explicit.
export const DEFAULT_CARDSPEC_MODE='direct'
export const experienceMode=value=>['experience','staged','direct'].includes(value)?value:DEFAULT_CARDSPEC_MODE
export function validateExperiencePlan(value,{slot=false}={}){
 if(!value||Array.isArray(value)||typeof value!=='object')throw Error('experience plan must be an object')
 const keys=['goal','pattern','primary','interaction','followups','resources','disclosure']
 if(Object.keys(value).some(k=>!keys.includes(k))||!EXPERIENCE_PATTERNS.includes(value.pattern))throw Error('unknown experience plan field/pattern')
 for(const k of ['goal','primary','interaction','disclosure'])if(typeof value[k]!=='string'||value[k].length>220)throw Error('experience '+k+' must be short text')
 for(const k of ['followups','resources'])if(!Array.isArray(value[k])||value[k].length>(k==='followups'?2:3)||value[k].some(v=>typeof v!=='string'||v.length>140))throw Error('invalid experience '+k)
 if(JSON.stringify(value).length>(slot?1100:2400)||JSON.stringify(value).match(/<(?:card|action|data)\b|"component"\s*:/))throw Error('experience plan must contain intent, not implementation')
 return value
}
const examples={
 relations:'选中一个流程节点，突出直接关联边；下方只解释当前关系，不再复制一遍图中内容。',
 compare:'图片候选选择后加入同一对照区；用同维度事实比较，缺失数据标为未知。',
 quantities:'一个参数联动同一组图表和关键结果；保存方案时复制完整快照，再对比当前输入。',
 process:'只突出当前步骤和下一步条件，推进后结果可见；允许回看已完成步骤。',
 observe:'图片用于识别对象，选中后显示短观察任务，再按该对象记录或追问。',
 explore:'先让用户预测或选择，再揭晓依据；不同选择必须产生不同且可见的反馈。',
 reading:'保持用户要求的正文完整，用语义片段和按需注释辅助阅读，不强迫答题。',
 utility:'先完成输入与结果任务，必要状态一眼可见，不为了视觉效果添加无关图表。'
}
export function experienceInstruction(plan){return plan?`【本次体验骨架】${JSON.stringify(plan)}\n落实主表达与可见反馈；实际证据不支持某种图形时改用可靠表达，不补造数据。短例：${examples[plan.pattern]}。不要把骨架字段显示在卡片里。`:''}
export function experienceDiagnostics(spec,{plan,bindings={}}={}){
 const store=createStore(),warnings=[],texts=[],types=new Set(),controls=[],seen=new Set();let visited=0
 const warn=(code,message)=>warnings.push({severity:'warning',code,message})
 function walk(nodes,scope){for(const n of nodes||[]){if(++visited>1200)return;try{
  if(n.type==='run'){const t=String(evaluate(n.value,scope)??'').trim();if(t)texts.push(t);continue}
  const p=Object.fromEntries(Object.entries(n.props||{}).filter(([k])=>!['itemKey','args'].includes(k)).map(([k,v])=>[k,evaluate(v,scope)]))
  if(p.visible===false||n.type==='if'&&!p.test)continue
  if(n.type==='logic'){walk(n.children,{...scope,local:p.initial});continue}
  types.add(n.type)
  if(n.type==='each'){const items=p.items;if(Array.isArray(items))for(const [i,item]of items.slice(0,100).entries())walk(n.children,{...scope,item,index:i,[p.as||'item']:item});continue}
  if(n.type==='region'&&p.overflow==='details')continue
  for(const k of ['label','description'])if(typeof p[k]==='string')texts.push(p[k])
  for(const [eventName,event]of Object.entries(eventSamples(n.type,p,spec.context)))if(!Object.hasOwn(scope,'local')&&p[eventName]&&!p.disabled&&!['carousel','navigation','calendar'].includes(n.type)){
   let probe={...event}
   if(n.type==='slider'){const lo=p.min??0,hi=p.max??100,step=p.step??1,current=p.value??lo;probe.value=current+step<=hi?current+step:Math.max(lo,current-step)}
   if(['select','segmented','radio-group'].includes(n.type)){const values=(p.options||[]).map(v=>typeof v==='object'?v.value:v);probe.value=values.find(v=>v!==p.value)??p.value}
   controls.push({n,p,eventName,event:probe,scope})
  }
  walk(n.type==='carousel'?n.children?.slice(0,1):n.children,scope)
 }catch{ /* Unknown async inputs are not a presentation failure. */ }}}
 try{walk(spec.children,makeScope(spec,store,{bindings}))}catch{}
 let changed=0,effects=0,resultFeedbackActions=0
 const beforeContent=observableContent(spec,store,{bindings})
 for(const c of controls.slice(0,24)){try{const draft=structuredClone(store),pending=[];executeAction(spec,draft,c.p[c.eventName],{...c.scope,event:c.event,args:c.n.props.args?evaluate(c.n.props.args,{...c.scope,event:c.event}):{},effects:pending});if(JSON.stringify(draft.values)!==JSON.stringify(store.values))changed++;effects+=pending.length;if(observableContent(spec,draft,{bindings})!==beforeContent)resultFeedbackActions++}catch{}}
 // Initial -> selected can reveal a static paragraph and look interactive.
 // Compare two distinct real options as well. No effects are dispatched, and
 // this remains advisory: selection-only controls may intentionally share text.
 let selectionComparisons=0,staticSelectionDetails=0
 const selectionFields={chart:'data',mindmap:'nodes',flowchart:'nodes',table:'rows',collection:'items',map:'items'}
 for(const c of controls.filter(c=>c.eventName==='onSelect'&&selectionFields[c.n.type]).slice(0,8)){
  try{
   const field=selectionFields[c.n.type],items=c.p[field]
   if(!Array.isArray(items)||items.length<2)continue
   const samples=items.slice(0,2).map(item=>eventSamples(c.n.type,{...c.p,[field]:[item]},spec.context).onSelect)
   if(!samples.every(Boolean)||samples[0].id===samples[1].id)continue
   const outcomes=samples.map(event=>{const draft=structuredClone(store),pending=[];executeAction(spec,draft,c.p.onSelect,{...c.scope,event,args:c.n.props.args?evaluate(c.n.props.args,{...c.scope,event}):{},effects:pending});return {content:observableContent(spec,draft,{bindings}),state:JSON.stringify(draft.values),effects:pending.length}})
   selectionComparisons++
   if(outcomes.every(o=>!o.effects)&&outcomes[0].state!==outcomes[1].state&&outcomes[0].content===outcomes[1].content){
    staticSelectionDetails++
    warn('experience_selection_detail_static',`${c.n.id}: 两个不同选项改变了选中状态，但说明/结果相同；若用于详情联动，请从所选对象读取内容，避免固定示例文字。`)
   }
  }catch{ /* Unknown async values do not justify a claim of broken feedback. */ }
 }
 const repeated=texts.filter(t=>{if(t.length<24)return false;if(seen.has(t))return true;seen.add(t);return false}),long=texts.filter(t=>t.length>120),visual=[...types].filter(t=>['image','chart','mindmap','flowchart','mermaid','table','calendar','map','heatmap'].includes(t))
 if(changed&&!resultFeedbackActions&&!effects)warn('experience_result_unchanged','操作改变了状态，但未观察到正文、结果或工具反馈变化；控件回显不等于任务完成。')
 const textCharacters=texts.join('').length,reading=plan?.pattern==='reading'
 if(!reading&&textCharacters>300)warn('experience_dense_text','初始可见说明较多；优先保留结论和当前选择的解释，将补充内容按需展开。')
 if(!reading&&long.length>=2)warn('experience_long_paragraphs','连续长段落应改为短观点、可比较事实或有结果的探索，不截断必要信息。')
 if(repeated.length)warn('experience_repetition','主体与说明存在重复文本，只保留一个信息所有者。')
 if(plan&&!['reading','utility'].includes(plan.pattern)&&!visual.length)warn('experience_missing_visual','体验骨架没有落实为内容视觉主体；背景和图标不计。')
 if(controls.length&&!changed&&!effects)warn('experience_feedback_unproven','初始事件样本未观察到状态变化或工具请求，需要检查实际操作反馈。')
 return {warnings,metrics:{textCharacters,longParagraphs:long.length,repeatedTexts:repeated.length,visualTypes:visual,controls:controls.length,changedActions:changed,resultFeedbackActions,toolEffects:effects,selectionComparisons,staticSelectionDetails},limitations:'初始状态与两个选项的有界无副作用探测，不等价于可见几何或业务正确性验收'}
}
