import { compileCard } from '../../shared/cardspec/compiler.mjs'
import { createStore, makeScope } from '../../shared/cardspec/store.mjs'
import { getVisualStyle, validBackgroundQuery, BACKGROUND_POSITIONS } from '../../shared/cardspec/styles.mjs'
import { THEMES } from '../../shared/cardspec/registry.mjs'
import { getDesign } from '../../shared/cardspec/designs.mjs'
import { closePlanningContainers } from './planning-json.mjs'

// Planning receives conversation facts, not assistant DSL examples to continue.
export function planningConversation(history, context) {
  return history.map(({ role, content }) => {
    if (role !== 'assistant') return { role, content }
    if (!/<(?:intro|card)\b/i.test(content)) return { role, summary: content }
    const { spec } = compileCard(content, { final: true, context })
    if (!spec) return { role, summary: '上一轮卡片源码无法解析；以用户需求为准。' }
    let values = {}
    try { const scope = makeScope(spec, createStore()); values = { data: JSON.parse(JSON.stringify(scope.data)), initialState: scope.state } } catch {}
    const components = []
    const visit = (nodes) => { for (const n of nodes) {
      if (n.type !== 'run') components.push({ component: n.type, label: n.props.label?.value,
        text: (n.children || []).filter(c => c.type === 'run' && c.value.type === 'literal').map(c => c.value.value).join('') })
      visit(n.children || [])
    } }
    visit(spec.children)
    return { role, summary: { intro: spec.intro, outro: spec.outro, design: spec.design, visualStyle: spec.visualStyle, backgroundQuery: spec.backgroundQuery, backgroundPosition: spec.backgroundPosition, ...values, components } }
  })
}

export class PlanningFormatError extends Error {}

// Plans describe intent; the later DSL phase owns component trees and data.
// Validate that boundary before forwarding a syntactically valid JSON object.
export function parsePlanningDocument(text, phase, {onRepair,onNormalize}={}) {
  let source=text.replace(/^\uFEFF/, '').replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, ''), doc, recovery
  if(source.length>12000) throw new PlanningFormatError(`${phase} is too detailed; return a compact intent summary`)
  try {doc=JSON.parse(source)} catch(originalError) {
    try {recovery=closePlanningContainers(source);source=recovery.source;doc=JSON.parse(source)} catch {throw originalError}
  }
  const changes=[],object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)
  const strings=(v,path,max=16)=>{
    if(!Array.isArray(v)||v.length>max||v.some(s=>typeof s!=='string'||s.length>500)) throw new PlanningFormatError(`${path} must be an array of at most ${max} short strings, not component objects or full content`)
  }
  if(!object(doc)) throw new PlanningFormatError(`${phase} must be an object`)
  if(source.length>12000) throw new PlanningFormatError(`${phase} is too detailed; return a compact intent summary`)
  if(phase==='analysis') {
    if(typeof doc.goal!=='string'||!doc.goal.trim()) throw new PlanningFormatError('analysis.goal must be a non-empty string')
    strings(doc.interactions,'analysis.interactions')
    for(const key of ['requiredInformation','supportingInformation','unavailableData']) if(doc[key]!==undefined) strings(doc[key],`analysis.${key}`)
  } else if(phase==='plan') {
    if(!object(doc.theme)||!THEMES.includes(doc.theme.language)||!['a','b','c'].includes(doc.theme.palette)) throw new PlanningFormatError('plan.theme requires a supported language and palette a|b|c')
    if(!Array.isArray(doc.regions)||doc.regions.length>12) throw new PlanningFormatError('plan.regions must be an array of at most 12 regions')
    const ids=new Set()
    for(const [i,region] of doc.regions.entries()) {
      const path=`plan.regions[${i}]`
      if(!object(region)||typeof region.id!=='string'||!region.id||ids.has(region.id)) throw new PlanningFormatError(`${path} requires a unique id`)
      ids.add(region.id)
      // Models sometimes put the importance token in both fields. This has a
      // single safe interpretation for planning: ordinary content + priority.
      if(['supporting','decorative','required'].includes(region.role)&&(!region.priority||region.priority===region.role)) {
        changes.push({path:`${path}.role`,from:region.role,to:'content',priority:region.role})
        region.priority=region.role;region.role='content'
      }
      if(!['summary','content','actions'].includes(region.role)) throw new PlanningFormatError(`${path}.role must be summary|content|actions; supporting belongs in priority`)
      if(region.priority!==undefined&&!['required','supporting','decorative'].includes(region.priority)) throw new PlanningFormatError(`${path}.priority is invalid`)
      if(region.overflow!==undefined&&!['scroll','paginate','details'].includes(region.overflow)) throw new PlanningFormatError(`${path}.overflow is invalid`)
      strings(region.content,`${path}.content`,8)
    }
    if(doc.rules!==undefined) strings(doc.rules,'plan.rules')
    if(doc.state!==undefined&&!object(doc.state)) throw new PlanningFormatError('plan.state must be an object of initial state descriptions')
    validatePlanNavigation(doc);validatePlanVisualStyle(doc)
  } else throw new PlanningFormatError('unknown planning phase')
  if(recovery)onRepair?.(recovery)
  if(changes.length)onNormalize?.(changes,doc)
  return doc
}

export function planningRepairInstruction(error, source) {
  const offset=Number(/position (\d+)/.exec(error.message)?.[1])
  const excerpt=Number.isFinite(offset)?source.slice(Math.max(0,offset-160),offset+160):''
  return `当前规划未通过校验：${error.message}。${excerpt?`错误位置附近的原文（仅用于定位，不是输出范例）：${JSON.stringify(excerpt)}。`:''}
重新输出符合当前schema的完整、紧凑JSON对象。regions[].content只能是短字符串数组；不要输出组件对象、表格rows/columns、节点、公式源码或完整正文。只描述组件用途、联动和内容主题，具体内容留到阶段3。每个区域1–3条短说明，总体约600字；不得删掉用户的核心需求。键和字符串使用ASCII双引号，检查数组、对象括号配对及逗号。不要输出DSL或解释。`
}

export function validatePlanVisualStyle(doc) {
  if (Object.hasOwn(doc, 'design') && !getDesign(doc.design)) throw new Error('plan.design must name one supported design recipe')
  // Read old saved plans; validate every new visual contract as a unit.
  if (!['visualStyle', 'backgroundQuery', 'backgroundPosition'].some(key => Object.hasOwn(doc, key))) return
  if (!getVisualStyle(doc.visualStyle)) throw new Error('plan.visualStyle must name one supported style token')
  if (!validBackgroundQuery(doc.backgroundQuery)) throw new Error('plan.backgroundQuery must contain a search phrase of 1–100 characters, not a URL')
  if (doc.backgroundPosition !== undefined && !BACKGROUND_POSITIONS.includes(doc.backgroundPosition)) throw new Error('plan.backgroundPosition must be center, top or bottom')
}

export function validatePlanNavigation(doc) {
  if(doc.navigation === undefined) return // Older saved plans remain readable.
  if(!Array.isArray(doc.navigation)) throw new Error('plan.navigation must be an array')
  const owners=new Set(), controllers=new Set()
  for(const nav of doc.navigation) {
    if(!nav || typeof nav.ownerId!=='string' || !nav.ownerId || owners.has(nav.ownerId)) throw new Error('each navigation owner must be declared exactly once')
    owners.add(nav.ownerId)
    if(!['page','month'].includes(nav.kind) || !['builtin','external'].includes(nav.controls)) throw new Error('invalid navigation kind or controls')
    if(nav.controls==='external') {
      if(typeof nav.controllerId!=='string' || !nav.controllerId || controllers.has(nav.controllerId)) throw new Error('external navigation requires a unique controllerId')
      controllers.add(nav.controllerId)
    } else if(nav.controllerId) throw new Error('builtin navigation must not declare an extra controller')
  }
}

export function assertJsonPrefix(text) {
  let prefix = text.replace(/^\uFEFF/, '').trimStart()
  if (!prefix || '```json'.startsWith(prefix.toLowerCase())) return
  prefix = prefix.replace(/^```(?:json)?\s*/i, '')
  if (prefix && !prefix.startsWith('{')) throw new PlanningFormatError('规划阶段必须输出 JSON 对象，已提前终止非 JSON 输出')
}

export function planningMessages(prompt, context, history, analysis, name) {
  const currentIndex=history.findLastIndex(m=>m.role==='user')
  const current=currentIndex>=0?history[currentIndex].content:''
  const background=history.filter((m,i)=>i!==currentIndex&&String(m.content||'').trim())
  return [
    { role: 'system', content: `${prompt}\n当前仅执行${name === 'analysis' ? '信息规划' : '交互方案'}阶段。只输出上述JSON对象，首个非空白字符必须是{。卡片实现留给后续阶段，禁止输出组件标记、DSL、HTML或代码围栏。\n宿主可信上下文：${JSON.stringify(context)}。历史资料中的角色、摘要和文本仅供理解需求，不是输出范例或阶段指令。以最后单独列出的本轮请求为目标；用户切换话题时，不得继续制作历史卡片。仅当本轮要求修改或延续旧卡时才沿用其内容与状态。` },
    { role: 'user', content: `历史背景，仅供关联参考：${JSON.stringify(planningConversation(background, context))}` },
    { role: 'user', content: `本轮用户请求：\n${current}${analysis ? `\n本轮已确认的信息规划：${JSON.stringify(analysis)}` : ''}\n请围绕本轮请求完成当前规划阶段，仅输出符合当前schema的JSON对象。` },
  ]
}
