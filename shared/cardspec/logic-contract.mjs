import {parse} from 'acorn'
export const LOGIC_LIMITS={source:12000,json:65536,nodes:4000,depth:16,memory:16*1024*1024,timeMs:50,interrupts:1000}
export function validateLogicSource(source){
 if(typeof source!=='string'||source.length>LOGIC_LIMITS.source)throw Error('logic.source must be a literal JS function, at most 12000 characters')
 const ast=parse(source,{ecmaVersion:2022,sourceType:'script'})
 const fn=ast.body[0]
 if(ast.body.length!==1||fn?.type!=='FunctionDeclaration'||fn.id?.name!=='update'||fn.async||fn.generator||fn.params.length>3)throw Error('logic.source requires one synchronous function update(state,event,input), with up to 3 positional parameters; parameter names may vary, unused trailing parameters may be omitted, no top-level statements')
 return source
}
export function logicTickMs(source,explicit){
 if(explicit!==undefined)return explicit
 const ast=parse(source,{ecmaVersion:2022});let tick=false
 const parameter=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id?.name==='update')?.params[1]
 const eventParameter=parameter?.type==='AssignmentPattern'?parameter.left:parameter
 const eventName=eventParameter?.type==='Identifier'?eventParameter.name:null
 const eventTypeNames=eventParameter?.type==='ObjectPattern'?eventParameter.properties.filter(p=>p.type==='Property'&&(p.key.name||p.key.value)==='type').map(p=>p.value.type==='AssignmentPattern'?p.value.left.name:p.value.name):[]
 function walk(n){if(!n||typeof n!=='object')return
  const isType=x=>x?.type==='MemberExpression'&&eventName&&x.object?.name===eventName&&(x.computed?x.property?.value:x.property?.name)==='type'||x?.type==='Identifier'&&eventTypeNames.includes(x.name)
  if(n.type==='BinaryExpression'&&['===','=='].includes(n.operator)&&((isType(n.left)&&n.right?.value==='tick')||(isType(n.right)&&n.left?.value==='tick')))tick=true
  if(n.type==='SwitchStatement'&&isType(n.discriminant)&&n.cases.some(c=>c.test?.value==='tick'))tick=true
  for(const value of Object.values(n))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value)
 }walk(ast);return tick?500:undefined
}
// Only inert bounded JSON crosses the engine boundary. No host object handles.
export function logicJson(value,{record=false}={}){
 let nodes=0
 function visit(v,depth){
  if(++nodes>LOGIC_LIMITS.nodes||depth>LOGIC_LIMITS.depth)throw Error('逻辑数据过于复杂')
  if(v===null||typeof v==='boolean'||typeof v==='string')return
  if(typeof v==='number'&&Number.isFinite(v))return
  if(!v||typeof v!=='object'||(!Array.isArray(v)&&Object.getPrototypeOf(v)!==Object.prototype&&Object.getPrototypeOf(v)!==null))throw Error('逻辑状态必须为有限的 JSON 数据')
  for(const [k,x]of Object.entries(v)){
   if(['__proto__','constructor','prototype'].includes(k))throw Error('逻辑数据含保留字段')
   // Match JSON object serialization for absent optional properties. Arrays
   // must retain their positions; undefined entries remain an error.
   if(x===undefined&&!Array.isArray(v))continue
   visit(x,depth+1)
  }
 }
 if(record&&(!value||Array.isArray(value)||typeof value!=='object'))throw Error('逻辑状态必须返回对象')
 visit(value,0);const raw=JSON.stringify(value)
 if(raw.length>LOGIC_LIMITS.json)throw Error('逻辑数据超过 64 KiB 字符上限')
 return raw
}
