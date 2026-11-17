// Narrow, explicit external-navigation promises, not arbitrary 'view/details'
// labels (which can legitimately reveal local content).
export const externalNavigationLabel=label=>/^(?:打开(?:原文|原帖|来源|链接|网站)|访问(?:原文|原帖|来源|链接|网站)|open\s+(?:original|source|link|website)|visit\s+(?:source|website))(?:\s|$|[：:→↗])/i.test(String(label||'').trim())
export function navigationDiagnostics(spec){
 if(!spec)return []
 const walk=nodes=>(nodes||[]).flatMap(n=>[n,...walk(n.children)]),all=walk(spec.children)
 // Arbitrary sandbox callbacks must be verified at runtime, not inferred.
 if(all.some(n=>n.type==='sandbox'))return []
 return all.filter(n=>n.type==='button'&&n.props?.disabled?.value!==true&&externalNavigationLabel(n.props?.label?.value)).flatMap(n=>{
  const steps=spec.actions?.[n.props.onPress?.value]||[]
  if(steps.some(s=>s.type==='invoke'))return []
  return [{severity:'error',code:'navigation_without_destination',node:n.id,message:`${n.id}: “${n.props.label.value}” only changes local state and cannot navigate. Use <link url={selected.url} label="${n.props.label.value}"/> with the actual source URL. Test the click's navigation target, not only state/changed; keep the requested original-source access.`}]
 }).slice(0,3)
}
