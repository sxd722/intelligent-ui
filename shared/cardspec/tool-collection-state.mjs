import {expressionPath as path} from './dataflow.mjs'
import {evaluate} from './expression.mjs'
export function collectionBindings(spec,ast,seen=new Set(),{rowsOnly=false,scope}={}){
  if(!ast||typeof ast!=='object')return []
  const descend=(value,next=seen)=>collectionBindings(spec,value,next,{rowsOnly,scope})
  const alternatives=(a,b)=>{
    const left=descend(a),right=descend(b)
    const empty=n=>n?.type==='array'&&!n.items.length||n?.type==='literal'&&n.value==null||n?.type==='undefined'
    return rowsOnly&&(!left.length&&!empty(a)||!right.length&&!empty(b))?[]:[...left,...right]
  }
  const p=path(ast)
  if(p?.[0]==='bindings'&&p[2]==='value'&&p[3]==='items')return [p[1]]
  if(['derived','data'].includes(p?.[0])&&p.length===2&&!seen.has(p.join('.')))return descend(spec[p[0]]?.[p[1]],new Set([...seen,p.join('.')]))
  if(ast.type==='chain')return descend(ast.value)
  if(ast.type==='call'&&['filter','find','method:slice'].includes(ast.name))return descend(ast.args[0])
  if(ast.type==='call'&&ast.name==='map')return !rowsOnly||preservesRowKey(ast.args[1],ast.params?.[0]||'item')?descend(ast.args[0]):[]
  if(ast.type==='conditional')return scope?descend(evaluate(ast.test,scope)?ast.yes:ast.no):alternatives(ast.yes,ast.no)
  if(ast.type==='binary'&&ast.op==='??')return scope?descend(evaluate(ast.left,scope)!=null?ast.left:ast.right):alternatives(ast.left,ast.right)
  return []
}
// Data lineage is broader than row identity. A map to labels/statistics still
// depends on its tool result, but must not have its render keys rewritten to
// rowKey. Only normalize identity when the projection provably preserves it.
function preservesRowKey(ast,parameter){
 const sameRow=value=>path(value)?.length===1&&path(value)[0]===parameter
 const sameKey=value=>{const p=path(value);return p?.length===2&&p[0]===parameter&&p[1]==='rowKey'}
 if(sameRow(ast))return true
 if(ast?.type==='chain')return preservesRowKey(ast.value,parameter)
 if(ast?.type==='conditional')return preservesRowKey(ast.yes,parameter)&&preservesRowKey(ast.no,parameter)
 if(ast?.type!=='object')return false
 let preserved=false
 for(const [key,value]of ast.entries){
  if(key===null&&value?.type==='spread')preserved=sameRow(value.value)
  else if(key==='rowKey')preserved=sameKey(value)
  else if(typeof key!=='string')preserved=false
 }
 return preserved
}
export const collectionRowBindings=(spec,ast)=>collectionBindings(spec,ast,new Set(),{rowsOnly:true})
// Static diagnostics need all possible sources. Runtime leases need only the
// branch actually rendered; an idle alternative must not block valid rows.
export const activeCollectionBindings=(spec,ast,scope,{rowsOnly=false}={})=>collectionBindings(spec,ast,new Set(),{rowsOnly,scope})
// Detect a hidden result set without changing model filters or fetching data.
export function filteredCollectionSources(spec,ast,items,bindings,scope){
  if(!Array.isArray(items)||items.length)return []
  return [...new Set(collectionBindings(spec,ast,new Set(),{scope}))].flatMap(id=>{
    const b=bindings?.[id],count=b?.value?.items?.length
    return b?.status==='success'&&count>0?[{id,count}]:[]
  })
}
