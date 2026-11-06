// A unit is a small commit, not a new DSL module or a separate user page.
export function buildUnits(plan) {
 const units=[]
 for(const module of plan.modules){
  const parts=module.units??[{goal:module.purpose||module.name}]
  if(!Array.isArray(parts)||!parts.length||parts.length>8)throw Error('each module needs 1–8 small units')
  for(const [index,part] of parts.entries()){
   if(typeof part.goal!=='string'||!part.goal.trim()||part.goal.length>240)throw Error('unit goal must be 1–240 characters')
   const requirements=part.requirements??plan.requirements.map(r=>r.id)
   if(!Array.isArray(requirements)||requirements.some(id=>!plan.requirements.some(r=>r.id===id)))throw Error('unit references unknown requirement')
   units.push({id:module.name+':'+index,module:module.name,goal:part.goal,requirements})
  }
 }
 if(units.length>10)throw Error('maximum 10 small commits; share common state and avoid duplicate units')
 return units
}
export function nextBuildUnit(units,committed){return units.find(unit=>!committed.has(unit.id))}
export function assertUnitRetention(before,after){
 // During additive unit construction, declarations and mounts belong to earlier
 // commits. A repair may intentionally change them through the repair phase.
 const keys=source=>new Set([...source.matchAll(/<(data|state|derive|binding|action)\b[^>]*\bid="([^"]+)"|<include\s+module="([^"]+)"/g)].map(m=>m[3]?'include:'+m[3]:m[1]+':'+m[2]))
 const next=keys(after),lost=[...keys(before)].filter(key=>!next.has(key))
 if(lost.length)throw Error('Unit would remove previously committed declarations/mounts: '+lost.slice(0,8).join(', '))
}
