import {expressionReads,expressionPath,visitExpression,referencePaths} from './dataflow.mjs'
import {evaluate} from './expression.mjs'
import {makeScope,createStore} from './store.mjs'
import {navigationDiagnostics} from './navigation-diagnostics.mjs'

const controls=new Set(['input','textarea','slider','segmented','select','radio-group','checkbox','checklist','toggle'])
const outputTypes=new Set(['text','title','caption','strong','stat','facts','checklist','detail-stage','chart','each','collection','task-board','tool-view','map','heatmap','flowchart','mindmap','sandbox','logic','progress','table','countdown'])
const nodes=children=>(children||[]).flatMap(n=>[n,...nodes(n.children)])
const resultAst=n=>[n.value,...(n.type==='each'?[]:nodes(n.children).filter(c=>c.type==='run').map(c=>c.value)),...Object.entries(n.props||{}).filter(([k])=>!/^on[A-Z]/.test(k)&&!['args','label','selectedId','selectedIds','clamp','tone','motionKey','motion','surface','space','variant'].includes(k)).map(([,v])=>v)]

// Structural dependency gate: does not guess the business impact of arbitrary JS.
// A transactional state copy is followed so legitimate staged forms count.
export function taskBehaviorDiagnostics(spec){
 if(!spec)return []
 const all=nodes(spec.children),outputs=all.filter(n=>outputTypes.has(n.type)),issues=[]
 // Only enforce host-supplied, inferred stable selector domains. Unconstrained
 // records and locally-created entity IDs keep their existing semantics.
 const shared=spec.context?.deckInterface?.states||{}
 if(Object.values(shared).some(s=>s.keyDomain?.length||s.valueType)){
  let scope;try{scope=makeScope(spec,createStore())}catch{}
  if(scope){
   for(const step of Object.values(spec.actions||{}).flat()){
    const field=shared[step.target];if(!field?.valueType||step.type!=='set')continue
    let value;try{value=evaluate(step.value,scope)}catch{continue}
    const values=step.key?[value]:value&&typeof value==='object'?Object.values(value):[]
    if(values.some(v=>v!=null&&(typeof v!==field.valueType||field.values&&!field.values.includes(v))))issues.push({severity:'error',code:'deck_value_encoding',message:`Shared state ${step.target} requires ${field.valueType} values ${JSON.stringify(field.values||[])} from the first card; preserve that encoding instead of inventing different status labels.`})
   }
   for(const ast of [...Object.values(spec.derived||{}),...all.flatMap(n=>[n.value,...Object.values(n.props||{})])])visitExpression(ast,node=>{
   if(node.type==='binary'&&['==','===','!=','!=='].includes(node.op))for(const [a,b]of [[node.left,node.right],[node.right,node.left]]){
    const p=a?.type==='get'?expressionPath(a.object):null,field=p?.length===2&&p[0]==='state'?shared[p[1]]:null
    if(field?.valueType&&b?.type==='literal'&&b.value!=null&&typeof b.value!==field.valueType)issues.push({severity:'error',code:'deck_value_encoding',message:`Shared state ${p[1]} contains ${field.valueType} values; comparing it with ${JSON.stringify(b.value)} cannot reflect the sibling's state.`})
   }
   if(node.type!=='get')return
   const p=expressionPath(node.object),domain=p?.length===2&&p[0]==='state'?shared[p[1]]?.keyDomain:null
   if(!domain?.length)return
   let key;try{key=evaluate(node.key,scope)}catch{return}
   if(key!=null&&key!==''&&!domain.includes(key))issues.push({severity:'error',code:'deck_entity_key',message:`Shared state ${p[1]} uses entity IDs ${domain.join(', ')}; key ${JSON.stringify(key)} belongs to another namespace. Map the selected child to its parent entity before reading/writing this shared record; do not rename host IDs.`})
  })}
 }
 for(const node of all.filter(n=>controls.has(n.type))){
  const inputs=expressionReads(spec,[node.props?.value,node.props?.checked],'state')
  for(const input of inputs){
   const reachable=new Set([input]);let changed=true
   // The originating input event is a dependency too. Its transaction may set
   // a literal dirty/invalid flag rather than copy the edited value. Follow
   // only this control's declared handlers, never arbitrary other actions.
   for(const [key,ast]of Object.entries(node.props||{}))if(/^on[A-Z]/.test(key)){
    const steps=spec.actions?.[ast?.value]||[]
    if(steps.some(s=>s.target===input))for(const step of steps)if(step.target)reachable.add(step.target)
   }
   while(changed){changed=false;for(const steps of Object.values(spec.actions||{}))for(const step of steps)if(step.target&&!reachable.has(step.target)&&[...expressionReads(spec,step.value,'state'),...expressionReads(spec,step.value,'next')].some(k=>reachable.has(k))){reachable.add(step.target);changed=true}}
   const result=outputs.some(n=>expressionReads(spec,resultAst(n),'state').some(k=>reachable.has(k)))
   const effect=Object.values(spec.bindings||{}).some(b=>expressionReads(spec,b.input,'state').some(k=>reachable.has(k)))||Object.values(spec.actions||{}).flat().some(s=>s.type==='invoke'&&expressionReads(spec,s.input,'state').some(k=>reachable.has(k)))
   const condition=all.some(n=>n.type==='if'&&expressionReads(spec,n.props?.test,'state').some(k=>reachable.has(k)))
   // Free text / checklists can be useful as persisted records themselves.
   // Their business meaning requires a behavior assertion; absence of a
   // downstream consumer alone must not reject a valid notes/form card.
   const persistedField=['textarea','checkbox','checklist','toggle'].includes(node.type)||node.type==='input'&&(!node.props.inputType||node.props.inputType.value==='text')
   if(!result&&!effect&&!condition)issues.push({severity:persistedField?'warning':'error',code:'task_input_unconsumed',node:node.id,message:`${node.id}: state.${input} has no detected task result/query consumer. Persisted notes/checklists are valid on their own; task parameters need an input-to-result assertion. Keep required controls: derive the result, query, or show a stale state after changes instead of claiming old results remain valid.`})
  }
 }
 const seen=new Map()
 for(const n of all.filter(n=>n.type==='button'&&n.props.onPress&&n.props.label?.type==='literal')){
  const signature=JSON.stringify([n.props.onPress,n.props.args]),label=n.props.label.value
  if(seen.has(signature)&&seen.get(signature)!==label)issues.push({severity:'warning',code:'interaction_equivalent',node:n.id,message:`${seen.get(signature)} / ${label}: identical action and arguments. If these express different user intents, give them distinct visible results; otherwise keep one clear entry. This is a review warning, not an automatic rewrite request.`})
  else seen.set(signature,label)
 }
 return [...navigationDiagnostics(spec),...issues,...selectionRelationDiagnostics(spec)].slice(0,6)
}

// Validate only explicit equality joins, using materialized initial rows. No
// effects, guessed entity mappings, domain rules or empty remote assumptions.
export function selectionRelationDiagnostics(spec){
 const issues=[];let scope;try{scope=makeScope(spec,createStore())}catch{return []}
 for(const node of nodes(spec.children).filter(n=>['chart','mindmap','flowchart','segmented','select','radio-group'].includes(n.type)&&(n.props?.onSelect||n.props?.onChange))){
  let plotted;try{plotted=evaluate(node.props.data||node.props.nodes||node.props.options,scope)}catch{continue}
  if(!Array.isArray(plotted)||!plotted.length||plotted.length>100)continue
  const assignments=(spec.actions?.[(node.props.onSelect||node.props.onChange).value]||[]).filter(s=>s.type==='set'&&['event.id','event.value'].includes(expressionPath(s.value)?.join('.')))
  const targets=[...new Set(assignments.map(s=>s.target))]
  for(const target of targets)for(const ast of Object.values(spec.derived||{}))visitExpression(ast,call=>{
   if(!['find','filter'].includes(call.name)||call.type!=='call')return
   // A topic can legitimately have no optional exercises/results. Only reject
   // a selector's missing detail when it is silently replaced by an unrelated
   // first row. Charts retain their positive-count drilldown conservation rule.
   if(node.type!=='chart'){
    let wrongFallback=false
    visitExpression(ast,parent=>{if(parent.type==='binary'&&['??','||'].includes(parent.op)&&parent.left===call&&parent.right?.type==='get'&&parent.right.key?.value===0&&JSON.stringify(parent.right.object)===JSON.stringify(call.args?.[0]))wrongFallback=true})
    if(!wrongFallback)return
   }
   const alias=call.params?.[0]||'item';let field
   visitExpression(call.args?.[1],part=>{if(part.type!=='binary'||!['==','==='].includes(part.op))return
    for(const [a,b]of [[part.left,part.right],[part.right,part.left]]){const p=expressionPath(a),q=expressionPath(b);if(p?.length===2&&p[0]===alias&&q?.join('.')===`state.${target}`)field=p[1]}
   })
   if(!field)return
   let rows;try{rows=evaluate(call.args[0],scope)}catch{return}
   if(!Array.isArray(rows)||!rows.length||rows.length>1000||rows.some(r=>!r||!Object.hasOwn(r,field)))return
   const identity=r=>typeof r==='object'?(node.props.options?r.value:r.id):r
   const canAssign=r=>assignments.filter(s=>s.target===target).some(s=>{
    if(!s.when)return true
    // A data-only membership guard explicitly separates node kinds. Never
    // infer an unreachable branch from one initial state or tool response.
    if(['state','next','bindings'].some(root=>expressionReads(spec,s.when,root).length))return true
    try{return !!evaluate(s.when,{...scope,event:{id:identity(r),value:identity(r),item:r}})}catch{return true}
   })
   const missing=plotted.filter(r=>identity(r)!=null&&canAssign(r)&&(node.type!=='chart'||r.value>0)&&!rows.some(item=>String(item[field])===String(identity(r))))
   if(missing.length)issues.push({severity:'error',code:'selection_relation_mismatch',node:node.id,message:`${node.id}: selectable ids ${missing.slice(0,4).map(r=>JSON.stringify(identity(r))).join(', ')} have no matching ${field} in the collection queried by state.${target}. Add corresponding detail or explicitly handle this branch; fallback to the first item is not a matching answer. Preserve the control and entity IDs.`})
  })
 }
 return issues.slice(0,2)
}

export function taskBehaviorCoverage(spec,browser){
 const inputs=nodes(spec?.children).filter(n=>controls.has(n.type)).map(n=>({id:n.id,states:expressionReads(spec,[n.props?.value,n.props?.checked],'state')})).filter(n=>n.states.length)
 const actions=(browser?.runs||[]).flatMap(r=>r.scenario==='normal'?r.actions||[]:[])
 const items=inputs.map(n=>({...n,status:actions.some(a=>a.ok&&a.assertion?.passed&&n.states.some(k=>a.stateKeysChanged?.includes(k))&&(a.step.expect?.changedResults?.length||a.step.expect?.derived||a.step.expect?.tool||a.step.expect?.sandboxChanged||a.step.expect?.text&&a.resultChanged===true))?'checked':'unverified'}))
 return {status:items.every(x=>x.status==='checked')?'checked':'partial',items,scope:'Explicit input-to-result assertions only; not proof of factual truth or full business semantics.'}
}

// Evaluate output props, not input echoes. Used by browser assertions and saved
// traces. Scoped each children are excluded; their parent items are the output.
export function taskOutputSnapshot(spec,scope){
 const out={};let budget=20000
 function capture(id,value){const json=JSON.stringify(value);if(json===undefined)return
  if(json.length<=Math.min(4000,budget)){out[id]=value;budget-=json.length}
  else{let a=2166136261,b=5381;for(let i=0;i<json.length;i++){a=Math.imul(a^json.charCodeAt(i),16777619);b=Math.imul(b,33)^json.charCodeAt(i)}out[id]={digest:(a>>>0).toString(16)+':'+(b>>>0).toString(16),characters:json.length};budget-=100}
 }
 function regionResult(children,local){const values=[];for(const n of children||[]){
  if(n.type==='if'&&!evaluate(n.props.test,local))continue
  if(n.type==='each'){
   const rows=evaluate(n.props.items,local);if(Array.isArray(rows))for(const [index,item]of rows.slice(0,100).entries())values.push(regionResult(n.children,{...local,item,[n.props.as?.value||'item']:item,index}))
  }else{if(outputTypes.has(n.type)&&!controls.has(n.type))values.push(resultAst({...n,children:[]}).map(ast=>evaluate(ast,local)));if(n.type==='run')values.push(evaluate(n.value,local));values.push(...regionResult(n.children,local))}
 }return values}
 function walk(children){for(const n of children||[]){
  if(n.type==='if'){try{if(!evaluate(n.props.test,scope))continue}catch{continue}}
  if(outputTypes.has(n.type)&&n.id){try{const asts=resultAst(n);capture(n.id,asts.map(ast=>evaluate(ast,scope)))
   // Derived collections consumed by output are valid result targets. Do not
   // expose arbitrary state/derived control echoes as a task result.
   for(const p of referencePaths(asts))if(p[0]==='derived'&&p[1]&&!Object.hasOwn(out,p[1]))capture(p[1],scope.derived[p[1]])
  }catch{}}
  if(n.type==='region'&&n.id){try{const value=regionResult(n.children,scope),json=JSON.stringify(value);if(json.length<=budget){out[n.id]=value;budget-=json.length}}catch{}}
  if(n.type!=='each')walk(n.children)
 }}walk(spec.children);return out
}

// Once an explicit executable behavior path has been attempted, a later source
// may not obtain a pass by dropping its failing result assertions.
export function createBehaviorLedger(){
 const paths=[]
 const substantive=s=>s.expect&&(s.expect.navigation||s.expect.changedResults?.length||s.expect.derived||s.expect.tool||s.expect.changedKeys?.length||s.expect.relations?.length||s.expect.controls?.length||s.expect.sandboxChanged||s.requirement)
 return {
  observe(steps,run){
   if(!steps.length||!run||run.actions.length!==steps.length||!run.actions.every(a=>a.ok))return
   if(!steps.some(substantive))return
   const copy=structuredClone(steps),key=JSON.stringify(copy)
   if(!paths.some(p=>JSON.stringify(p)===key)&&paths.length<8)paths.push(copy)
  },
  paths:()=>structuredClone(paths),
  // Called only after the host's oracle-conflict review and a successful
  // same-source, same-operation test-only rerun. Ordinary failures stay pinned.
  revise(original,replacement){const i=paths.findIndex(p=>JSON.stringify(p)===JSON.stringify(original));if(i>=0)paths[i]=structuredClone(replacement)},
  missing(tested=[]){return paths.filter(p=>!tested.some(t=>JSON.stringify(t)===JSON.stringify(p)))},
 }
}
