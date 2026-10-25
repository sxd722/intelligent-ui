// Presentation annotations only: never reparent controls or change business state.
const visual = '.cs-chart,.cs-diagram,.cs-heatmap,.cs-mermaid,.cs-photo,.cs-carousel,.cs-point-map,.cs-sandbox,.cs-experience,.cs-collection'
export function attachComposition(stage) {
 if(!stage)return()=>{}
 let frame=0,disposed=false
 const apply=()=>{
  frame=0;if(disposed)return
  const card=stage.querySelector('.cs-card');if(!card)return
  const enabled=stage.dataset.materialVersion==='2'&&!!stage.dataset.visualStyle
  const candidates=[...card.querySelectorAll(visual)].filter(el=>!el.closest('dialog,[hidden],[data-priority=decorative]')&&el.getClientRects().length)
  // A selected item/detail is still part of its owning visual, not a new hero.
  const primary=candidates.find(el=>!candidates.some(parent=>parent!==el&&parent.contains(el)))
  for(const old of card.querySelectorAll('[data-visual-primary]'))if(old!==primary||!enabled)delete old.dataset.visualPrimary
  if(primary&&enabled&&primary.dataset.visualPrimary!=='true')primary.dataset.visualPrimary='true'
  const composition=enabled?(primary?'visual':'utility'):'legacy'
  if(stage.dataset.composition!==composition)stage.dataset.composition=composition
  for(const child of card.children){
   const role=primary&&(child===primary||child.contains(primary))?'subject':child.matches('.cs-title')?'heading':child.matches('[data-role=actions]')?'actions':child.matches('.cs-caption,[data-role=summary]')?'support':'content'
   if(enabled){if(child.dataset.composeRole!==role)child.dataset.composeRole=role}else delete child.dataset.composeRole
  }
 }
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(apply)}
 const observer=new MutationObserver(schedule)
 observer.observe(stage,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','data-design','data-visual-style','data-material-version','data-card-size']})
 schedule()
 return()=>{disposed=true;observer.disconnect();cancelAnimationFrame(frame)}
}
