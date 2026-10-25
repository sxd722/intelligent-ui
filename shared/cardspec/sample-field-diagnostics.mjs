import {evaluate} from './expression.mjs'
import {expressionPath,visitExpression} from './dataflow.mjs'

// Observed samples are evidence, not a closed schema. Warn without rejecting a
// valid optional field, guessing aliases, modifying data, or executing effects.
export function sampleFieldDiagnostics(spec,scope){
 const result=[],seen=new Set(),collections=new Set(['map','filter','find','some','every','count','sum'])
 let budget=128
 function check(ast,label){visitExpression(ast,call=>{
  if(budget<=0||result.length>=8||call.type!=='call'||!collections.has(call.name))return
  budget--
  let rows;try{rows=evaluate(call.args[0],scope)}catch{return}
  if(!Array.isArray(rows)||!rows.length)return
  rows=rows.slice(0,64)
  if(rows.some(row=>!row||typeof row!=='object'||Array.isArray(row)))return
  const alias=call.params?.[0]||'item',fields=new Set()
  function read(node){
   if(!node||typeof node!=='object')return
   const p=expressionPath(node)
   if(p?.length===2&&p[0]===alias&&typeof p[1]==='string')fields.add(p[1])
   // A nested callback may shadow the same name. Its receiver still belongs
   // to the enclosing scope; its callback body does not.
   if(node.type==='call'&&collections.has(node.name)&&(node.params?.[0]||'item')===alias){read(node.args[0]);return}
   for(const value of Object.values(node))if(Array.isArray(value))value.flat().forEach(read);else if(value&&typeof value==='object')read(value)
  }
  read(call.args[1])
  const available=[...new Set(rows.flatMap(row=>Object.keys(row)))].sort()
  for(const field of fields){
   if(rows.some(row=>Object.hasOwn(row,field))||seen.has(label+':'+field)||result.length>=8)continue
   seen.add(label+':'+field)
   result.push({severity:'warning',code:'sample_field_unobserved',message:`${label}: ${alias}.${field} is absent from all ${rows.length} inspected rows; observed fields: ${available.slice(0,20).join(', ')}. Verify the actual returned fields before filtering or displaying them; samples are not a closed schema.`})
  }
 })}
 for(const [name,ast] of Object.entries(spec.data||{}))check(ast,`data.${name}`)
 for(const [name,ast] of Object.entries(spec.derived||{}))check(ast,`derived.${name}`)
 function walk(nodes){for(const node of nodes||[]){for(const [name,ast] of Object.entries(node.props||{}))check(ast,`${node.id}.${name}`);walk(node.children)}}
 walk(spec.children)
 return result
}
