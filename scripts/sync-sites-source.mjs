// Explicit, sanitized publication export. Never run as part of ordinary local builds.
import {cp,mkdir,readFile,writeFile,unlink} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {SANDBOX_RENDER_SCRIPT} from '../src/cardspec/sandbox-document.mjs'
const root=fileURLToPath(new URL('../',import.meta.url)),target=path.join(root,'sites/intelligent-ui')
const localOnly=['src/cardspec/RecoveryLab.jsx','shared/cardspec/recovery-train-fixture.mjs']
const publicSource=p=>!localOnly.includes(path.relative(root,p).replaceAll('\\','/'))
await mkdir(path.join(target,'ui'),{recursive:true})
for(const name of ['src','shared','demos','index.html','catalog.html','cardspec-lab.html','design-templates.html','pearl-review.html','package.json','package-lock.json']){
 await cp(path.join(root,name),path.join(target,'ui',name),{recursive:true,filter:publicSource})
}
for(const name of ['shared','server/cardspec','server/compiler','server/prompt.mjs','server/research']){
 await cp(path.join(root,name),path.join(target,name),{recursive:true,filter:publicSource})
}
for(const relative of [...localOnly.map(n=>'ui/'+n),'shared/cardspec/recovery-train-fixture.mjs']){
 await unlink(path.join(target,relative)).catch(e=>{if(e.code!=='ENOENT')throw e})
}
const write=(name,text)=>writeFile(path.join(target,name),text)
// Freeze before minification: Function.toString() would otherwise produce a
// different renderer at runtime than the exact bytes authorized by the CSP.
const sandboxDocumentPath=path.join(target,'ui/src/cardspec/sandbox-document.mjs')
const sandboxDocumentSource=await readFile(sandboxDocumentPath,'utf8')
const scriptStart=sandboxDocumentSource.indexOf('export const SANDBOX_RENDER_SCRIPT=')
const documentStart=sandboxDocumentSource.indexOf('export function sandboxDocument',scriptStart)
if(scriptStart<0||documentStart<scriptStart)throw Error('Sandbox renderer export boundary changed')
await writeFile(sandboxDocumentPath,sandboxDocumentSource.slice(0,scriptStart)
 +'export const SANDBOX_RENDER_SCRIPT='+JSON.stringify(SANDBOX_RENDER_SCRIPT)+';\n'
 +sandboxDocumentSource.slice(documentStart))
// Only the fixed trusted iframe renderer gets an inline-script hash. Model JS
// stays in QuickJS, not in this document. No blanket unsafe-inline scripts.
const rendererHash=createHash('sha256').update(SANDBOX_RENDER_SCRIPT).digest('base64')
const csp=`default-src 'self'; script-src 'self' 'unsafe-eval' 'sha256-${rendererHash}'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data: blob:; worker-src 'self' blob:; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'`
for(const entry of ['index.html','catalog.html','cardspec-lab.html','design-templates.html','pearl-review.html']){
 const html=await readFile(path.join(target,'ui',entry),'utf8')
 await write('ui/'+entry,html.replace(/<head>/,'<head><meta http-equiv="Content-Security-Policy" content="'+csp+'"/>'))
}
const labPath=path.join(target,'ui/src/cardspec/lab.jsx')
await writeFile(labPath,(await readFile(labPath,'utf8')).replace(/^import .*RecoveryLab[^\n]*\n/m,'').replace("requestedFixture==='recovery'?<RecoveryLab/>:<Lab />",'<Lab />'))
await write('ui/vite.config.js',`import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {resolve} from 'node:path'
import {cpSync} from 'node:fs'
export default defineConfig({
 worker:{format:'es'},define:{'import.meta.env.VITE_CLOUD_NO_TOOLS':JSON.stringify('0'),'import.meta.env.VITE_CLOUD_DEMO_TOOLS':JSON.stringify('1')},
 plugins:[react(),{name:'copy-demos',closeBundle(){cpSync('demos','dist/demos',{recursive:true})}}],
 build:{outDir:'dist',rollupOptions:{input:{main:resolve('index.html'),catalog:resolve('catalog.html'),cardspecLab:resolve('cardspec-lab.html'),designTemplates:resolve('design-templates.html'),pearlReview:resolve('pearl-review.html')}}}
})
`)
const pkg=JSON.parse(await readFile(path.join(target,'ui/package.json'),'utf8'))
pkg.scripts={build:'vite build'}
await write('ui/package.json',JSON.stringify(pkg,null,2)+'\n')
// JSX travels with CardSpec. Workers precompile and probe in isolated QuickJS;
// browsers only run the delivered module. No desktop executors or disk state.
await write('server/cardspec/sandbox.mjs',`import {compileCloudSandbox} from '../cloud-sandbox.mjs'
import {getQuickJS} from '../cloud-logic.mjs'
import {probeSandbox} from '../../shared/cardspec/sandbox-probes.mjs'
export const sandboxEnabled=()=>true
export async function compileSandbox(source,{input={},initial={},capabilities=[]}={}){
 const module=await compileCloudSandbox(source)
 return {...module,...probeSandbox(await getQuickJS(),{code:module.code,input,initial,capabilities})}
}
export async function generateSandbox(){throw Error('Sandbox is compiled with the card; regenerate the complete card')}
`)
await write('server/cardspec/checkpoints.mjs','// No remote tool reads means no prefetched-data checkpoints.\nexport const loadCheckpoint=async()=>null\nexport const saveCheckpoint=async()=>false\n')
// Workers have neither a local Chrome nor a writable evidence directory.
// Retain the candidate protocol but explicitly downgrade its verification scope.
await write('server/cardspec/debug-browser.mjs',`export async function runDebugBrowser(){return {status:'partial',reason:'云端仅完成编译与有界逻辑检查；未执行浏览器点击、布局和状态恢复验证。',runs:[]}}
runDebugBrowser.runnerKind='cloud-compile-only'
`)
await write('server/cardspec/debug-artifacts.mjs',`export async function saveDebugArtifact(){throw Error('Cloud diagnostics are embedded in card metadata; no filesystem artifacts')}
`)
const debugPath=path.join(target,'server/cardspec/debug-session.mjs')
await writeFile(debugPath,(await readFile(debugPath,'utf8'))
 .replace(/export const DEBUG_INSTRUCTION='[^\n]*'/,"export const DEBUG_INSTRUCTION='云端card_test只编译候选并做有界逻辑检查，不执行浏览器点击，不验证实际工具结果；结果partial表示未完成交互验证。可先按契约布局。检查可用后单独调用card_commit(version)提交原稿，不再抄写源码；也可直接输出完整CardSpec。不要删除功能规避错误。'")
 .replace('在无网络的真实渲染器中调试完整候选。CLI仅mock，不产生真实证据；返回错误、控件和交互变化。','云端只检查完整候选的编译和有界逻辑；不执行浏览器交互。可用候选返回partial及version，可用card_commit提交。'))
const appPath=path.join(target,'ui/src/App.jsx')
await writeFile(appPath,(await readFile(appPath,'utf8')).replace('生成期调试与修复（最多 8 次）','编译与逻辑修复（最多 8 次，云端无浏览器调试）'))
const source=(await readFile(path.join(root,'server/index.mjs'),'utf8')).replace(/\r\n/g,'\n')
function replaceRequired(text,pattern,replacement){
 if(!pattern.test(text))throw Error('Local server export boundary changed: '+pattern)
 return text.replace(pattern,replacement)
}
let core=source.slice(source.indexOf('const PHASES ='),source.indexOf('// ---------------------------------------------------------------- static + boot'))
core=replaceRequired(core,/const keyInfo = loadApiKey\(\)[\s\S]*?(?=\/\/ ---------------------------------------------------------------- design languages)/,'')
core=replaceRequired(core,/function readBody\(req, limit = 1024 \* 1024\) \{[\s\S]*?\n\}\n/,'async function readBody(req){ return req.bodyText }\n')
core=replaceRequired(core,/async function streamUpstream\(messages, options\) \{[\s\S]*?\n\}/,`async function streamUpstream(messages,options){
 const policy='当前云端是模拟CLI演示环境。目录中的CLI只返回虚构样本，所有查询结果、统计、日期、坐标和图片都必须标注演示，不声称实时新闻、真实用户态度、真实地点或可购余票。可通过目录取数、声明binding并刷新；glm.generate是真实模型生成，可按用户操作生成下一页/slot/JSON。未开放的CLI不可用，无web搜索或任意网络读取。Pexels图片仅为示意，保留署名。Web开启可声明sandbox，React/内联SVG/静态CSS源码随CardSpec一次生成并预编译，使用内联CSS或styles，不使用Tailwind类名；关闭仅原生CardSpec。'
 const scoped=messages.map((m,i)=>i===0&&m.role==='system'?{...m,content:m.content+'\\n'+policy}:m)
 if(options.research)return options.research.run(modelRound,scoped,options)
 options.budget?.model(options.stage||'generate')
 const result=await modelRound(scoped,{...options,tools:undefined,toolChoice:undefined})
 if(result.message.tool_calls?.length)throw Error('此阶段未开放工具，请在卡片生成阶段使用已披露工具。')
 return result.message.content
}`)
core=replaceRequired(core,/const scopedPayload=localToolRequest\(req,PORT\)\?payload:\{[^\n]+/,"const scopedPayload={...payload,toolsEnabled:payload.toolsEnabled!==false,renderMode:payload.renderMode==='hybrid'?'hybrid':'native',resumeToken:undefined}")
core=replaceRequired(core,/toolCatalog:toolService.catalog,researchSession,recordGeneration:recordAdaptiveGeneration/,'toolCatalog:async()=>(await toolService.catalog()).filter(t=>t.available),researchSession')
core=replaceRequired(core,/await pexelsPhoto\(r.attrs.query, controller.signal\)/,'await pexelsPhoto?.(r.attrs.query, controller.signal)')
const imports=`import {generationModelOptions} from '../shared/cardspec/generation-settings.mjs'
import {randomUUID} from 'node:crypto'
import {legacyPrompts} from './prompt.mjs'
import {parse,stripCodeFences,splitCardText} from './compiler/parse.mjs'
import {compile} from './compiler/codegen.mjs'
import {validateDil} from './compiler/validate.mjs'
import {handleCardSpec} from './cardspec/handler.mjs'
import {dateKey} from '../shared/cardspec/expression.mjs'
import {createModelClient} from './research/model-client.mjs'
import {createResearchSession} from './research/session.mjs'
import {createGenerationTools} from './cardspec/generation-tools.mjs'
import {createDatasetAnalyzer} from './cardspec/model-analysis.mjs'
import {createToolService} from './tools/service.mjs'
import {createOpenCli} from './cloud-tools.mjs'
`
await write('server/engine.mjs',`// Generated by scripts/sync-sites-source.mjs. Current local generation; no tool executors.\n${imports}
export function createEngine({model,baseUrl,key,fetchImpl=fetch,photo=null,origin='https://demo.invalid'}){
 const MODEL_NAME=model,FLUSH_INTERVAL_MS=90
 const keyInfo={ok:Boolean(key),reason:'MODEL_API_KEY missing'}
 const pexelsPhoto=photo
 const modelRound=createModelClient({base:baseUrl,key,model,fetchImpl})
 const researchSession=(onEvent,options={})=>options.enabled===false?null:createResearchSession({onEvent,maxRounds:5,maxCalls:options.budget?.policy.reads||10,maxContextChars:18000,timeoutMs:options.budget?.remaining()||options.timeoutMs||240000,budget:options.budget,extensions:createGenerationTools({...options,analyze:createDatasetAnalyzer((messages,params)=>modelRound(messages,{...params,...generationModelOptions(options.modelProfile)}),options.budget),invoke:options.invoke||((...args)=>toolService.invoke(...args))})})
 const toolService=createToolService({streamUpstream,researchSession,keyLoaded:keyInfo.ok,photo,opencli:createOpenCli({origin})})
 ${core}
 return {handleChat,placeholderSvg,toolService}
}
`)
await mkdir(path.join(target,'server/tools'),{recursive:true})
let toolSource=await readFile(path.join(root,'server/tools/service.mjs'),'utf8')
toolSource=toolSource.replace("import {toolAssets} from './assets.mjs'","const toolAssets={attach:value=>value}")
 .replace("from './opencli.mjs'","from '../cloud-tools.mjs'").replace("from './write-operations.mjs'","from '../cloud-tools.mjs'").replace("from './autocli.mjs'","from '../cloud-tools.mjs'")
await write('server/tools/service.mjs',toolSource)
// The Worker pre-instantiates a bundled WASM module; no remote runtime download.
const rich=await readFile(path.join(target,'server/cardspec/rich-validation.mjs'),'utf8')
await write('server/cardspec/rich-validation.mjs',rich.replace("import('quickjs-emscripten')","import('../cloud-logic.mjs')"))
const validator=path.join(target,'server/compiler/validate.mjs')
let validation=await readFile(validator,'utf8')
validation=replaceRequired(validation,/new Function\('DIL', 'AsyncImage', compile\(parsed\).code\)/,"parseJavaScript('function generated(DIL, AsyncImage) {\\n' + compile(parsed).code + '\\n}', {ecmaVersion:'latest'})")
await writeFile(validator,"import {parse as parseJavaScript} from 'acorn'\n"+validation)
console.log('Current generation/UI exported with allowlisted mock CLI; desktop executors, sessions and credentials excluded.')
