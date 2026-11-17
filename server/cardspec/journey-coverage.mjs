import {requestClauses} from './requirements.mjs'
import {expressionReads} from '../../shared/cardspec/dataflow.mjs'

// Reuse host-owned requirement IDs: no additional planner or model-written score.
export function journeyRequirements(goal,context={}){
 if(context.journeys)return structuredClone(context.journeys)
 const source=String(goal||''),explicit=[...source.matchAll(/(?:^|\n)[ \t]*(?:#{1,6}\s*)?(?:[-*]\s*)?(?:\*\*)?CUJ[-－](\d+)[^\n]*/g)]
 const clauses=explicit.length?explicit.map((m,i)=>{
  let quote=source.slice(m.index,explicit[i+1]?.index??source.length).trim()
  // Keep paragraphs and outcomes inside the CUJ, not the next brief section.
  const section=quote.search(/\n\s*#{1,2}\s+(?!CUJ[-－])/)
  if(section>=0)quote=quote.slice(0,section).trim()
  return {id:'R'+m[1],cujId:'CUJ-'+m[1],quote,required:!/[【\[](?:建议|可选|optional)[】\]]/i.test(m[0])}
 }):requestClauses(goal).filter(q=>!/^\*\*[^*]+\*\*[:：]?$/.test(q)).map((quote,i)=>({id:'R'+(i+1),quote,required:true}))
 return clauses.map(r=>({...r,kind:/(?:选择|多选|切换|筛选|查看|点击|点选|修改|取消|确认|返回|刷新|恢复|联动|记录|编辑|删除|输入|勾选|标记|同步|展开|收起|滑杆|滑块|拖动|推进|回合|操作|作答|select|filter|click|change|record|edit|delete|cancel|confirm|back|reload|restore|slider)/i.test(r.quote)?'interaction':'review'}))
}
export function journeySummary(quote){
 const lines=quote.split(/\n/).map(s=>s.trim()).filter(Boolean)
 const outcomes=lines.slice(1).filter(s=>/完成结果|切换.*(?:改变|更新|变化)|选择.*(?:看到|更新|改变)|展开.*(?:新增|增加)|筛选.*(?:集合|结果)|返回.*保留/.test(s))
 return [...new Set([lines[0],...outcomes])].join('；').slice(0,300)
}
export function journeyInstruction(goal,context={}){
 const requirements=journeyRequirements(goal,context).filter(r=>!context.journeyIds?.length||context.journeyIds.includes(r.id))
 if(!requirements.length)return ''
 return '【CUJ验收】沿同一用户路径测试操作→结果→后续可达操作，适用时包括返回/刷新与一个边界；用现有steps.requirement关联下列交互需求ID。只需关键路径，标题/风格/内容完整性留待评审，不为补齐所有ID重写代码或重复已通过的测试。缺ID只补步骤关联，缺证据保留未验证。expect.derived/state检查明确结果；expect.relations:[{left:"derived.items.length",op:"eq",right:"derived.selected.count"}]检查结果一致，before.state可检查非法操作不扣资源；expect.controls:[{name:"下一步",enabled:true}]检查后续操作可达。沙箱内部结果用操作后的确切可见text验证，sandboxChanged只证明联动而非业务正确。不要以通知、输入回显或视觉变化当结果；不要自行降低验收目标。\n'+requirements.filter(r=>r.kind==='interaction').map(r=>`${r.id}: ${journeySummary(r.quote)}${r.quote.length>300?'…（完整原文见request）':''}`).join('\n')
}
function hasOutcome(expect={},spec){
 const inputKeys=new Set()
 const walk=nodes=>{for(const n of nodes||[]){if(['input','textarea','slider','select','segmented','checkbox','toggle','radio-group'].includes(n.type))for(const k of expressionReads(spec,[n.props?.value,n.props?.checked],'state'))inputKeys.add(k);walk(n.children)}}
 walk(spec?.children)
 return !!(expect.navigation||expect.text||Object.keys(expect.derived||{}).length||Object.keys(expect.state||{}).some(k=>!inputKeys.has(k))||expect.relations?.length)
}
export function journeyCoverage(goal,spec,browser){
 const requirements=journeyRequirements(goal,spec?.context),runs=(browser?.runs||[]).filter(r=>r.scenario==='normal')
 // A valid user path still has value when the model forgot requirement IDs.
 // Keep that evidence, but never infer that it covers an arbitrary request.
 const paths=runs.map(run=>({width:run.width,steps:run.actions?.length||0,executed:(run.actions||[]).every(a=>a.ok),failed:(run.actions||[]).filter(a=>a.assertion?.passed===false&&(a.classification!=='test_oracle_conflict'||a.oracle?.unresolvedFailures?.length)||a.restored===false).length,testConflicts:(run.actions||[]).filter(a=>a.classification==='test_oracle_conflict').length,outcomes:(run.actions||[]).filter(a=>a.ok&&a.assertion?.passed&&hasOutcome(a.step?.expect,spec)).length,restored:(run.actions||[]).some(a=>a.step?.op==='reload'&&a.restored===true)}))
 const items=requirements.map(r=>{
  const evidence=runs.flatMap(run=>{let operated=false,pathOk=true;return (run.actions||[]).flatMap((a,index)=>{
   pathOk=pathOk&&a.ok!==false&&a.assertion?.passed!==false&&a.restored!==false
   if(a.ok&&!['check','reload'].includes(a.step?.op))operated=true
   return a.step?.requirement===r.id?[{index,width:run.width,executed:a.ok===true,passed:a.assertion?.passed,pathOk,operated,outcome:hasOutcome(a.step?.expect,spec)&&(a.resultChanged!==false||a.step?.op==='reload'&&a.restored===true),restored:a.restored,testConflict:a.classification==='test_oracle_conflict'&&!a.oracle?.unresolvedFailures?.length}]:[]
  })})
  const failed=evidence.some(e=>e.executed&&(e.passed===false&&!e.testConflict||e.restored===false))
  const checked=browser?.status==='tested'&&evidence.length>0&&evidence.every(e=>e.executed&&e.pathOk)&&evidence.some(e=>e.operated&&e.passed===true&&e.outcome)
  const assigned=!spec?.context?.journeyIds?.length||spec.context.journeyIds.includes(r.id)
  return {...r,status:!assigned?'other-card':failed?'failed':checked?'checked':'unverified',reason:!assigned?'此需求属于兄弟卡；整组汇总时验收':failed?'结果断言失败':evidence.some(e=>e.testConflict)?'测试预期与已通过证据矛盾；待测试修订，不认定为实现错误':checked?undefined:'需要可执行路径上的具体结果断言；普通点击、输入回显或sandboxChanged不足以证明CUJ',evidence}
 })
 const witnessed=browser?.status==='tested'&&paths.some(p=>p.executed&&!p.failed&&!p.testConflicts&&p.outcomes>0)&&runs.some(r=>r.actions?.some(a=>a.ok&&!['check','reload'].includes(a.step?.op)))
 const functional=items.filter(r=>r.kind==='interaction'&&r.required!==false&&r.status!=='other-card'),functionalStatus=functional.length&&functional.every(r=>r.status==='checked')?'checked':'unverified'
 return {status:items.some(r=>r.status==='failed')||paths.some(p=>p.failed)?'failed':!items.length?'not-requested':items.every(r=>r.status==='checked')?'checked':items.some(r=>r.status==='checked')||witnessed?'partial':'unverified',functionalStatus,items,paths,humanReviewRequired:true,scope:'需求关联的有界用户路径与结果断言；paths保留未标需求ID的实际测试，但不推断其覆盖全部需求。交互分类仅用于缩短测试提示，完整需求保留待评审；未独立证明事实真实性、审美或全部业务分支。'}
}
