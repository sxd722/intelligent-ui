// Shared, effect-free dataflow analysis. No model or network calls here.
export function expressionPath(ast) {
  if(ast?.type==='chain')return expressionPath(ast.value)
  if(ast?.type==='ref')return [ast.name]
  if(ast?.type==='get'&&ast.key?.type==='literal'){const p=expressionPath(ast.object);if(p)return [...p,ast.key.value]}
  return null
}
export function visitExpression(ast,fn){
  if(!ast||typeof ast!=='object')return
  fn(ast)
  for(const value of Object.values(ast))if(Array.isArray(value))value.flat().forEach(v=>visitExpression(v,fn));else if(value&&typeof value==='object')visitExpression(value,fn)
}
export function referencePaths(ast){
  const p=expressionPath(ast);if(p)return [p]
  if(!ast||typeof ast!=='object')return []
  return Object.values(ast).flat().flatMap(v=>referencePaths(v))
}
export function expressionReads(spec,ast,root,seen=new Set()){
  const reads=new Set()
  visitExpression(ast,node=>{
    const p=expressionPath(node)
    if(p?.[0]===root&&p.length>=2)reads.add(p[1])
    if(['derived','data'].includes(p?.[0])&&!seen.has(p.slice(0,2).join('.'))){
      const token=p.slice(0,2).join('.'),next=new Set([...seen,token])
      for(const id of expressionReads(spec,spec[p[0]]?.[p[1]],root,next))reads.add(id)
    }
  })
  return [...reads]
}
export function bindingDependencies(spec,id,input=spec.bindings?.[id]?.input){
  return [...new Set([...(spec.bindings?.[id]?.requires||[]),...expressionReads(spec,input,'bindings')])]
}
export const businessIdField=key=>/^(id|uid|.*Id|.*_id|sku|trainNo|train_no)$/.test(key)
export function validateBusinessIds(input,bindings={}){
  const rows=Object.values(bindings).flatMap(b=>b.value?.items||[])
  const rowKeys=new Set(rows.map(row=>row.rowKey).filter(Boolean))
  // Some sources use the original business ID as their stable selection key.
  // Reject an opaque rowKey, but do not reject an ID proven by the source field.
  const original=(field,value)=>rows.some(row=>row[field]!=null&&String(row[field])===value)
  for(const [field,value] of Object.entries(input||{}))if(businessIdField(field)&&typeof value==='string'&&(value.startsWith('row:')||rowKeys.has(value)&&!original(field,value)))
    throw new Error(`${field}: rowKey is a UI selection key, not a business ID. Pass the selected row's original ${field} (keep the full row when selecting).`)
}
