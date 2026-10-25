import {parseExpressionAt, tokenizer} from 'acorn'

// An authoring syntax, not host eval. Only the IR below crosses to the renderer.
const denied = new Set(['__proto__', 'prototype', 'constructor'])
const keyOK = key => !denied.has(String(key))
const collections = new Set(['filter', 'find', 'map', 'some', 'every', 'findIndex', 'reduce'])
const methods = new Set(['includes', 'indexOf', 'slice', 'join', 'concat', 'at', 'startsWith', 'endsWith', 'trim', 'toLowerCase', 'toUpperCase', 'split', 'replace', 'replaceAll', 'toFixed'])
const statics = {
  Math: new Set(['round','floor','ceil','abs','min','max','sqrt','pow','trunc','sign','log','log2','log10','exp','sin','cos','tan']),
  Number: new Set(['isFinite','isInteger','isNaN']),
  Object: new Set(['keys','values','entries','fromEntries']),
  Array: new Set(['isArray']),
}
const constants = {PI:Math.PI,E:Math.E,SQRT2:Math.SQRT2,LN2:Math.LN2,LN10:Math.LN10}
const binary = new Set(['+','-','*','/','%','**','==','!=','===','!==','<','<=','>','>=','&&','||','??'])
const helpers=new Set(['range','clamp','formatNumber','dateKey','formatDate','monthOf','dayOf','addDays','addMonths'])

export function parseJavaScriptExpression(source) {
  if(source.length>32768)throw Error('expression too long')
  // Wrapping permits parenthesized object literals while rejecting trailing code.
  const program=`(${source}\n)`
  const root=parseExpressionAt(program,0,{ecmaVersion:2022,preserveParens:true})
  if(root.end!==program.length)throw Error('expected one pure JavaScript expression')
  let count=0,serial=0
  const lit=value=>({type:'literal',value})
  function lower(n,env=new Map(),depth=0){
    if(++count>4000||depth>32)throw Error('expression nesting or size limit')
    const sub=x=>lower(x,env,depth+1)
    const property=n=>n.computed ? n.property.type==='Literal' ? String(n.property.value) : null : n.property.name
    switch(n.type){
      case 'ParenthesizedExpression':return sub(n.expression)
      case 'Literal':if(n.regex||n.bigint)throw Error('regular expressions and bigint are not supported');return typeof n.value==='number'&&!Number.isFinite(n.value)?{type:'jsConstant',name:'Infinity'}:lit(n.value)
      case 'Identifier':{
        if(!keyOK(n.name))throw Error('forbidden identifier')
        if(env.has(n.name))return {type:'ref',name:env.get(n.name)}
        if(n.name==='undefined')return {type:'undefined'}
        if(n.name==='NaN'||n.name==='Infinity')return {type:'jsConstant',name:n.name}
        return {type:'ref',name:n.name}
      }
      case 'MemberExpression':{
        const name=property(n)
        if(name!==null&&!keyOK(name))throw Error('forbidden property')
        // Both conventional event.args and the existing args root refer to the
        // host-supplied action arguments. Lower to one path for ID/dataflow checks.
        if(n.object.type==='Identifier'&&n.object.name==='event'&&!env.has('event')&&name==='args')return {type:'ref',name:'args'}
        if(n.object.type==='Identifier'&&!env.has(n.object.name)&&n.object.name==='Math'&&Object.hasOwn(constants,name))return lit(constants[name])
        return {type:'get',object:sub(n.object),key:n.computed?sub(n.property):lit(name),optional:!!n.optional}
      }
      case 'ChainExpression':return {type:'chain',value:sub(n.expression)}
      case 'ArrayExpression':if(n.elements.some(x=>!x))throw Error('sparse arrays are not supported');return {type:'array',items:n.elements.map(sub)}
      case 'SpreadElement':return {type:'spread',value:sub(n.argument)}
      case 'ObjectExpression':{
        const entries=n.properties.map(p=>{
          if(p.type==='SpreadElement')return [null,{type:'spread',value:sub(p.argument)}]
          if(p.kind!=='init'||p.method)throw Error('object accessors and methods are not supported')
          const key=p.computed?null:p.key.type==='Identifier'?p.key.name:String(p.key.value)
          if(key!==null&&!keyOK(key))throw Error('forbidden property')
          return [key===null?sub(p.key):key,sub(p.value)]
        })
        return {type:'object',entries}
      }
      case 'UnaryExpression':if(!['!','-','+','typeof'].includes(n.operator))throw Error('unsupported unary operator');return {type:'unary',op:n.operator,value:sub(n.argument)}
      case 'BinaryExpression':case 'LogicalExpression':if(!binary.has(n.operator))throw Error('unsupported binary operator');return {type:'binary',op:n.operator,left:sub(n.left),right:sub(n.right)}
      case 'ConditionalExpression':return {type:'conditional',test:sub(n.test),yes:sub(n.consequent),no:sub(n.alternate)}
      case 'TemplateLiteral':return n.expressions.length?{type:'template',parts:n.quasis.map(q=>q.value.cooked),expressions:n.expressions.map(sub)}:lit(n.quasis[0].value.cooked)
      case 'CallExpression':{
        if(n.optional)throw Error('optional function calls are not supported; use optional data access')
        const callee=n.callee
        if(callee.type==='Identifier'&&helpers.has(callee.name)&&!env.has(callee.name))return {type:'call',name:`helper:${callee.name}`,args:n.arguments.map(sub)}
        if(callee.type==='Identifier'&&['Number','String','Boolean'].includes(callee.name)&&!env.has(callee.name)){
          if(n.arguments.length>1)throw Error(`${callee.name} expects zero or one argument`)
          return {type:'call',name:`js:${callee.name}`,args:n.arguments.map(sub)}
        }
        if(callee.type!=='MemberExpression')throw Error('only supported pure JavaScript methods may be called; use a logic update function for multi-step logic')
        const name=property(callee)
        if(!name||!keyOK(name))throw Error('method name must be a supported literal')
        if(callee.object.type==='Identifier'&&!env.has(callee.object.name)&&statics[callee.object.name]?.has(name))return {type:'call',name:`js:${callee.object.name}.${name}`,args:n.arguments.map(sub)}
        const receiver=sub(callee.object)
        if(collections.has(name)){
          const callback=n.arguments[0]
          if(!callback||callback.type!=='ArrowFunctionExpression'||callback.async||callback.body.type==='BlockStatement'||callback.params.some(p=>p.type!=='Identifier')||new Set(callback.params.map(p=>p.name)).size!==callback.params.length)throw Error(`${name} requires a pure expression arrow callback; use logic for statements`)
          const max=name==='reduce'?4:3
          if(callback.params.length>max||n.arguments.length>(name==='reduce'?2:1)||name==='reduce'&&n.arguments.length!==2)throw Error(`${name} has invalid arguments; reduce requires an initial value`)
          const inner=new Map(env),params=callback.params.map(p=>{const id=`$lambda${++serial}_${p.name}`;inner.set(p.name,id);return id})
          return {type:'call',name,args:[receiver,lower(callback.body,inner,depth+1),...n.arguments.slice(1).map(sub)],params,optional:!!callee.optional}
        }
        if(!methods.has(name))throw Error(`unsupported pure method ${name}; use a logic update function for complex logic`)
        return {type:'call',name:`method:${name}`,args:[receiver,...n.arguments.map(sub)],optional:!!callee.optional}
      }
      default:throw Error(`${n.type} is not allowed in a pure expression; use a logic update function`)
    }
  }
  function mark(n){if(!n||typeof n!=='object')return;if(n.type)n.dialect='js-v1';for(const v of Object.values(n))if(Array.isArray(v))v.flat().forEach(mark);else if(v&&typeof v==='object')mark(v)}
  const result=lower(root);mark(result);return result
}

// Locate an outer CardSpec {expression}; tokenization handles nested templates,
// comments and strings without interpreting braces in their contents as markup.
export function javascriptExpressionEnd(source,start,decode=x=>x,cache={}){
  if(cache.source!==source){
    const positions=[],offsets=[],pieces=[];let size=0
    for(let i=0;i<source.length;){
      const entity=source[i]==='&'?/^&(?:#\d+|#x[\da-f]+|amp|lt|gt|quot|apos);/i.exec(source.slice(i))?.[0]:null
      const piece=entity?decode(entity):source[i]
      offsets[i]=size
      for(let k=0;k<piece.length;k++)positions.push(i)
      pieces.push(piece);size+=piece.length;i+=entity?.length||1
    }
    Object.assign(cache,{source,positions,offsets,decoded:pieces.join('')})
  }
  const offset=cache.offsets[start]+1
  const tokens=tokenizer(cache.decoded.slice(offset),{ecmaVersion:2022});let depth=0
  for(;;){const t=tokens.getToken(),label=t.type.label
    if(label==='eof')return null
    if(label==='{'||label==='${')depth++
    if(label==='}'){if(depth===0)return cache.positions[offset+t.start];depth--}
  }
}

const shortCircuit=Symbol('optional chain')
export function evaluateJavaScriptExpression(ast,scope,budget,helper){
  function bounded(v){
    if(typeof v==='string'&&v.length>32768||Array.isArray(v)&&v.length>1000)throw Error('expression result exceeds collection/string limit')
    return v
  }
  function property(obj,k){
    k=String(k);if(!keyOK(k))throw Error('forbidden property')
    if(obj==null)throw Error('cannot read property of null or undefined; use ?. or ??')
    return Object.hasOwn(Object(obj),k)?obj[k]:undefined
  }
  function args(nodes,env){const out=[];for(const node of nodes){const v=ev(node.type==='spread'?node.value:node,env);if(node.type==='spread'){if(!Array.isArray(v))throw Error('spread requires an array');out.push(...v)}else out.push(v);bounded(out)}return out}
  function ev(n,env=scope){
    if(--budget.remaining<0)throw Error('expression operation budget exceeded')
    let result
    switch(n.type){
      case 'literal':return n.value
      case 'jsConstant':return n.name==='NaN'?NaN:Infinity
      case 'undefined':return undefined
      case 'ref':return Object.hasOwn(env,n.name)?env[n.name]:undefined
      case 'chain':{const v=ev(n.value,env);return v===shortCircuit?undefined:v}
      case 'get':{
        const obj=ev(n.object,env);if(obj===shortCircuit||n.optional&&obj==null)return shortCircuit
        const k=ev(n.key,env),value=property(obj,k)
        if(value===undefined&&n.object.type==='ref'&&['event','args'].includes(n.object.name))budget.onMissingInput?.(n.object.name,String(k))
        return bounded(value)
      }
      case 'array':return args(n.items,env)
      case 'object':{
        const out={}
        for(const [key,value]of n.entries){
          if(key===null){const v=ev(value.value,env);if(v!=null)for(const [k,x]of Object.entries(v)){if(!keyOK(k))throw Error('forbidden property');out[k]=x}}
          else {const k=typeof key==='string'?key:String(ev(key,env));if(!keyOK(k))throw Error('forbidden property');out[k]=ev(value,env)}
          if(Object.keys(out).length>1000)throw Error('object property limit')
        }return out
      }
      case 'template':return bounded(n.parts.reduce((s,p,i)=>s+p+(i<n.expressions.length?String(ev(n.expressions[i],env)):''),''))
      case 'unary':{const v=ev(n.value,env);return n.op==='!'?!v:n.op==='-'?-v:n.op==='+'?+v:typeof v}
      case 'conditional':return ev(n.test,env)?ev(n.yes,env):ev(n.no,env)
      case 'binary':{
        const a=ev(n.left,env)
        if(n.op==='&&')return a&&ev(n.right,env)
        if(n.op==='||')return a||ev(n.right,env)
        if(n.op==='??')return a??ev(n.right,env)
        const b=ev(n.right,env)
        switch(n.op){
          case '+':return bounded(a+b);case '-':return a-b;case '*':return a*b;case '/':return a/b;case '%':return a%b;case '**':return a**b
          case '==':return a==b;case '!=':return a!=b;case '===':return a===b;case '!==':return a!==b
          case '<':return a<b;case '<=':return a<=b;case '>':return a>b;case '>=':return a>=b
        }break
      }
      case 'call':{
        const name=n.name
        if(collections.has(name)){
          const rows=ev(n.args[0],env);if(rows===shortCircuit||n.optional&&rows==null)return shortCircuit
          if(!Array.isArray(rows)||rows.length>1000)throw Error(`${name} requires an array of at most 1000 items`)
          const callback=(...values)=>ev(n.args[1],{...env,...Object.fromEntries(n.params.map((p,i)=>[p,values[i]]))})
          if(name==='reduce')return bounded(rows.reduce(callback,ev(n.args[2],env)))
          return bounded(Array.prototype[name].call(rows,callback))
        }
        if(name.startsWith('method:')){
          const obj=ev(n.args[0],env);if(obj===shortCircuit||n.optional&&obj==null)return shortCircuit
          const method=name.slice(7),v=args(n.args.slice(1),env)
          if(Array.isArray(obj)&&['includes','indexOf','slice','join','concat','at'].includes(method)){
            bounded(obj)
            if(method==='join'&&(String(v[0]??',').length*obj.length>32768||obj.some(x=>typeof x==='string'&&x.length>32768/Math.max(1,obj.length))))throw Error('join result limit')
            result=Array.prototype[method].apply(obj,v)
          }else if(typeof obj==='string'&&['includes','indexOf','slice','concat','at','startsWith','endsWith','trim','toLowerCase','toUpperCase','split','replace','replaceAll'].includes(method)){
            bounded(obj)
            if(['replace','replaceAll'].includes(method)&&(typeof v[0]!=='string'||typeof v[1]!=='string'))throw Error('replace requires literal string values')
            if(['replace','replaceAll'].includes(method)&&obj.length*(v[1].length+1)>32768)throw Error('replacement result limit')
            result=String.prototype[method].apply(obj,v)
          }else if(typeof obj==='number'&&method==='toFixed')result=Number.prototype.toFixed.apply(obj,v)
          else throw Error(`unsupported ${method} receiver`)
          return bounded(result)
        }
        const v=args(n.args,env),fn=name.slice(3)
        if(name.startsWith('helper:'))return helper(name.slice(7),v)
        if(fn==='Number')return v.length?Number(v[0]):0
        if(fn==='String')return v.length?bounded(String(v[0])):''
        if(fn==='Boolean')return Boolean(v[0])
        const [owner,method]=fn.split('.')
        const safe={Math,Number,Object,Array}
        if(!statics[owner]?.has(method))throw Error('unsupported static function')
        if(owner==='Object'&&method==='fromEntries'){
          if(!Array.isArray(v[0])||v[0].some(pair=>!Array.isArray(pair)||!keyOK(pair[0])))throw Error('fromEntries requires safe key/value pairs')
        }
        result=safe[owner][method](...v)
        if(result&&typeof result==='object'&&!Array.isArray(result)&&Object.keys(result).length>1000)throw Error('object property limit')
        return bounded(result)
      }
    }
    throw Error('unknown JavaScript expression node')
  }
  return ev(ast)
}
