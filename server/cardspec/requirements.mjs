// Host-owned task ledger. A model's claim is never a successful test result.
// Preserve source spans: headings provide context, never standalone obligations.
// Merge adjacent small semantic blocks evenly instead of dumping the tail in R12.
export function requestClauses(goal){
 const source=String(goal), blocks=[];let optionalLevel=0, offset=0, current=null
 const flush=()=>{if(current){blocks.push(current);current=null}}
 for(const line of source.split(/(?<=\n)/)){
  const text=line.trim(),start=offset+line.indexOf(text),end=start+text.length;offset+=line.length
  const heading=text.match(/^(#{1,6})\s+(.+)/)
  if(heading){flush();const level=heading[1].length;if(optionalLevel&&level<=optionalLevel)optionalLevel=0;if(/可选建议|可选扩展|非必须|optional|nice.to.have/i.test(heading[2]))optionalLevel=level;continue}
  if(!text){flush();continue}
  if(optionalLevel||/^(?:[-*+]\s*)?(?:\*\*)?(?:可选建议|可选扩展)[：:]/.test(text)||/不纳入必须验收|仅在.*基础版完成/.test(text))continue
  const continuation=/^\s{2,}[-*+]/.test(line)
  if(continuation&&current){current.end=end;continue}
  flush();current={start,end}
 }
 flush()
 // Plain one-line requests still separate independent clauses. Markdown blocks
 // keep subordinate steps together; large blocks split at sentence boundaries.
 const spans=[]
 for(const block of blocks){
  const text=source.slice(block.start,block.end)
  const split=blocks.length===1&&!/\n/.test(text)||text.length>360
  if(!split){spans.push(block);continue}
  const re=blocks.length===1?/[，。；;]|并且|并配上|同时(?:还)?|以及/g:/[。；;]\s*|\n/g
  let at=0;for(const m of text.matchAll(re)){const part=text.slice(at,m.index).trim();if(part.length>1)spans.push({start:block.start+at+text.slice(at,m.index).indexOf(part),end:block.start+m.index});at=m.index+m[0].length}
  const tail=text.slice(at).trim();if(tail.length>1)spans.push({start:block.start+at+text.slice(at).indexOf(tail),end:block.end})
 }
 while(spans.length>12){let best=0,size=Infinity;for(let i=0;i<spans.length-1;i++){const n=spans[i+1].end-spans[i].start;if(n<size){best=i;size=n}}spans.splice(best,2,{start:spans[best].start,end:spans[best+1].end})}
 return spans.map(b=>source.slice(b.start,b.end).trim()).filter(s=>s.length>1)
}
export function validateRequirements(goal,requirements){
 if(!Array.isArray(requirements)||!requirements.length||requirements.length>12)throw Error('requirements needs 1–12 entries')
 const ids=new Set()
 for(const r of requirements){
  if(!r||!/^R\d+$/.test(r.id)||ids.has(r.id)||typeof r.quote!=='string'||r.quote.length<2||!goal.includes(r.quote)||typeof r.acceptance!=='string'||!r.acceptance.trim()||r.acceptance.length>400)throw Error('Each requirement needs unique R id, verbatim request quote and short acceptance')
  if(r.kind!==undefined&&!['content','interaction','simulation','evidence'].includes(r.kind))throw Error('invalid requirement kind')
  ids.add(r.id)
 }
 const omitted=requestClauses(goal).filter(c=>!requirements.some(r=>r.quote.includes(c)))
 if(omitted.length)throw Error('Request clauses omitted: '+JSON.stringify(omitted))
 return structuredClone(requirements)
}
export function requirementAudit(requirements,claims,feedback){
 const actions=feedback?.actions||[]
 const items=requirements.map(r=>{
  const c=claims?.find(c=>c.id===r.id)
  const tests=actions.filter(a=>a.step?.requirement===r.id)
  const operation=tests.some(a=>!['check','reload'].includes(a.step.op)&&a.changed&&a.assertion?.passed&&(a.step.expect?.text||Object.keys(a.step.expect?.state||{}).length||a.step.expect?.changedKeys?.length||a.step.expect?.tool))
  const verified=!!c?.modules?.length&&tests.some(a=>a.ok&&a.assertion?.passed)&&tests.every(a=>a.ok&&a.assertion?.passed!==false)&&(!['interaction','simulation'].includes(r.kind)||operation)
  const reason=!c?.modules?.length?'缺少需求对应模块的claim':!tests.length?'缺少带此requirement ID的验收步骤':tests.some(a=>!a.ok||a.assertion?.passed===false)?'已有验收步骤未执行成功或断言失败':!operation&&['interaction','simulation'].includes(r.kind)?'需要把已观察到的click/fill/select操作及变化断言关联到此需求；check/reload不计交互，不要因此重写实现':'缺少实际通过的结果断言'
  return {...r,status:c?.blocked?(verified?'limited':r.kind==='evidence'?'blocked':'unverified'):verified?'checked':'unverified',reason:c?.blocked||(!verified?reason:undefined)}
 })
 return {status:items.every(r=>r.status==='checked')?'checked':'partial',items,humanReviewRequired:true,scope:'需求引文覆盖与有界行为断言；不证明讲解深度、事实真实性或全部业务正确性'}
}
// Fast mode incurs no extra planning call. Report unverified requirements honestly.
export function quickRequirementAudit(goal){return {status:'unverified',items:requestClauses(goal).map((quote,i)=>({id:'R'+(i+1),quote,status:'unverified'})),humanReviewRequired:true,scope:'快速模式未逐项验收原始需求'}}
export function behaviorFootprint(spec){
 const kinds=new Set();const visit=nodes=>{for(const n of nodes||[]){
  if(['sandbox','logic','chart','mindmap','flowchart','mermaid','calendar','image'].includes(n.type))kinds.add(n.type==='sandbox'?'custom-visual':n.type)
  for(const k of Object.keys(n.props||{}))if(/^on[A-Z]/.test(k))kinds.add('event:'+k)
  visit(n.children)
 }};visit(spec?.children)
 for(const list of Object.values(spec?.actions||{}))for(const s of list)if(['set','increment','toggle','invoke'].includes(s.type))kinds.add('stateful-action')
 return [...kinds]
}
export function lostBehaviors(required,spec){const actual=new Set(behaviorFootprint(spec));return required.filter(k=>!actual.has(k)).map(k=>({severity:'error',code:'repair_behavior_lost',message:`Repair removed ${k}. Preserve the existing interaction/visual capability; do not remove functionality to pass validation.`}))}
