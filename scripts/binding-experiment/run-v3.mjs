import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {build} from 'esbuild'
import {loadApiKey} from '../../server/env.mjs'
import {createModelClient} from '../../server/research/model-client.mjs'
import {CASES,ROOT,DEST,messagesFor,compile,transportFor,legacyCheck} from './engine-v3.mjs'
import {launchBrowser,inspect} from './browser-v3.mjs'
const args=process.argv.slice(2)
await mkdir(ROOT,{recursive:true});await mkdir(DEST+'/runs',{recursive:true})
await build({entryPoints:['scripts/binding-experiment/viewer-v3.jsx'],bundle:true,format:'esm',platform:'browser',outfile:DEST+'/viewer.js',define:{'process.env.NODE_ENV':'"production"'},loader:{'.woff2':'file','.ttf':'file','.woff':'file','.png':'file'},logLevel:'error'})
await writeFile(DEST+'/viewer.html','<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="viewer.css"><style>body{margin:0;padding:18px;background:#e6ebf2;font-family:system-ui}main{margin:auto}</style><div id="root"></div><script type="module" src="viewer.js"></script>')
const key=loadApiKey();if(!key.ok)throw Error('Gateway key unavailable')
const model='deepseek-v4-flash',round=createModelClient({base:process.env.MODEL_BASE_URL||'https://model-gateway.example.invalid/v1',key:key.value,model})
const results=[];try{results.push(...JSON.parse(await readFile(ROOT+'/results.json','utf8')))}catch{}
const manifest={model,temperature:.4,maxTokens:6000,repairs:2,cases:CASES.map(c=>({id:c.id,prompt:c.prompt})),arms:['A0','A2S'],toolMode:'synthetic controlled fixtures; no user browser access',createdAt:new Date().toISOString(),hashes:{}}
for(const file of ['engine-v3.mjs','browser-v3.mjs','cases.mjs'])manifest.hashes[file]=createHash('sha256').update(await readFile('scripts/binding-experiment/'+file)).digest('hex')
await writeFile(ROOT+'/manifest.json',JSON.stringify(manifest,null,2))
const jobs=CASES.flatMap((c,i)=>(i%2?['A2S','A0']:['A0','A2S']).map(arm=>({c,arm}))).filter(({c,arm})=>(!args[0]||args[0]===c.id)&&(!args[1]||args[1]===arm)&&!results.some(r=>r.id===c.id+'-'+arm))
const browser=await launchBrowser();let write=Promise.resolve()
try{await Promise.all(Array.from({length:2},async()=>{while(jobs.length){const {c,arm}=jobs.shift(),id=c.id+'-'+arm,messages=messagesFor(c,arm),trace=[],r={id,case:c.id,arm,model,startedAt:new Date().toISOString()},started=Date.now();let modelMs=0
 for(let i=0;i<3;i++){
  let source='';const start=Date.now()
  try{const response=await round(messages,{temperature:.4,maxTokens:6000,thinking:{type:'disabled'},signal:AbortSignal.timeout(120000),onPiece:p=>{if(p.content)source+=p.content}});modelMs+=Date.now()-start;trace.push({messages:structuredClone(messages),response,elapsedMs:Date.now()-start});r.source=response.message.content;r.reportedModel=response.model;r.attempts=i+1
   const compiled=compile(c,arm,r.source);r.complete=!!compiled.complete;r.expanded=compiled.expanded;r.diagnostics=compiled.diagnostics;r.spec=compiled.complete?compiled.spec:null
   r.runtime=compiled.complete?await legacyCheck(c,arm,c.map,compiled.spec,{transportFor}):null
   await writeFile(DEST+'/runs/'+id+'.json',JSON.stringify(r))
   r.browser=compiled.complete?await inspect(browser,c,r,{dir:ROOT}):null
   const passed=r.complete&&r.runtime?.passed&&r.browser?.passed
   if(i===0)r.firstPass=!!passed
   r.passed=!!passed
   await writeFile(ROOT+'/'+id+'-attempt-'+(i+1)+'.json',JSON.stringify({source:r.source,diagnostics:r.diagnostics,runtime:r.runtime,browser:r.browser},null,2))
   if(passed)break
   const feedback=[...(r.diagnostics||[]).filter(d=>d.severity==='error').map(d=>d.message),...(r.runtime?.checks||[]).filter(c=>!c.passed).map(c=>c.name+': '+c.error),...(r.browser?.checks||[]).filter(c=>!c.passed).map(c=>c.name+': '+c.error)]
   if(i<2)messages.push({role:'assistant',content:r.source},{role:'user',content:'仅修复以下验证失败，保留全部需求，不复制宿主声明。输出完整card：'+JSON.stringify(feedback.slice(0,5))})
  }catch(e){modelMs+=Date.now()-start;r.error=e.message;r.passed=false;trace.push({messages:structuredClone(messages),error:e.message,partialSource:source,elapsedMs:Date.now()-start});break}
 }
 r.modelMs=modelMs;r.elapsedMs=Date.now()-started;r.usage=trace.reduce((v,t)=>{for(const k of ['prompt_tokens','completion_tokens','total_tokens'])v[k]+=t.response?.usage?.[k]||0;return v},{prompt_tokens:0,completion_tokens:0,total_tokens:0})
 r.tracePath=id+'-trace.json';await writeFile(ROOT+'/'+r.tracePath,JSON.stringify(trace,null,2));await writeFile(DEST+'/runs/'+id+'.json',JSON.stringify(r));results.push(r);write=write.then(()=>writeFile(ROOT+'/results.json',JSON.stringify(results,null,2)));await write
 console.log(JSON.stringify({id,passed:r.passed,attempts:r.attempts,modelMs:r.modelMs,errors:r.browser?.checks.filter(c=>!c.passed),error:r.error}))
}}))}finally{await browser.close()}
