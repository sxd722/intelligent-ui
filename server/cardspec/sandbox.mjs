import {transform} from 'esbuild'
import postcss from 'postcss'
import tailwind from 'tailwindcss'
import {createHash} from 'node:crypto'
import {getQuickJS} from 'quickjs-emscripten'
import {createSandboxVM} from '../../shared/cardspec/sandbox-engine.mjs'
import {SANDBOX_LIMITS,validateSandboxState} from '../../shared/cardspec/sandbox-policy.mjs'
import {logicJson} from '../../shared/cardspec/logic-contract.mjs'
import {parse} from 'acorn'
import {validateAuthorCSS} from './sandbox-css.mjs'
import {probeSandbox} from '../../shared/cardspec/sandbox-probes.mjs'
export const sandboxEnabled=()=>process.env.CARDSPEC_SANDBOX_ENABLED!=='0'
import {REACT_SURFACE_PROMPT} from '../../shared/cardspec/react-surface-prompt.mjs'
export {REACT_SURFACE_PROMPT}
export async function compileSandbox(source,{input={},initial={},capabilities=[],probe=false}={}){
 source=source.trim()
 if(source.includes('```')){
  const blocks=[...source.matchAll(/```(?:jsx|javascript|js)?[ \t]*\r?\n([\s\S]*?)```/g)]
  if(blocks.length!==1||(source.match(/```/g)||[]).length!==2)throw Error('Return one JSX module, not multiple code blocks')
  source=blocks[0][1].trim()
 }
 if(!source||source.length>SANDBOX_LIMITS.source)throw Error('React source exceeds budget')
 const esm=await transform(source,{loader:'jsx',format:'esm',target:'es2020',jsxFactory:'React.createElement',jsxFragment:'React.Fragment'})
 const ast=parse(esm.code,{ecmaVersion:'latest',sourceType:'module'});let styles='',defaults=0
 // esbuild normalizes exports into specifiers. Inspect exported bindings rather
 // than rejecting harmless words in comments and displayed text.
 const declarations=new Map(ast.body.filter(n=>n.type==='VariableDeclaration').flatMap(n=>n.declarations.map(d=>[d.id.name,d.init])))
 for(const node of ast.body){
  if(node.type==='ImportDeclaration'||node.type==='ExportAllDeclaration'||node.source)throw Error('No imports/packages')
  if(node.type==='ExportDefaultDeclaration')defaults++
  if(node.type==='ExportNamedDeclaration')for(const s of node.specifiers){
   if(s.exported.name==='default'){defaults++;continue}
   if(s.exported.name!=='styles')throw Error('Only default App and optional constant styles may be exported')
   const v=declarations.get(s.local.name)
   if(v?.type==='Literal'&&typeof v.value==='string')styles=v.value
   else if(v?.type==='TemplateLiteral'&&!v.expressions.length)styles=v.quasis[0].value.cooked
   else throw Error('styles must be a static CSS string')
  }
 }
 const visit=n=>{if(!n||typeof n!=='object')return;if(n.type==='ImportExpression'||n.type==='CallExpression'&&n.callee?.name==='require')throw Error('No imports/packages');for(const v of Object.values(n))if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v)};visit(ast)
 if(defaults!==1)throw Error('Export exactly one default component')
 validateAuthorCSS(styles)
 const {code}=await transform(esm.code,{loader:'js',format:'cjs',target:'es2020'})
 if(code.length>SANDBOX_LIMITS.compiled)throw Error('Compiled component exceeds budget')
 const css=(await postcss([tailwind({content:[{raw:source,extension:'jsx'}],corePlugins:{preflight:false},theme:{extend:{}},plugins:[]})]).process('@tailwind utilities;',{from:undefined})).css+'\n'+styles
 if(css.length>SANDBOX_LIMITS.css||/url\s*\(|@import|@font-face|<\/style/i.test(css))throw Error('Unsupported CSS resource or CSS budget exceeded')
 let audit
 if(probe)audit=probeSandbox(await getQuickJS(),{code,input,initial,capabilities})
 else{const vm=createSandboxVM(await getQuickJS(),{code,input,state:initial,capabilities});try{audit={diagnostics:vm.snapshot().diagnostics}}finally{vm.dispose()}}
 return {version:1,id:createHash('sha256').update(code+'\n'+css).digest('hex'),source,code,css,animated:/@keyframes|animation\s*:/.test(css),...audit}
}
export async function generateSandbox({input,streamUpstream,signal,budget,emit=()=>{},view={}}){
 if(!sandboxEnabled()||view.renderMode!=='hybrid')throw Error('React sandbox is disabled in CardSpec-only mode')
 const data=input.context?.data||{},initial=input.context?.initial||{},capabilities=input.context?.actions||[]
 if(!Array.isArray(capabilities)||capabilities.length>8||capabilities.some(n=>typeof n!=='string'||!/^[A-Za-z][\w-]{0,63}$/.test(n)))throw Error('Invalid sandbox actions')
 logicJson(data);validateSandboxState(initial)
 const messages=[{role:'system',content:REACT_SURFACE_PROMPT},{role:'user',content:JSON.stringify({brief:input.prompt,data,initial,actions:capabilities,size:{width:view.width||432,height:view.height||320}})}]
 let source=''
 for(let attempt=0;attempt<2;attempt++){
  source='';signal?.throwIfAborted()
  await streamUpstream(messages,{budget,stage:'sandbox',temperature:.4,maxTokens:5000,reasoningEffort:'low',signal,onPiece:p=>{if(p.content){source+=p.content;if(source.length>SANDBOX_LIMITS.source)throw Error('React output exceeds budget')}}})
  signal?.throwIfAborted()
  try{const module=await compileSandbox(source,{input:data,initial,capabilities});if(module.diagnostics.length)emit({type:'sandbox-compatibility',attempt,diagnostics:module.diagnostics});return {kind:'sandbox',module,repairCount:attempt,generationBudget:budget?.snapshot()}}
  catch(e){emit({type:'sandbox-diagnostic',attempt,message:e.message,source:source.slice(0,SANDBOX_LIMITS.source)});if(attempt)throw e;budget?.repair();messages.push({role:'assistant',content:source},{role:'user',content:'Fix the component, preserve core interaction. '+e.message});emit({type:'status',status:'repairing'})}
 }
}
