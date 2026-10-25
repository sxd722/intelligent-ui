import {parse} from 'acorn'

// A narrow lifecycle check, not a JS proof engine. Follow simple aliases of the
// input parameter and only reject work exclusively guarded by event.type=input.
// Explicit init handling or unconditional input consumption is left alone.
export function logicLifecycleIssue(source){
 const fn=parse(source,{ecmaVersion:2022}).body[0],event=fn?.params[1]?.name,input=fn?.params[2]?.name
 if(!event||!input)return null
 const aliases=new Set([input]);let init=false,guarded=false,unconditional=false
 const isType=n=>n?.type==='MemberExpression'&&n.object?.name===event&&(n.computed?n.property?.value:n.property?.name)==='type'
 const eventIs=(n,value)=>n?.type==='BinaryExpression'&&['==','==='].includes(n.operator)&&((isType(n.left)&&n.right?.value===value)||(isType(n.right)&&n.left?.value===value))
 function contains(n){if(!n||typeof n!=='object')return false;if(n.type==='Identifier'&&aliases.has(n.name))return true;return Object.values(n).some(v=>Array.isArray(v)?v.some(contains):v&&typeof v==='object'&&contains(v))}
 function scan(n,inInput=false){
  if(!n||typeof n!=='object')return
  if(eventIs(n,'init'))init=true
  if(n.type==='IfStatement'&&eventIs(n.test,'input')){scan(n.consequent,true);scan(n.alternate,inInput);return}
  if(n.type==='SwitchStatement'&&isType(n.discriminant)){
   for(const c of n.cases){if(c.test?.value==='init')init=true;for(const statement of c.consequent)scan(statement,inInput||c.test?.value==='input')}return
  }
  if(n.type==='VariableDeclarator'&&n.id?.type==='Identifier'&&contains(n.init)){
   // Pure alias declarations do not consume the input. Expressions/calls that
   // calculate a value do, and are handled by the ordinary walk below.
   const alias=x=>x?.type==='Identifier'&&aliases.has(x.name)||x?.type==='MemberExpression'&&alias(x.object)||x?.type==='LogicalExpression'&&alias(x.left)
   if(alias(n.init)){aliases.add(n.id.name);return}
  }
  if(n.type==='Identifier'&&aliases.has(n.name)){if(inInput)guarded=true;else unconditional=true;return}
  for(const [key,v]of Object.entries(n)){
   if(key==='params'||key==='id'||key==='key'&&!n.computed||key==='property'&&!n.computed)continue
   if(Array.isArray(v))v.forEach(x=>scan(x,inInput));else if(v&&typeof v==='object')scan(v,inInput)
  }
 }
 scan(fn.body)
 return guarded&&!unconditional&&!init?'reactive input data is consumed only by event.type="input". First mount (including a conditionally shown module) sends "init", so initial selections are ignored. Handle both init and input, or compute from input unconditionally; preserve explicit user edits.':null
}

// Infer only concrete numeric requirements present in the view. Other local
// state remains untyped JSON: nulls, unions, display strings and new fields work.
export function numericViewPaths(nodes){
 const paths=new Map()
 function path(n){if(n?.type==='ref'&&n.name==='local')return [];if(n?.type==='get'&&n.key?.type==='literal'){const parent=path(n.object);if(parent)return [...parent,n.key.value]}return null}
 function visit(n){if(!n||typeof n!=='object')return
  if(n.type==='binary'&&['+','-','*','/','%','<','<=','>','>=','==','!=','===','!=='].includes(n.op)){
   for(const [a,b]of [[n.left,n.right],[n.right,n.left]]){const p=path(a);if(p?.length&&b?.type==='literal'&&typeof b.value==='number')paths.set(JSON.stringify(p),p)}
  }
  for(const v of Object.values(n))if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v)
 }visit(nodes);return [...paths.values()]
}
export function validateNumericTransition(before,after,paths){
 for(const path of paths){const read=s=>path.reduce((v,k)=>v?.[k],s),was=read(before),now=read(after)
  if(typeof was==='number'&&typeof now!=='number')throw Error(`local.${path.join('.')} changed from number to ${now===null?'null':typeof now}, but the view uses numeric operations/comparisons. Convert the control value explicitly (for example Number(event.value)) or use consistently typed options; do not hide the numeric view.`)
 }
}
