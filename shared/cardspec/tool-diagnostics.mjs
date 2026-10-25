import {TOOLS} from './tools.mjs'
import {collectionRowBindings} from './tool-collection-state.mjs'
import {parseExpression} from './expression.mjs'
import {expressionPath as path} from './dataflow.mjs'
// Track collection provenance through aliases/filter/conditionals without
// fetching live data or evaluating actions. Empty initial arrays cannot hide a
// known tool-list identity contract from the normal one-repair generation loop.
export function toolCollectionDiagnostics(spec) {
 const result=[]
 const seenMessages=new Set()
 const stateKeyOrigins=new Map(),finds=[]
 const error=(code,message)=>{if(!seenMessages.has(message)){seenMessages.add(message);result.push({severity:'error',code,message})}}
 const origins=ast=>collectionRowBindings(spec,ast)
 function visit(ast,fn){if(!ast||typeof ast!=='object')return;fn(ast);for(const value of Object.values(ast))if(Array.isArray(value))value.forEach(v=>visit(v,fn));else if(value&&typeof value==='object')visit(value,fn)}
 function checkFilters(ast){visit(ast,part=>{
  if(part.type==='call'&&part.name==='find')finds.push(part)
  if(part.type!=='call'||part.name!=='filter')return
  for(const id of origins(part.args[0])){
   const binding=spec.bindings[id],tool=TOOLS[binding?.tool],fields=new Set()
   visit(part.args[1],x=>{const p=path(x);if(p?.[0]===(part.params?.[0]||'item'))fields.add(p.at(-1))})
   for(const [field,inputs] of Object.entries(tool?.filterInputs||{}))if(fields.has(field)&&inputs.some(key=>!binding.input?.entries?.some(([k])=>k===key)))error('tool_filter',`${id}: filter on ${field} after limit can omit matches. Put ${inputs.join('/')} in binding input (state-dependent if needed) so the host filters before limit; do not use local filtering as the primary query.`)
  }
 })}
 function booleanOutput(ast,locals,seen=new Set()){
  const p=path(ast)
  if(p){
   if(p[0]==='derived'&&!seen.has(p[1])){
    const next=new Set([...seen,p[1]])
    if(p.length===2)return booleanOutput(spec.derived[p[1]],locals,next)
    for(const id of origins(spec.derived[p[1]]))if(TOOLS[spec.bindings[id]?.tool]?.fieldTypes?.[p.at(-1)]==='boolean')return `${id}.${p.at(-1)}`
   }
   const ids=p[0]==='bindings'?[p[1]]:locals[p[0]]||[]
   for(const id of ids)if(TOOLS[spec.bindings[id]?.tool]?.fieldTypes?.[p.at(-1)]==='boolean')return `${id}.${p.at(-1)}`
  }
  if(ast?.type==='conditional')return booleanOutput(ast.yes,locals,seen)||booleanOutput(ast.no,locals,seen)
  if(ast?.type==='binary'&&['+','??'].includes(ast.op))return booleanOutput(ast.left,locals,seen)||booleanOutput(ast.right,locals,seen)
  return null
 }
 for(const ast of Object.values(spec.derived||{}))checkFilters(ast)
 function walk(nodes,locals={}){for(const node of nodes){
  for(const ast of Object.values(node.props||{}))checkFilters(ast)
  // An empty collection does not evaluate its predicate during preview. Catch
  // accidental self-comparisons before the first selection makes every row active.
  if(node.props?.selected)visit(node.props.selected,part=>{
   if(part.type!=='call'||!['count','find','filter','some','every'].includes(part.name))return
   visit(part.args[1],x=>{
    if(x.type!=='binary'||!['==','===','!=','!=='].includes(x.op))return
    const left=path(x.left),right=path(x.right)
    if(left?.[0]===(part.params?.[0]||'item')&&left.length>1&&JSON.stringify(left)===JSON.stringify(right))error('collection_predicate',`${node.id}: selected predicate compares the same row field with itself. Compare with the outer selected row instead.`)
   })
  })
  let childLocals=locals
  if(node.type==='each'){
   const ids=origins(node.props.items).filter(id=>TOOLS[spec.bindings[id]?.tool]?.provider==='opencli')
   if(ids.length){const key=path(node.props.itemKey),alias=node.props.as?.value||'item'
    childLocals={...locals,[alias]:ids,item:ids}
    if(!key||key.length!==2||![alias,'item'].includes(key[0])||key[1]!=='rowKey'){
     // React/template identity is owned by the host. This never rewrites
     // selected state, event args, business IDs or any action expression.
     node.props.itemKey=parseExpression(`${alias}.rowKey`)
     result.push({severity:'warning',code:'tool_identity_normalized',message:`${node.id}: tool row render keys normalized to ${alias}.rowKey; action parameters unchanged`})
    }
   }
  }
  for(const [event,handler] of Object.entries(node.props||{}))if(event.startsWith('on')&&handler.type==='literal'){
   const args=node.props.args?.entries||[]
   if(node.props.selected)for(const step of spec.actions[handler.value]||[]){
    if(step.type!=='append')continue
    const storedId=step.value?.entries?.find(([key])=>key==='id')?.[1],p=path(storedId)
    if(p?.[0]!=='args'||p.length!==2)continue
    const arg=args.find(([key])=>key===p[1])?.[1],ap=path(arg)
    if(ap?.length===2&&locals[ap[0]]?.length&&ap[1]!=='rowKey')error('tool_selection_identity',`${node.id}: selection args.${p[1]} uses ${ap.join('.')}. Store ${ap[0]}.rowKey in the local selection id and compare selected against it; titles/URLs/business IDs may repeat or be absent. Keep business IDs separately for detail-tool inputs.`)
   }
   for(const step of spec.actions[handler.value]||[])if(step.type==='set'){
    const value=step.value?.type==='call'&&['string','js:String'].includes(step.value.name)?step.value.args[0]:step.value,p=path(value)
    if(p?.[0]!=='args'||p.length!==2)continue
    let arg=args.find(([key])=>key===p[1])?.[1];if(arg?.type==='call'&&['string','js:String'].includes(arg.name))arg=arg.args[0]
    const ap=path(arg)
    if(ap?.at(-1)==='rowKey'&&locals[ap[0]])stateKeyOrigins.set(step.target,new Set([...(stateKeyOrigins.get(step.target)||[]),...locals[ap[0]]]))
   }
  }
  const displays=node.type==='run'?[node.value]:['text','caption','title','stat','badge'].includes(node.type)?[node.props?.value,node.props?.label]:[]
  for(const ast of displays){const field=booleanOutput(ast,locals);if(field)error('tool_field_type',`${field} is a boolean flag, not a count or quantity. Do not output it as raw text; use the tool's quantity fields (for train seats: second_seat/first_seat/etc), or explicitly label the boolean's documented meaning.`)}
  walk(node.children||[],childLocals)
 }}
 walk(spec.children||[])
 for(const ast of finds){const target=new Set(origins(ast.args[0]));if(!target.size)continue
  visit(ast.args[1],x=>{if(x.type!=='binary'||!['==','==='].includes(x.op))return
   for(const [a,b] of [[x.left,x.right],[x.right,x.left]]){const unwrap=v=>v?.type==='call'&&['string','js:String'].includes(v.name)?v.args[0]:v,pa=path(unwrap(a)),pb=path(unwrap(b))
    if(pa?.[0]===(ast.params?.[0]||'item')&&pa[1]==='rowKey'&&pb?.[0]==='state'){
     const sources=stateKeyOrigins.get(pb[1]);if(sources&&[...sources].some(id=>![...target].some(t=>spec.bindings[t]?.tool===spec.bindings[id]?.tool)))error('tool_identity_scope',`state.${pb[1]} stores a rowKey from another tool. rowKey is local to one tool result; join detail results with business IDs or use the returned detail row, not a search rowKey.`)
    }
   }
  })
 }
 return result
}
