import {CONTRACTS} from './contracts.mjs'
import {expressionPath} from './dataflow.mjs'

// Diagnose the whole action's producer set, not just the last failing caller.
export function sharedActionDiagnostics(spec){
 const callers=new Map(),issues=[]
 function walk(nodes,local=false){for(const n of nodes||[]){
  const inside=local||n.type==='logic'
  if(!inside)for(const [event,fields]of Object.entries(CONTRACTS[n.type]?.events||{})){
   const action=n.props?.[event]?.value;if(!action)continue
   const entries=callers.get(action)||[];entries.push({node:n.id,type:n.type,event,fields:Object.keys(fields),args:!!n.props.args});callers.set(action,entries)
  }
  walk(n.children,inside)
 }}walk(spec?.children)
 for(const [action,producers]of callers){
  if(producers.length<2)continue
  const signatures=new Set(producers.map(p=>JSON.stringify([p.fields,p.args])))
  if(signatures.size<2)continue
  const reads=(spec.actions?.[action]||[]).filter(s=>!s.when).flatMap(s=>[expressionPath(s.value),expressionPath(s.key)]).filter(p=>p?.length>=2&&['event','args'].includes(p[0])&&p[1]!=='args')
  const conflicts=reads.filter(p=>producers.some(c=>p[0]==='event'?!c.fields.includes(p[1]):!c.args))
  if(!conflicts.length)continue
  issues.push({severity:'error',code:'shared_action_payload',action,callers:producers,message:`Shared action ${action}: split selection/event and button/args handlers, or normalize ALL callers. Do not globally swap event and args. Incompatible callers: ${producers.map(p=>`${p.node} (${p.type}.${p.event}): event=[${p.fields.join(',')}], explicit args=${p.args?'yes':'no'}`).join('; ')}. Unconditional reads ${[...new Set(conflicts.map(p=>p.join('.')))].join(', ')} are not valid for every caller. Split the action by input channel (selection uses event; button uses args), or explicitly normalize every caller. Do not globally swap event and args: that breaks the other callers. Preserve all existing interactions.`})
 }
 return issues
}
