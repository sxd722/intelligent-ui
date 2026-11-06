import {expressionReads,referencePaths} from '../../shared/cardspec/dataflow.mjs'
import {canonicalInput,prefetchedInvocation} from '../../shared/cardspec/prefetch.mjs'
import {evaluate} from '../../shared/cardspec/expression.mjs'
import {createStore,makeScope} from '../../shared/cardspec/store.mjs'
import {validateTaskFields} from '../../shared/cardspec/task-operations.mjs'
import {slotContract} from '../../shared/cardspec/tool-slots.mjs'
// Repair invariants concern externally observable capabilities, not declaration
// IDs or layout. A renamed binding/action or a different native UI is legitimate.
export function repairCapabilities(spec,allowed=[],records=spec?.prefetched||[]){
 const enabled=new Set(allowed),capabilities=new Map()
 const add=(tool,kind)=>capabilities.set(`${tool}:${kind}`,{tool,kind})
 // A verified prefetched dataset plus a retained matching binding supplies the
 // same first-load capability without a redundant network call. Never infer
 // equivalence from literal rows, a similar title, or an unrelated dataset.
 const consumers=[spec?.children,spec?.actions],read=new Set(consumers.flatMap(ast=>expressionReads(spec,ast,'context')))
 const datasetPaths=[];const seen=new Set()
 function paths(ast){for(const p of referencePaths(ast)){
  if(p[0]==='context'&&p[1]==='datasets')datasetPaths.push(p)
  if(['data','derived'].includes(p[0])&&!seen.has(p.slice(0,2).join('.'))){seen.add(p.slice(0,2).join('.'));paths(spec[p[0]]?.[p[1]])}
 }}consumers.forEach(paths)
 let scope
 for(const b of Object.values(spec?.bindings||{}))if(enabled.has(b.tool)){
  if(b.load==='visible')add(b.tool,'automatic load')
  else if(read.has('datasets'))for(const record of records){
   const invocation=prefetchedInvocation(record,records)
   if(invocation?.tool!==b.tool||!datasetPaths.some(p=>p.length===2||p[2]===record.id)||!Object.hasOwn(spec.context?.datasets||{},record.id))continue
   try{scope??=makeScope(spec,createStore());if(canonicalInput(evaluate(b.input,scope))===canonicalInput(invocation.input))add(b.tool,'automatic load')}catch{}
  }
  if(b.refresh>0)add(b.tool,'refresh')
 }
 for(const steps of Object.values(spec?.actions||{}))for(const s of steps)if(s.type==='invoke'){
  const tool=spec.bindings?.[s.binding]?.tool
  // Only GLM can generate pages/slots. An invalid CLI target may legitimately
  // be repaired to a normal data invocation; preserve the actual capability.
  if(enabled.has(tool))add(tool,tool==='glm.generate'&&s.target?.startsWith('slot:')?'invoke slot':tool==='glm.generate'&&s.target==='page'?'invoke page':'invoke data')
 }
 // Keeping an unused action declaration is not keeping its user interaction.
 // Track the event-to-invoke path independently of labels and node/action IDs.
 const reached=new Set()
 function reachable(action){
  if(typeof action!=='string'||reached.has(action))return
  reached.add(action)
  for(const step of spec?.actions?.[action]||[])if(step.type==='invoke'){
   const tool=spec.bindings?.[step.binding]?.tool
   if(enabled.has(tool))add(tool,'user reachable invoke')
   reachable(step.onSuccess);reachable(step.onError)
  }
 }
 function eventPaths(nodes){for(const node of nodes||[]){
  for(const [key,ast] of Object.entries(node.props||{}))if(/^on[A-Z]/.test(key)&&ast.type==='literal')reachable(ast.value)
  // Bridge actions are explicit mappings; code is not interpreted here.
  if(['sandbox','logic'].includes(node.type))for(const [,ast] of node.props.actions?.entries||[])if(ast.type==='literal')reachable(ast.value)
  eventPaths(node.children)
 }}eventPaths(spec?.children)
 const taskViews=nodes=>{for(const node of nodes||[]){
  if(node.type==='tool-view'&&node.props.task){const binding=spec.bindings?.[node.props.binding?.value]
   if(binding&&enabled.has(binding.tool))try{
    scope??=makeScope(spec,createStore());const task=evaluate(node.props.task,scope);validateTaskFields(task,slotContract(binding.tool))
    add(binding.tool,'task '+canonicalInput({input:evaluate(binding.input,scope),where:task.where||[],selection:task.pin?'single':task.selection||(task.compare?'multiple':'single'),max:task.pin||!task.compare&&task.selection!=='multiple'?1:task.max||2,pin:task.pin||null,compare:!!task.compare,groupBy:task.groupBy||null,aggregate:task.aggregate||null}))
   }catch{/* Invalid initial drafts must remain repairable. */}
  }taskViews(node.children)
 }};taskViews(spec?.children)
 return [...capabilities.values()]
}
export function lostRepairCapabilities(before,after){
 const keys=new Set(after.map(c=>`${c.tool}:${c.kind}`))
 const lost=before.filter(c=>!keys.has(`${c.tool}:${c.kind}`))
 return lost.filter(c=>c.kind!=='user reachable invoke'||!lost.some(other=>other.tool===c.tool&&other.kind.startsWith('invoke '))).map(c=>({severity:'error',code:'repair_capability_lost',message:`Repair removed ${c.tool} (${c.kind}). Preserve this enabled tool capability while fixing syntax/data flow; static text or prefetched evidence is not a replacement for a declared live/user-triggered capability.`}))
}
