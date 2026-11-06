import{expressionReads,visitExpression}from'./dataflow.mjs';import{decisionProfile}from'./decision-profile.mjs';
// A filter projected only into a count is not a filter on a host-owned result.
// Keep custom UIs valid when they actually consume the filtered rows or state.
export function decisionDiagnostics(spec){
 const nodes=[];const walk=xs=>{for(const n of xs||[]){nodes.push(n);walk(n.children)}};walk(spec.children);
 const owners=nodes.filter(n=>n.type==='tool-view'&&decisionProfile(spec.bindings[n.props.binding?.value]?.tool));if(!owners.length)return[];
 const views=nodes.filter(n=>['each','list','collection','table','chart','map','heatmap','sandbox','tool-view','task-board'].includes(n.type)),out=[],bundles=new Set();
 for(const n of owners)if(n.props.bindings?.type==='literal'){
  const key=JSON.stringify(Object.values(n.props.bindings.value).sort())+JSON.stringify(n.props.task||null);
  if(bundles.has(key))out.push({severity:'error',code:'duplicate_decision_owner',message:'The same binding group has multiple identical decision views. One tool-view bindings={...} already owns leg tabs, pins, list and detail navigation. Keep one persistent view outside if/segmented navigation; remove the duplicate outer leg controls. Keep independent input settings.'});
  bundles.add(key);
 }
 for(const [name,ast]of Object.entries(spec.derived||{})){
  let filtered=false;visitExpression(ast,n=>{if(n.type==='call'&&['filter','js:filter','helper:filter'].includes(n.name))filtered=true});if(!filtered)continue;
  const bindings=expressionReads(spec,ast,'bindings'),owned=owners.filter(n=>bindings.includes(n.props.binding.value));if(!owned.length)continue;
  for(const state of expressionReads(spec,ast,'state')){
   const edits=nodes.filter(n=>['slider','segmented','select','chips','radio-group','input'].includes(n.type)&&Object.entries(n.props).some(([k,v])=>k.startsWith('on')&&(spec.actions[v.value]||[]).some(s=>s.type==='set'&&s.target===state)));
   if(!edits.length||views.some(n=>expressionReads(spec,n.props,'state').includes(state)))continue;
   out.push({severity:'error',code:'detached_result_filter',message:`state.${state} filters derived.${name} but no candidate view consumes it; counts alone do not change results. Use the existing tool-view's built-in filters and remove disconnected duplicate controls/state, or bind task.where to this state. Do not add another list or fake summary.`});
  }
 }
 return out.filter((d,i,a)=>a.findIndex(x=>x.message===d.message)===i).slice(0,2);
}
