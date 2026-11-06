import {inspectCardSource} from './compiler.mjs'
import {evaluate} from './expression.mjs'
import {TOOLS} from './tools.mjs'
import {canonicalInput} from './prefetch.mjs'
const fail=(message,code='REUSE_INCOMPATIBLE')=>Object.assign(Error(message),{code,statusCode:422})
const fixedKey=k=>/^(id|key|.*Id|.*_id|assetRef|assetKind|url|href|src|image|poster|thumbnail)$/i.test(k)
function constant(ast){return ast?.type==='literal'||ast?.type==='array'&&ast.items.every(constant)||ast?.type==='object'&&ast.entries.every(([,v])=>constant(v))}
function compatible(a,b,key=''){
 if(fixedKey(key))return canonicalInput(a)===canonicalInput(b)
 if(a===null||typeof a!==typeof b)return a===b
 if(typeof a==='string')return b.length<=Math.min(1600,Math.max(120,a.length*3))
 if(typeof a==='number')return Number.isFinite(b)
 if(Array.isArray(a))return Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>compatible(v,b[i]))
 if(a&&typeof a==='object')return b&&!Array.isArray(b)&&canonicalInput(Object.keys(a).sort())===canonicalInput(Object.keys(b).sort())&&Object.entries(a).every(([k,v])=>compatible(v,b[k],k))
 return a===b
}
export function reuseSlots(source){
 const root=inspectCardSource(source),slots=[]
 const add=(kind,node,span,value)=>Number.isInteger(span?.start)&&Number.isInteger(span?.end)&&slots.push({id:'s'+slots.length,kind,node:node.attrs?.id?.value||node.name,start:span.start,end:span.end,value})
 function walk(nodes,locked=false,parent=''){for(const n of nodes||[]){
  const guard=locked||['sandbox','logic','action','state','derive','each','button','chip','option','link','intro','outro'].includes(n.name)
  if(n.name==='data'&&constant(n.attrs.value)&&n.attrSpans?.value)add('data',n,n.attrSpans.value,evaluate(n.attrs.value,{}))
  else if(['binding','tool-view'].includes(n.name)&&constant(n.attrs.input)&&n.attrSpans?.input&&TOOLS[n.attrs.tool?.value]?.readOnly===true)add('binding',n,n.attrSpans.input,evaluate(n.attrs.input,{}))
  else if(!guard&&n.name==='image'&&n.attrs.query?.type==='literal')add('image',n,n.attrSpans?.query,n.attrs.query.value)
  else if(!locked&&n.name==='#text'&&n.value?.type==='literal'&&typeof n.value.value==='string'&&['title','text','caption','strong'].includes(parent))add('text',{name:parent},{start:n.start,end:n.end},n.value.value)
  walk(n.children,guard,n.name)
 }}walk(root.children)
 return slots.filter(s=>JSON.stringify(s.value).length<9000).slice(0,32)
}
export function applyReuseChanges(source,changes){
 if(!Array.isArray(changes)||!changes.length||changes.length>32)throw fail('没有可应用的内容替换')
 const slots=reuseSlots(source),seen=new Set(),edits=[],translations=new Map()
 const collect=(a,b)=>{if(typeof a==='string'&&a&&a!==b){if(translations.has(a)&&translations.get(a)!==b)throw fail('同一文本存在不同替换，不能可靠复用交互断言');translations.set(a,b)}else if(Array.isArray(a))a.forEach((v,i)=>collect(v,b[i]));else if(a&&typeof a==='object')Object.keys(a).forEach(k=>collect(a[k],b[k]))}
 for(const c of changes){const s=slots.find(s=>s.id===c.slot);if(!s||seen.has(c.slot)||Object.keys(c).some(k=>!['slot','value'].includes(k)))throw fail('未知或重复的内容槽位');seen.add(c.slot)
  if(s.kind==='binding'){if(!c.value||typeof c.value!=='object'||Array.isArray(c.value))throw fail('工具参数必须为对象')}
  else if(s.kind==='image'){if(typeof c.value!=='string'||!c.value.trim()||c.value.length>100||/https?:\/\//i.test(c.value))throw fail('图片只允许简短 query；原创插画使用 gen: 前缀')}
  else if(!compatible(s.value,c.value))throw fail('替换改变了数据结构、稳定 ID、媒体引用或内容容量，请使用正常生成')
  collect(s.value,c.value)
  const value=s.kind==='text'?'{'+JSON.stringify(c.value)+'}':'{'+JSON.stringify(c.value)+'}'
  edits.push({...s,replacement:value})
 }
 let result=source;for(const e of edits.sort((a,b)=>b.start-a.start))result=result.slice(0,e.start)+e.replacement+result.slice(e.end)
 if(result.length>48000)throw fail('同款内容超过容量')
 return {source:result,changed:edits.map(({id,kind,node})=>({id,kind,node})),translations}
}
export function translateReuseSteps(steps,translations){
 const text=s=>{if(typeof s!=='string')return s;return translations.get(s)??s}
 return steps.map(step=>({...step,...(step.name?{name:text(step.name),handle:undefined}:{}),...(step.expect?{expect:{...step.expect,...(step.expect.text!==undefined?{text:Array.isArray(step.expect.text)?step.expect.text.map(text):text(step.expect.text)}:{})}}:{})}))
}
