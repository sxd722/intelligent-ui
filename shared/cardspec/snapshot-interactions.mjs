import {createStore,makeScope,executeAction} from './store.mjs'
import {evaluate} from './expression.mjs'
import {canonicalInput} from './prefetch.mjs'

// Pure, bounded action probes against host-owned read snapshots. Effects are
// only calculated, never dispatched. This catches fixture-invented ID fields.
export function snapshotInteractionDiagnostics(spec,records=[]){
 if(!spec||!records.length)return []
 const store=createStore(),bindings={},issues=[];let probes=0
 try{
  const initial=makeScope(spec,store)
  for(const [id,b]of Object.entries(spec.bindings||{})){
   let input;try{input=evaluate(b.input,initial)}catch{continue}
   const r=records.find(r=>r.tool===b.tool&&canonicalInput(r.input)===canonicalInput(input))
   if(r)bindings[id]={status:'success',value:r.value,updatedAt:r.updatedAt||r.value?.fetchedAt}
  }
  if(!Object.keys(bindings).length)return []
  function walk(nodes,locals={}){
   const scope={...makeScope(spec,store,{bindings}),...locals}
   for(const n of nodes||[]){if(probes>=24)return
    try{
     if(n.type==='if'&&!evaluate(n.props.test,scope))continue
     if(n.type==='each'){
      const rows=evaluate(n.props.items,scope),alias=evaluate(n.props.as,scope)||'item'
      if(Array.isArray(rows))for(const [i,row]of rows.slice(0,3).entries())walk(n.children,{...locals,[alias]:row,index:i})
      continue
     }
     if(n.props.onPress&&n.props.args&&!evaluate(n.props.disabled,scope)){
      const action=evaluate(n.props.onPress,scope),args=evaluate(n.props.args,scope)
      if(spec.actions?.[action]){
       probes++
       try{executeAction(spec,structuredClone(store),action,{bindings,args,event:{...(args&&typeof args==='object'?args:{}),args}})}
       catch(e){issues.push({severity:'error',code:'snapshot_action_invalid',node:n.id,message:`${action}: actual tool snapshot cannot execute this control: ${e.message}. Available argument fields: ${Object.keys(args||{}).join(', ')}. Preserve original entity fields; do not infer id from rowKey.`})}
      }
     }
     walk(n.children,locals)
    }catch{/* Missing dependent data is not an implementation failure. */}
   }
  }
  walk(spec.children)
 }catch{/* Snapshot cannot initialize this state; leave to browser diagnostics. */}
 return issues.filter((d,i,a)=>a.findIndex(x=>x.node===d.node)===i).slice(0,4)
}
