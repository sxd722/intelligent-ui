// Compact older materialized datasets, never tool contracts or failures. Full
// rows remain in the host; binding recipes, field names and dataset paths are
// sufficient for layout/analysis. This reclaims context, not model/read budget.
export function compactDatasetHistory(history){
 let saved=0,count=0
 const lastTool=history.findLastIndex(m=>m.role==='tool')
 for(let i=0;i<lastTool;i++){
  const m=history[i];if(m.role!=='tool'||typeof m.content!=='string'||m.content.length<1800)continue
  let r;try{r=JSON.parse(m.content)}catch{continue}
  if(!r.dataset||!r.path||r.error||r.contextCompacted||!Array.isArray(r.items))continue
  const next={dataset:r.dataset,path:r.path,tool:r.tool,input:r.input,fields:r.fields,totalObserved:r.totalObserved,source:r.source,fetchedAt:r.fetchedAt,coverage:r.coverage,classificationCounts:r.classificationCounts,bindingRecipe:r.bindingRecipe,hostView:r.hostView,taskPresentation:r.taskPresentation,fieldCoverage:r.fieldCoverage,items:r.items.slice(0,1),sampleOnly:true,contextCompacted:true,instruction:'Earlier result compacted; complete rows remain at path.items. Use dataset_analyze for evidence-backed labels; do not infer all rows from this sample.'}
  let text=JSON.stringify(next)
  if(text.length>2000){next.items=[];text=JSON.stringify(next)}
  if(text.length>=m.content.length)continue
  saved+=m.content.length-text.length;count++;m.content=text
 }
 return {savedCharacters:saved,compactedResults:count}
}
