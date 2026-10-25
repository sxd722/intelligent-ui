import {Parser} from 'acorn'
import jsx from 'acorn-jsx'
import {parseJavaScriptExpression} from './javascript-expression.mjs'
import {REGISTRY} from './registry.mjs'

// JSX is authoring sugar for the existing native tree, never React execution.
// The host expression allowlist, identity checks and action transactions still
// validate the resulting nodes. Nothing here invokes generated JavaScript.
const parser=Parser.extend(jsx({allowNamespaces:false}))
const lit=value=>({type:'literal',value})
const unwrap=n=>n?.type==='ParenthesizedExpression'?unwrap(n.expression):n
const hasJsx=n=>{
 if(!n||typeof n!=='object')return false
 if(n.type==='JSXElement'||n.type==='JSXFragment')return true
 return Object.values(n).some(v=>Array.isArray(v)?v.some(hasJsx):v&&typeof v==='object'&&hasJsx(v))
}

export function readJsxAuthoring(source,start,{maxDepth=32}={}){
 let ast
 try{ast=parser.parseExpressionAt(source,start+1,{ecmaVersion:2022,preserveParens:true})}catch{return null}
 let end=ast.end;while(/\s/.test(source[end]||'')&&end<source.length)end++
 if(source[end]!=='}'||!hasJsx(ast))return null
 let count=0
 const fail=(message,at)=>{throw Object.assign(Error(message),{expressionEnd:end,offset:at??start})}
 if(end-start>32768)fail('JSX expression exceeds 32768 characters')
 const pure=n=>{
  if(hasJsx(n))fail('JSX is allowed only as native child content, not inside component data or attributes',n.start)
  try{return parseJavaScriptExpression(source.slice(n.start,n.end))}catch(e){fail(e.message,n.start)}
 }
 const node=(name,attrs,children,n,depth)=>{
  if(++count>512||depth>maxDepth)fail('JSX document complexity limit',n.start)
  return {name,attrs,children,closed:true,start:n.start}
 }
 function render(input,depth=0,allowKey=false){
  const n=unwrap(input)
  if(depth>maxDepth)fail('JSX document complexity limit',n.start)
  if(n.type==='JSXFragment')return n.children.flatMap(c=>child(c,depth+1))
  if(n.type==='JSXElement'){
   const opening=n.openingElement,name=opening.name
   if(name.type!=='JSXIdentifier'||!Object.hasOwn(REGISTRY,name.name))fail('JSX accepts registered native CardSpec components only',name.start)
   const attrs=Object.create(null)
   for(const a of opening.attributes){
    if(a.type!=='JSXAttribute'||a.name.type!=='JSXIdentifier')fail('JSX spread attributes and namespaced attributes are not supported',a.start)
    const key=a.name.name
    if(Object.hasOwn(attrs,key))fail(`duplicate JSX attribute ${key}`,a.start)
    if(key==='key'&&!allowKey)fail('JSX key belongs on the root component returned by map',a.start)
    let value=a.value===null?lit(true):a.value.type==='Literal'?lit(a.value.value):a.value.type==='JSXExpressionContainer'?pure(a.value.expression):null
    if(!value)fail('JSX attributes must be literal values or pure expressions',a.start)
    const type=REGISTRY[name.name].props[key]
    if(type==='boolean'&&value.type==='literal'&&['true','false'].includes(value.value))value=lit(value.value==='true')
    if(['number','columns','lines'].includes(type)&&value.type==='literal'&&typeof value.value==='string'&&/^-?\d+(\.\d+)?$/.test(value.value))value=lit(Number(value.value))
    attrs[key]=value
   }
   return [node(name.name,attrs,n.children.flatMap(c=>child(c,depth+1)),n,depth)]
  }
  if(n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&!n.callee.computed&&n.callee.property.name==='map'){
   const callback=n.arguments[0]
   if(n.optional||n.callee.optional||n.arguments.length!==1||callback?.type!=='ArrowFunctionExpression'||callback.async||callback.params.length!==1||callback.params[0].type!=='Identifier')fail('JSX map requires one named item parameter: rows.map(row => <text key={row.id}>...</text>)',n.start)
   if(unwrap(callback.body).type!=='JSXElement')fail('JSX map must return one native root component with a stable key; wrap its children in stack or row',callback.body.start)
   const children=render(callback.body,depth+1,true),itemKey=children[0].attrs.key
   if(!itemKey)fail('JSX map requires a stable key on the returned root component',callback.body.start)
   delete children[0].attrs.key
   return [node('each',{items:pure(n.callee.object),as:lit(callback.params[0].name),itemKey},children,n,depth)]
  }
  if(n.type==='ConditionalExpression')return [node('if',{test:pure(n.test)},render(n.consequent,depth+1),n,depth),node('if',{test:{type:'unary',op:'!',value:pure(n.test),dialect:'js-v1'}},render(n.alternate,depth+1),n,depth)]
  if(n.type==='LogicalExpression'&&n.operator==='&&'&&!hasJsx(n.left))return [node('if',{test:pure(n.left)},render(n.right,depth+1),n,depth)]
  if(n.type==='Literal'&&(n.value===null||n.value===false))return []
  if(hasJsx(n))fail('Unsupported JSX composition; use map, a boolean condition, or native each/if',n.start)
  return [{name:'#text',value:pure(n),start:n.start}]
 }
 function child(n,depth){
  if(n.type==='JSXText'){
   const text=n.value.replace(/\s+/g,' ')
   return text.trim()?[{name:'#text',value:lit(text),start:n.start}]:[]
  }
  if(n.type==='JSXExpressionContainer')return n.expression.type==='JSXEmptyExpression'?[]:render(n.expression,depth)
  return render(n,depth)
 }
 return {end,nodes:render(ast),count}
}
