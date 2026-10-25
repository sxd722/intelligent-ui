import {expressionPath,expressionReads,visitExpression} from './dataflow.mjs'
import {makeScope} from './store.mjs'
import {evaluate} from './expression.mjs'

// Conservative, effect-free checks. Optional remote fields keep null semantics.
export function feedbackDiagnostics(spec){
 const issues=[],seen=new Set(),nodes=[]
 const add=(severity,code,message)=>{if(!seen.has(message)){seen.add(message);issues.push({severity,code,message})}}
 function rows(ast,trail=new Set()){
  if(ast?.type==='array'&&ast.items.length&&ast.items.every(x=>x.type==='object'))return ast.items
  const p=expressionPath(ast)
  if(p?.length===2&&['data','derived'].includes(p[0])&&!trail.has(p.join('.')))return rows(spec[p[0]][p[1]],new Set([...trail,p.join('.')]))
  if(ast?.type==='call'&&ast.name==='filter')return rows(ast.args[0],trail)
 }
 function check(ast,locals={}){
  if(!ast||typeof ast!=='object')return
  const p=expressionPath(ast),known=p&&locals[p[0]]
  if(known&&p.length>=3&&['state','data','derived','bindings','next'].includes(p[1])&&!known.some(r=>r.entries.some(([k])=>k===p[1]))&&Object.hasOwn(spec[p[1]==='next'?'state':p[1]]||{},p[2]))
   add('error','expression_shadowed_root',`${p.slice(0,3).join('.')}: literal rows have no ${p[1]} field. Use host scope ${p[1]}.${p[2]} directly; ${p[0]} is only the current row.`)
  if(ast.type==='call'&&['filter','find','map','sum','count','some','every','findIndex','reduce'].includes(ast.name)){
   const rowParam=ast.params?.[ast.name==='reduce'?1:0]||'item'
   check(ast.args[0],locals);if(ast.args[1])check(ast.args[1],{...locals,[rowParam]:rows(ast.args[0])});ast.args.slice(2).forEach(arg=>check(arg,locals));return
  }
  for(const v of Object.values(ast))if(Array.isArray(v))v.flat().forEach(x=>check(x,locals));else if(v&&typeof v==='object')check(v,locals)
 }
 function walk(list,locals={}){for(const n of list||[]){nodes.push(n);check(n.props,locals);check(n.value,locals);walk(n.children,n.type==='each'?{...locals,[n.props.as?.value||'item']:rows(n.props.items),item:rows(n.props.items)}:locals)}}
 for(const root of ['data','derived','actions','bindings'])check(spec[root])
 walk(spec.children)
 // A collection length is reusable after deletion. Warn about IDs derived
 // from it, without inventing a new identity or changing user data silently.
 const shrinkable=new Set()
 for(const steps of Object.values(spec.actions))for(const step of steps){
  if(spec.state[step.target]?.type!=='array')continue
  if(step.type==='remove')shrinkable.add(step.target)
  if(step.type==='set')visitExpression(step.value,ast=>{
   if(ast.type==='call'&&ast.name==='filter'&&expressionReads(spec,ast.args[0],'state').includes(step.target))shrinkable.add(step.target)
  })
 }
 for(const [action,steps]of Object.entries(spec.actions))for(const step of steps){
  if(!shrinkable.has(step.target))continue
  visitExpression(step.value,ast=>{
   if(ast.type!=='object')return
   for(const [field,value]of ast.entries)if(['id','rowKey'].includes(field))visitExpression(value,part=>{
    const p=expressionPath(part)
    if(p?.length===3&&['state','next'].includes(p[0])&&p[1]===step.target&&p[2]==='length')
     add('warning','collection_reused_identity',`${action}: new ${field} depends on deletable state.${step.target}.length. Deleting then adding can reuse an existing ID; use a separate monotonically increasing counter or the source's stable ID.`)
   })
  })
 }
 const editor=new Set(['input','textarea','select','segmented','radio-group','slider'])
 // Free-form notes can be useful solely as editable, persisted text.
 for(const n of nodes.filter(n=>editor.has(n.type)&&n.type!=='textarea'&&!(n.type==='input'&&(!n.props.inputType||n.props.inputType.value==='text')))){
  const handler=n.props.onChange?.value
  for(const step of spec.actions[handler]||[]){
   if(step.type!=='set')continue
   const id=step.target
   const consumed=nodes.some(other=>expressionReads(spec,{value:other.value,props:Object.fromEntries(Object.entries(other.props||{}).filter(([k])=>!(editor.has(other.type)&&['value','onChange','args'].includes(k))))},'state').includes(id))
    ||Object.values(spec.actions).flat().some(s=>expressionReads(spec,{value:s.value,key:s.key,when:s.when,input:s.input},'state').includes(id)||expressionReads(spec,{value:s.value,key:s.key,when:s.when,input:s.input},'next').includes(id))
    ||Object.values(spec.bindings||{}).some(b=>expressionReads(spec,b.input,'state').includes(id))
   if(!consumed)add('warning','interaction_unconsumed_state',`${n.id}: state.${id} only echoes the editable value. Connect it to a result/filter/tool input, or make its draft-only purpose explicit.`)
  }
 }
 return issues
}

// Observe content, not only state changes or echoed input values. This is a
// bounded signal, not an oracle for domain correctness (e.g. a math formula).
export function observableContent(spec,store,extra={}){
 const output=[];let visited=0
 function walk(nodes,scope){for(const n of nodes||[]){if(++visited>600)return
  try{
   if(n.type==='run'){output.push(evaluate(n.value,scope));continue}
   if(n.type==='logic')continue
   const p=Object.fromEntries(Object.entries(n.props||{}).filter(([k])=>!['args','itemKey'].includes(k)).map(([k,v])=>[k,evaluate(v,scope)]))
   if(p.visible===false||n.type==='if'&&!p.test)continue
   if(n.type==='each'){for(const [index,item]of(p.items||[]).slice(0,40).entries())walk(n.children,{...scope,item,index,[p.as||'item']:item});continue}
   if(n.type==='region'&&p.overflow==='details')continue
   const props=['stat','progress','chart','table','image','mindmap','flowchart','mermaid','collection'].includes(n.type)?p:{label:p.label}
   output.push({type:n.type,props:Object.fromEntries(Object.entries(props).filter(([k])=>!k.startsWith('on')&&!['args','selectedId','index'].includes(k)))})
   walk(n.children,scope)
  }catch{}}
 }
 walk(spec.children,makeScope(spec,store,extra))
 return JSON.stringify(output)
}
