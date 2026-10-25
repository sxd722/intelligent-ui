import {evaluate} from '../../shared/cardspec/expression.mjs'
import {eventSamples} from '../../shared/cardspec/registry.mjs'
import {executeLogic} from '../../shared/cardspec/logic-engine.mjs'
import {validateLogicView} from '../../shared/cardspec/logic-view.mjs'
import {numericViewPaths,validateNumericTransition} from './logic-diagnostics.mjs'

// Final-generation harness only. Exercise actual component event payloads in
// isolated QuickJS. Never dispatch the logic.actions host bridge or any effect.
export function probeLogicInteractions(QuickJS,node,scope,state,{limit=16}={}){
 const started=Date.now()
 const source=evaluate(node.props.source,scope),input=node.props.input?evaluate(node.props.input,scope):{}
 const numericPaths=numericViewPaths(node.children)
 const queue=[{state,depth:0}],seen=new Set(),seenControls=new Set();let probes=0,visited=0
 function controls(nodes,local,out=[]){
  for(const n of nodes||[]){
   if(++visited>2400)return out
   if(n.type==='run')continue
   const p=Object.fromEntries(Object.entries(n.props||{}).filter(([k])=>!['args','itemKey'].includes(k)).map(([k,v])=>[k,evaluate(v,local)]))
   if(p.visible===false||n.type==='if'&&!p.test)continue
   if(n.type==='each'){for(const [index,item]of(p.items||[]).slice(0,20).entries())controls(n.children,{...local,item,index,[p.as||'item']:item},out);continue}
   if(!p.disabled)for(const [name,sample]of Object.entries(eventSamples(n.type,p,scope.context))){
    if(!p[name])continue
    let samples=[sample]
    if(['select','segmented','radio-group'].includes(n.type))samples=(p.options||[]).slice(0,6).map(o=>({value:typeof o==='object'?o.value:o}))
    if(n.type==='slider')samples=[{value:p.min??0},{value:p.max??100}]
    for(const sample of samples){const event={...sample,type:p[name],args:n.props.args?evaluate(n.props.args,{...local,event:sample}):{}};out.push({nodeId:n.id,event})}
   }
   controls(n.children,local,out)
  }
  return out
 }
 while(queue.length&&probes<limit){
  // Explore all states in the next layer before choosing probes. Otherwise a
  // slider's first branch consumes the budget repeating controls, and buttons
  // newly exposed by a later tab are never checked.
  const candidates=queue.splice(0).flatMap(current=>controls(node.children,{...scope,local:current.state}).map(control=>({current,control})))
  candidates.sort((a,b)=>Number(seenControls.has(a.control.nodeId+':'+a.control.event.type))-Number(seenControls.has(b.control.nodeId+':'+b.control.event.type)))
  for(const {current,control} of candidates){
   const token=JSON.stringify([current.state,control.event]);if(seen.has(token))continue;seen.add(token)
   if(probes>=limit)break;probes++;seenControls.add(control.nodeId+':'+control.event.type)
   try{
    const next=executeLogic(QuickJS,{source,state:current.state,event:control.event,input})
    validateNumericTransition(current.state,next,numericPaths)
    validateLogicView(node.children,{...scope,local:next},{strictLocalValues:true})
    if(current.depth<1&&JSON.stringify(next)!==JSON.stringify(current.state))queue.push({state:next,depth:current.depth+1})
   }catch(e){throw Error(`logic ${node.id}, ${control.nodeId} event ${control.event.type}: ${e.message}. Check the component's actual event value and the resulting view; no host action was executed.`)}
  }
 }
 return {probes,depth:2,limit,elapsedMs:Date.now()-started}
}
