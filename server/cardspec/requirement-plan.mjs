import {requestClauses,validateRequirements} from './requirements.mjs'
import {buildUnits} from './build-units.mjs'

export const requirementSeeds=goal=>requestClauses(goal).map((quote,i)=>({id:`R${i+1}`,quote}))

// Normalize only lossless aliases. Never invent an acceptance or mark a missing
// requirement as covered merely because the surrounding prose sounds similar.
export function inspectRequirementPlan(goal,raw,seeds=requirementSeeds(goal),{renderMode}={}){
 const plan=structuredClone(raw||{}),issues=[]
 const entries=Array.isArray(plan.requirements)?plan.requirements:[]
 const valid=[],missing=[]
 for(const seed of seeds){
  const matches=entries.filter(r=>r?.id===seed.id),r=matches[0]
  if(matches.length!==1||typeof r.acceptance!=='string'||!r.acceptance.trim()||r.acceptance.length>400||r.kind!==undefined&&!['content','interaction','simulation','evidence'].includes(r.kind))missing.push(seed)
  else valid.push({...r,quote:seed.quote})
 }
 plan.requirements=valid
 if(missing.length)issues.push({field:'requirements',ids:missing.map(r=>r.id),message:'Only add or replace these requirement IDs; keep the accepted entries.'})
 if(!Array.isArray(plan.modules)||!plan.modules.length||plan.modules.length>6||!plan.modules.some(m=>m?.name==='main.cardspec')||plan.modules.some(m=>!m||typeof m.name!=='string'||!/^[\w.-]+\.(cardspec|jsx)$/.test(m.name)||m.name.includes('..'))||new Set(plan.modules.map(m=>m.name)).size!==plan.modules.length)issues.push({field:'modules',message:'Provide 1–6 uniquely named .cardspec/.jsx modules including main.cardspec.'})
 else try{buildUnits({...plan,requirements:seeds})}catch(e){issues.push({field:'modules',message:e.message})}
 if(renderMode==='native'&&Array.isArray(plan.modules)&&plan.modules.some(m=>m?.name?.endsWith('.jsx'))&&!issues.some(i=>i.field==='modules'))issues.push({field:'modules',message:'This host only allows native CardSpec. Use .cardspec modules and native state/actions, no .jsx or sandbox.'})
 if(renderMode==='web'&&Array.isArray(plan.modules)&&plan.modules.filter(m=>m?.name?.endsWith('.jsx')).length>1&&!issues.some(i=>i.field==='modules'))issues.push({field:'modules',message:'One Web application uses one JSX runtime module plus main.cardspec. Keep shared state/timers together; split work into up to 8 units within that file, not isolated mutually dependent sandboxes.'})
 if(typeof plan.interfaces!=='string'||!plan.interfaces.trim()){
  const perModule=Array.isArray(plan.modules)?plan.modules.filter(m=>m&&typeof m.interfaces==='string'&&m.interfaces.trim()).map(m=>`${m.name}: ${m.interfaces}`).join('\n'):''
  if(perModule&&perModule.length<=1800)plan.interfaces=perModule
 }
 if(typeof plan.interfaces!=='string'||!plan.interfaces.trim()||plan.interfaces.length>1800)issues.push({field:'interfaces',message:'Provide a brief shared state/action ownership contract (at most 1800 characters). No code.'})
 if(issues.some(i=>i.field==='modules')&&!issues.some(i=>i.field==='interfaces'))issues.push({field:'interfaces',message:'Keep the shared state contract consistent with the repaired modules; preserve its existing semantics.'})
 if(!missing.length)validateRequirements(goal,valid)
 return {plan,issues,missing}
}

export function mergeRequirementPatch(current,patch,issues){
 const next=structuredClone(current)
 for(const issue of issues){
  if(issue.field==='requirements'){
   const allowed=new Set(issue.ids),updates=(Array.isArray(patch.requirements)?patch.requirements:[]).filter(r=>allowed.has(r?.id))
   next.requirements=[...next.requirements.filter(r=>!allowed.has(r.id)),...updates]
  }else if(Object.hasOwn(patch,issue.field))next[issue.field]=patch[issue.field]
 }
 return next
}

export const REQUIREMENT_PATCH_PROMPT='修补已保存的需求计划，只返回JSON。仅填写issues列出的字段；requirements只返回missing中的ID、kind、acceptance，不重复已通过条目，不抄原文；仅当issues点名modules时返回修正的模块表并保持既有功能/状态归属，否则不重写模块。不写代码、不调用工具。每项acceptance用一句可观察的行为（通常60字以内），不能删掉该需求的核心功能。';
