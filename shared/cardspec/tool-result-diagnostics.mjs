import {referencePaths} from './dataflow.mjs'
import {canonicalInput,prefetchedInvocation} from './prefetch.mjs'
import {evaluate} from './expression.mjs'
import {createStore,makeScope} from './store.mjs'
import {TOOLS} from './tools.mjs'

// Advisory dataflow check, never a business-logic rewrite. A raw-result drawer
// can be intentional; lack of a card consumer is therefore not a compile error.
export function toolResultDiagnostics(spec,records=spec.prefetched||[]){
 const paths=[],seen=new Set()
 function read(ast){for(const p of referencePaths(ast)){
  paths.push(p)
  if(['data','derived'].includes(p[0])&&p[1]&&!seen.has(p.slice(0,2).join('.'))){
   seen.add(p.slice(0,2).join('.'));read(spec[p[0]]?.[p[1]])
  }
 }}
 function walk(nodes){for(const n of nodes||[]){read(n.props);read(n.value);walk(n.children)}}
 walk(spec.children)
 for(const steps of Object.values(spec.actions||{}))read(steps)
 for(const b of Object.values(spec.bindings||{}))read(b.input)
 const invokes=Object.values(spec.actions||{}).flat().filter(s=>s.type==='invoke')
 let scope
 const issues=[]
 for(const [id,b] of Object.entries(spec.bindings||{})){
  const calls=invokes.filter(s=>s.binding===id)
  if(!TOOLS[b.tool]?.readOnly||b.tool==='glm.generate'||(!calls.length&&b.load!=='visible'&&!b.refresh))continue
  if(calls.some(s=>s.target&&s.target!=='binding'))continue
  if(paths.some(p=>p[0]==='bindings'&&p[1]===id&&(p.length===2||p[2]==='value')))continue
  // Explicit response transactions are legitimate consumers, including stored
  // results that will only be shown after a later user action.
  if(calls.some(s=>s.onSuccess&&referencePaths(spec.actions?.[s.onSuccess]).some(p=>p[0]==='event'&&p[1]==='result')))continue
  let datasetRead=false
  for(const record of records){
   const invocation=prefetchedInvocation(record,records)
   if(invocation?.tool!==b.tool||!paths.some(p=>p[0]==='context'&&p[1]==='datasets'&&(p.length===2||p[2]===record.id)))continue
   try{scope??=makeScope(spec,createStore());if(canonicalInput(evaluate(b.input,scope))===canonicalInput(invocation.input)){datasetRead=true;break}}catch{}
  }
  if(datasetRead)continue
  issues.push({severity:'warning',code:'tool_result_unconsumed',message:`${id}: ${b.tool} can run, but this card does not read its result. Render bindings.${id}.value (or the matching prefetched dataset), or consume event.result in onSuccess; copied literal rows will not refresh. A host raw-results drawer alone does not update this card.`})
 }
 return issues.slice(0,8)
}
