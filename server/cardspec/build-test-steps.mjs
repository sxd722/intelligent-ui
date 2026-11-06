// Adjacent read-only assertions inspect the same post-action snapshot. Fold
// them without dropping an action, an expectation, or a requirement identity.
export function compactBuildTestSteps(steps){
 if(!Array.isArray(steps))return steps
 const result=[]
 for(const step of steps){
  const prev=result.at(-1),a=prev?.expect||{},b=step?.expect
  if(step?.waitMs||step?.op!=='check'||!b||Object.hasOwn(b,'changed')||!prev||prev.op==='reload'||prev.requirement!==step.requirement||(prev.scenario||'normal')!==(step.scenario||'normal')){result.push(step);continue}
  if(b.visual!==undefined&&a.visual!==undefined&&a.visual!==b.visual||Object.entries(b.state||{}).some(([k,v])=>Object.hasOwn(a.state||{},k)&&JSON.stringify(a.state[k])!==JSON.stringify(v))){result.push(step);continue}
  const texts=[...new Set([a.text,b.text].flatMap(t=>t===undefined?[]:Array.isArray(t)?t:[t]))]
  if(texts.length>6){result.push(step);continue}
  result[result.length-1]={...prev,expect:{...a,...b,...(a.changed!==undefined?{changed:a.changed}:{}),...(a.state||b.state?{state:{...a.state,...b.state}}:{}),...(texts.length?{text:texts}:{} )}}
 }
 return result
}
