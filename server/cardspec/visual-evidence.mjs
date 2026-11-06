// Keep visual capability at matched viewport/scenario/UI checkpoints. We retain
// presence, not SVG counts: replacing many SVGs with one Canvas is legitimate.
export function createVisualEvidenceGuard(){
 const baseline=new Map()
 function points(browser,context){
  const out=[]
  for(const run of browser?.runs||[]){
   const prefix=JSON.stringify([context,run.scenario||'normal',run.width||432]),path=[]
   out.push({key:prefix+':initial',value:run.initial?.visuals,location:prefix})
   for(const a of run.actions||[]){
    const s=a.step||{};path.push([s.op,s.name||s.handle||'',s.role||'',s.index||0,s.value??'',s.waitMs||0])
    if(!a.ok)break
    out.push({key:prefix+':'+JSON.stringify(path),value:a.visuals,location:prefix})
   }
  }
  return out
 }
 return {
  compare(browser,context){
   const diagnostics=[]
   for(const p of points(browser,context)){
    if(!Array.isArray(p.value))continue // Missing evidence never certifies a pass.
    for(const owner of baseline.get(p.key)||[])if(!p.value.some(v=>v.owner===owner&&v.visible>0))diagnostics.push({severity:'error',code:'debug_visual_regression',node:owner,message:`${p.location}: ${owner||'card'} 在同一视图/步骤曾有可见主图，修复后消失；保留图形并修正布局。`})
   }
   return diagnostics
  },
  observe(browser,context){
   for(const p of points(browser,context)){
    const owners=new Set(baseline.get(p.key)||[])
    for(const v of p.value||[])if(v.visible>0)owners.add(v.owner||'')
    if(owners.size)baseline.set(p.key,owners)
   }
  }
 }
}
