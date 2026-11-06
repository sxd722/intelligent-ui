import {createHash} from 'node:crypto'
import {compileCard,splitBuildFragment} from '../../shared/cardspec/compiler.mjs'
const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,16)
const nameOK=s=>typeof s==='string'&&/^[a-zA-Z_][a-zA-Z0-9_.-]{0,63}\.(cardspec|jsx)$/.test(s)&&!s.includes('..')
// Tolerate unambiguous single-operation wrappers without replaying batches.
export function normalizeBuildOperation(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Expected one JSON operation object with op and the target file; received empty/non-object output')
 let v=value
 if(v&&Array.isArray(v.ops)&&v.ops.length===1&&!v.op)v=v.ops[0]
 if(v?.op&&typeof v.op==='object'&&!Array.isArray(v.op)){
  const keys=Object.keys(v.op)
  if(keys.length===1&&['read','describe'].includes(keys[0])){
   const payload=v.op[keys[0]]
   if(Array.isArray(payload)&&payload.length===1&&payload[0]&&typeof payload[0]==='object')v={...payload[0],op:keys[0]}
  }
 }
 if(v&&!v.op&&['write','patch','chunk','read','describe','test','finish'].includes(v.type))v={...v,op:v.type}
 // One unambiguous filename alias; never override a conflicting explicit name.
 if(['patch','chunk'].includes(v?.op)&&v.name===undefined&&nameOK(v.module))v={...v,name:v.module}
 if(!v||v.op===null)throw Error('Expected op=write|patch|chunk|read|describe|test, not a null operation')
 return v
}
// Virtual files only. No filesystem, imports, shells or network capabilities.
export function createBuildWorkspace({extendedGeneration=false}={}){
 const moduleLimit=extendedGeneration?48000:18000,totalLimit=extendedGeneration?120000:42000
 const files=new Map(),drafts=new Map();let bytes=0
 function write(edits,{checkSyntax=false}={}){
  if(!Array.isArray(edits)||!edits.length||edits.length>8)throw Error('write 1–8 files')
  const next=new Map(files),seen=new Set()
  for(let e of edits){
   if(!nameOK(e.name)||seen.has(e.name)||typeof e.content!=='string'||e.content.length>moduleLimit)throw Error('invalid module name/size')
   if(e.name.endsWith('.cardspec'))e={...e,content:e.content.replace(/<include\s+ref="([a-zA-Z0-9_.-]+\.cardspec)"\s*\/>/g,'<include module="$1"/>')}
   const invalidMount=e.name.endsWith('.cardspec')&&e.content.match(/<include\b[^>]*(?:ref|module)="([^"]+\.jsx)"[^>]*>/)
   if(checkSyntax&&invalidMount)throw Object.assign(Error('Module unchanged; JSX needs <sandbox id="stage" brief="交互图形" input={...} source="@module:'+invalidMount[1]+'"/>; include only accepts .cardspec fragments'),{module:e.name})
   seen.add(e.name);const old=files.get(e.name)
   if(old&&e.version!==old.version)throw Error('stale module '+e.name+'; read current version before editing')
   if(checkSyntax&&e.name.endsWith('.cardspec')){
    let parts
    try{parts=e.name==='main.cardspec'?null:splitBuildFragment(e.content)}catch(error){throw Object.assign(Error('Module unchanged; repair '+e.name+': '+error.message+'; context: '+e.content.slice(Math.max(0,(error.offset||0)-120),(error.offset||0)+200)),{module:e.name})}
    const source=parts?'<card>'+parts.declarations.map(d=>d.source).join('\n')+parts.view+'</card>':e.content
    // Only module-local parsing is checked here; declarations and included
    // dependencies are validated later against the assembled application.
     const compiled=compileCard(source,{final:true,context:{expressionDialect:'js-v1',renderMode:'hybrid'}})
     const invalid=compiled.diagnostics.find(d=>d.severity==='error'&&(['syntax','incomplete','expression'].includes(d.code)||d.code==='component'&&d.message!=='unknown component include'||d.code==='structure'&&!d.message.startsWith('card requires visible UI')))
    if(invalid)throw Object.assign(Error('Module unchanged; repair '+e.name+': '+invalid.message+'; context: '+(invalid.context?.text||source.slice(Math.max(0,invalid.offset-120),invalid.offset+200))),{module:e.name})
   }
   next.set(e.name,{content:e.content,version:hash(e.content)})
  }
  bytes=[...next.values()].reduce((s,x)=>s+x.content.length,0)
  if(bytes>totalLimit||next.size>10)throw Error('workspace capacity exceeded')
  files.clear();next.forEach((v,k)=>files.set(k,v));edits.forEach(e=>drafts.delete(e.name));return manifest()
 }
 function read(name){if(!nameOK(name)||!files.has(name))throw Object.assign(Error('module not found: '+name),{module:name});return {name,...files.get(name)}}
 // Incomplete source is private staging, never part of assemble or rendering.
 // Offset + base version make continuation deterministic and stale-safe.
 function chunk({name,version,offset,content,done},options){
  if(!nameOK(name)||!Number.isSafeInteger(offset)||offset<0||typeof content!=='string'||!content.length||content.length>6000||typeof done!=='boolean')throw Error('chunk requires name, offset, 1–6000 characters and boolean done')
  const old=files.get(name)
  if(old?.version!==version)throw Error('stale chunk base version')
  const draft=offset===0?{content:'',version}:drafts.get(name)
  if(!draft||draft.version!==version||draft.content.length!==offset)throw Error('chunk offset must equal staged characters')
  const next=draft.content+content
  if(next.length>moduleLimit||[...drafts].filter(([n])=>n!==name).reduce((n,[,d])=>n+d.content.length,0)+next.length>totalLimit)throw Error('staged module capacity exceeded')
  if(done){const result=write([{name,version,content:next}],options);drafts.delete(name);return result}
  drafts.set(name,{content:next,version});return manifest()
 }
 function pending(){return [...drafts].map(([name,d])=>({name,version:d.version,offset:d.content.length,tail:d.content.slice(-160)}))}
 function manifest(){return [...files].map(([name,v])=>({name,version:v.version,characters:v.content.length}))}
 function patch({name,version,edits},options){
  const file=read(name)
  if(version!==file.version)throw Error('stale module '+name+'; use current version')
  if(!Array.isArray(edits)||!edits.length||edits.length>8)throw Error('patch requires 1–8 unique exact replacements')
  let content=file.content
  for(const edit of edits){
   if(typeof edit.old!=='string'||!edit.old||typeof edit.new!=='string'||edit.old===edit.new)throw Error('patch requires non-empty old and a changed new string')
   const at=content.indexOf(edit.old)
   if(at<0||content.indexOf(edit.old,at+1)>=0)throw Error('patch anchor must match exactly once; include enough surrounding context')
   content=content.slice(0,at)+edit.new+content.slice(at+edit.old.length)
  }
  return write([{name,version,content}],options)
 }
 function assemble(){
  const used=new Set(),ranges=[],bindings=[],linked=new Set(),declarations=[];let assembled=''
  const append=(text,name)=>{const start=assembled.length;assembled+=text;ranges.push({name,start,end:assembled.length})}
  function expand(name,chain=[]){
   if(chain.includes(name)||chain.length>6)throw Error('module include cycle/depth')
   let file=read(name);used.add(name)
   if(!name.endsWith('.cardspec'))throw Error('include must reference cardspec fragment')
   if(name!=='main.cardspec'&&/<\/?(?:card|intro|outro)\b/.test(file.content))throw Object.assign(Error(name+': fragment must not contain card/intro/outro; return only component nodes, e.g. <text>...</text>'),{module:name})
   if(name!=='main.cardspec'){
    const parts=splitBuildFragment(file.content)
    if(!linked.has(name)){for(const declaration of parts.declarations)declarations.push({...declaration,module:name});linked.add(name)}
    file={...file,content:parts.view}
   }
   const re=/<include\s+module="([a-zA-Z0-9_.-]+)"\s*\/>|source="@module:([a-zA-Z0-9_.-]+)"/g;let pos=0,m
   while((m=re.exec(file.content))){append(file.content.slice(pos,m.index),name)
    if(m[1])expand(m[1],[...chain,name]);else{if(!m[2].endsWith('.jsx'))throw Error('source module must be JSX');const jsx=read(m[2]);if(/^\s*<(?:sandbox|card)\b/.test(jsx.content))throw Object.assign(Error(m[2]+': JSX file must contain JavaScript exports, not <sandbox>/<card> wrappers. Start with export default function App({data}) { return <svg/>; }'),{module:m[2]});used.add(m[2]);const start=assembled.lastIndexOf('<sandbox');append('source={'+JSON.stringify(jsx.content)+'}',m[2]);bindings.push({start,end:assembled.length,module:m[2]})}
    pos=re.lastIndex
   }append(file.content.slice(pos),name)
  }
  expand('main.cardspec');if(/<include\b|@module:/.test(assembled))throw Error('unresolved module marker')
  if(declarations.length){
   const end=assembled.lastIndexOf('</card>');if(end<0)throw Error('main card must be closed before linking declarations')
   const tail=assembled.slice(end);assembled=assembled.slice(0,end)
   for(const range of ranges)if(range.end>end)range.end=end
   for(const d of declarations)append('\n'+d.source,d.module)
   append(tail,'main.cardspec')
  }
  return {source:assembled,version:hash(assembled),used:[...used],ranges,bindings}
 }
 function interfaceSource(){
  if(!files.has('main.cardspec'))return ''
  const source=read('main.cardspec').content
  const extra=[...files].filter(([name])=>name!=='main.cardspec'&&name.endsWith('.cardspec')).flatMap(([,file])=>splitBuildFragment(file.content).declarations.map(d=>d.source)).join('\n')
  return source.replace('</card>',extra+'</card>')
 }
 return {write,patch,chunk,pending,read,manifest,assemble,interfaceSource,snapshot:()=>Object.fromEntries(files)}
}
