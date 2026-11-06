import {build} from 'esbuild'
import {createHash} from 'node:crypto'
import postcss from 'postcss'
import tailwind from 'tailwindcss'
import {allowedWebImport,WEB_LIMITS,webReactShim,resolveWebImport} from '../../shared/cardspec/web-policy.mjs'

// Compile, never evaluate generated JS on the server. Execution belongs solely
// to the opt-in opaque iframe and its browser validation path.
export async function compileWebSandbox(source){
 if(typeof source!=='string'||!source.trim()||source.length>WEB_LIMITS.source)throw Error('Web application source exceeds 120000 characters')
 const dependencies=new Set()
 const result=await build({stdin:{contents:`import App, * as AppModule from 'card-module'; window.__CARD_WEB__.mount({...AppModule,default:App});`,loader:'js'},bundle:true,write:false,format:'esm',target:'es2022',platform:'browser',jsxFactory:'React.createElement',jsxFragment:'React.Fragment',minify:false,
 plugins:[{name:'isolated-web-imports',setup(b){
  b.onResolve({filter:/.*/},args=>{
   if(args.path==='card-module')return {path:args.path,namespace:'card'}
   if(!allowedWebImport(args.path))throw Error('Use react/react-dom or an approved HTTPS CDN ESM URL; unsupported import '+args.path)
   if(args.path.startsWith('https:')){const path=resolveWebImport(args.path);dependencies.add(path);return {path,external:true}}
   return {path:args.path,namespace:'runtime'}
  })
  b.onLoad({filter:/.*/,namespace:'card'},()=>({contents:source,loader:'jsx'}))
  b.onLoad({filter:/.*/,namespace:'runtime'},args=>({contents:webReactShim(args.path),loader:'js'}))
 }}]})
 const code=result.outputFiles[0].text
 if(code.length>WEB_LIMITS.compiled)throw Error('Compiled Web application exceeds capacity')
 const css=(await postcss([tailwind({content:[{raw:source,extension:'jsx'}],corePlugins:{preflight:false}})]).process('@tailwind utilities;',{from:undefined})).css
 if(css.length>WEB_LIMITS.css)throw Error('Web application CSS exceeds capacity')
 return {version:1,kind:'web',id:createHash('sha256').update(code+css).digest('hex'),source,code,css,dependencies:[...dependencies],diagnostics:[{severity:'warning',code:'web_browser_required',message:'Web application compiled; hooks, timers, CDN and interaction require browser validation.'}]}
}
