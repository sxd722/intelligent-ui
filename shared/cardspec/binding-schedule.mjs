import {bindingDependencies,expressionReads} from './dataflow.mjs'
import {evaluate} from './expression.mjs'

// Derive activation from existing UI conditions; no new model-authored flag.
// A hidden consumer does not start its binding. Conditions may themselves need
// data, so reads in the condition remain active at the parent level.
export function activeBindings(spec,scope,regions={}){
 const used=new Set(),active=new Set()
 const mark=(ids,shown)=>{for(const id of ids){used.add(id);if(shown)active.add(id)}}
 const walk=(nodes,shown=true,local=scope)=>{for(const n of nodes||[]){
  const guards=[n.props?.visible,...(n.type==='if'?[n.props?.test]:[])].filter(Boolean)
  for(const g of guards)mark(expressionReads(spec,g,'bindings'),shown)
  let on=shown
  try{on=shown&&guards.every(g=>!!evaluate(g,local))}catch{on=false}
  const props=Object.fromEntries(Object.entries(n.props||{}).filter(([k])=>!['visible','test'].includes(k)))
  mark(expressionReads(spec,[props,n.value],'bindings'),on)
  if(n.type==='tool-view'&&n.props?.bindings?.type==='literal')mark(Object.values(n.props.bindings.value),on)
  if(n.type==='tool-view'&&n.props?.binding?.type==='literal')mark([n.props.binding.value],on)
  if(n.type==='each'){
   let rows=[];try{rows=evaluate(n.props.items,local)||[]}catch{}
   if(on&&Array.isArray(rows)&&rows.length){for(const [index,item]of rows.slice(0,500).entries())walk(n.children,true,{...local,[n.props.as?.value||'item']:item,index})}
   else walk(n.children,false,local)
  }else walk(n.children,on&&(!(n.type==='region'&&(n.props?.overflow?.value==='details'||n.props?.role?.value==='details'))||regions[n.id]===true),local)
 }}
 walk(spec.children)
 // Headless bindings remain supported. Explicitly hidden UI consumers wait.
 for(const id of Object.keys(spec.bindings||{}))if(!used.has(id))active.add(id)
 const promote=(id,seen=new Set())=>{if(seen.has(id))return;seen.add(id);for(const dep of bindingDependencies(spec,id)){active.add(dep);promote(dep,seen)}}
 for(const id of [...active])promote(id)
 return active
}

// Layout and dependency information already exists in CardSpec. The model does
// not need another scheduling DSL. Explicit manual loads stay manual.
export function prioritizedBindings(spec){
  const scores=new Map(Object.keys(spec.bindings||{}).map(id=>[id,0]))
  const walk=(nodes,weight=1)=>{for(const node of nodes||[]){
    const priority=node.props?.priority?.value||node.priority
    const local=priority==='required'?4:priority==='supporting'?0:weight
    for(const id of expressionReads(spec,[node.props,node.value],'bindings'))scores.set(id,Math.max(scores.get(id)||0,local))
    if(node.type==='tool-view'&&node.props?.bindings?.type==='literal')for(const id of Object.values(node.props.bindings.value))if(scores.has(id))scores.set(id,Math.max(scores.get(id),local))
    if(node.type==='tool-view'&&scores.has(node.props?.binding?.value))scores.set(node.props.binding.value,Math.max(scores.get(node.props.binding.value),local))
    walk(node.children,local)
  }}
  walk(spec.children)
  const promote=(id,weight,seen=new Set())=>{if(seen.has(id))return;seen.add(id);for(const dep of bindingDependencies(spec,id)){scores.set(dep,Math.max(scores.get(dep)||0,weight+1));promote(dep,weight+1,seen)}}
  for(const [id,score]of scores)promote(id,score)
  return Object.entries(spec.bindings||{}).sort(([a],[b])=>(scores.get(b)||0)-(scores.get(a)||0))
}
