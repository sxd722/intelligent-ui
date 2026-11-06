import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {build} from 'esbuild'
import {chromium} from '@playwright/test'
import {loadApiKey} from '../../server/env.mjs'
import {createModelClient} from '../../server/research/model-client.mjs'
import {S2_CASES,ROOT,DEST,messagesFor,compile,checkHost} from './s2-engine.mjs'
import {inspectS2} from './s2-browser.mjs'
const gate=JSON.parse(await readFile('artifacts/tool-binding-qa/deepseek-v4-flash-20261102-v5/replay.json','utf8'))
if(['movies','weather','trains','family','metrics','videos'].some(id=>gate.filter(x=>x.arm==='A2S'&&x.case===id&&x.passed).length!==6))throw Error('S1 gate not satisfied')
await mkdir(ROOT,{recursive:true});await mkdir(DEST+'/runs',{recursive:true})
await build({entryPoints:['scripts/binding-experiment/s2-viewer.jsx'],bundle:true,format:'esm',platform:'browser',outfile:DEST+'/viewer.js',define:{'process.env.NODE_ENV':'"production"'},loader:{'.woff2':'file','.ttf':'file','.woff':'file','.png':'file'},logLevel:'error'})
await writeFile(DEST+'/viewer.html','<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="viewer.css"><style>body{margin:0;padding:18px;background:#e6ebf2;font-family:system-ui}main{margin:auto}</style><div id="root"></div><script type="module" src="viewer.js"></script>')
const mode=process.argv[2]||'run',repeat=Number(process.env.BINDING_REPEATS||2)
if(mode==='preflight'){
 for(const c of S2_CASES){const ui=c.static?'<title>本地视觉预检</title>':c.sources.map((s,i)=>`<collection label="资料${i+1}" items={derived.rows_${s.key}} onSelect="pick_${s.key}"/>`).join(''),r=compile(c,'A2S','<card>'+ui+'</card>'),host=r.complete?await checkHost(c,'A2S',r.spec):null;console.log(JSON.stringify({id:c.id,compiled:r.complete,host,errors:r.diagnostics?.filter(d=>d.severity==='error').map(d=>d.message)}));if(!r.complete||!host?.passed)process.exitCode=1}process.exit()
}
const key=loadApiKey();if(!key.ok)throw Error('Missing gateway credentials')
const model='deepseek-v4-flash',round=createModelClient({base:process.env.MODEL_BASE_URL||'https://model-gateway.example.invalid/v1',key:key.value,model}),results=[]
try{results.push(...JSON.parse(await readFile(ROOT+'/results.json','utf8')))}catch{}
const manifest={model,repeat,temperature:.4,maxTokens:6000,maxRepairs:2,createdAt:new Date().toISOString(),cases:S2_CASES,scope:'28 original requests, synthetic fixtures, A0/A2S paired. Source discovery held constant; UI contract reduced to isolate binding. Full task coverage not equivalent to binding probes.',hashes:{}}
for(const file of ['s2-engine.mjs','s2-cases.mjs','s2-browser.mjs'])manifest.hashes[file]=createHash('sha256').update(await readFile('scripts/binding-experiment/'+file)).digest('hex')
await writeFile(ROOT+'/manifest.json',JSON.stringify(manifest,null,2))
const jobs=S2_CASES.flatMap((c,i)=>Array.from({length:repeat},(_,rep)=>(i%2?['A2S','A0']:['A0','A2S']).map(arm=>({c,arm,rep,id:c.id+'-'+arm+'-'+rep}))).flat()).filter(j=>!results.some(r=>r.id===j.id)&&(!process.env.S2_ONLY||process.env.S2_ONLY.split(',').includes(j.c.id))&&(!process.env.S2_ARM||j.arm===process.env.S2_ARM))
const browser=await chromium.launch({channel:'chrome',headless:true});let writing=Promise.resolve()
try{await Promise.all(Array.from({length:2},async()=>{while(jobs.length){const {c,arm,rep,id}=jobs.shift(),messages=messagesFor(c,arm),trace=[],r={id,case:c.id,arm,rep,model,startedAt:new Date().toISOString()},start=Date.now();let modelMs=0
 for(let attempt=0;attempt<3;attempt++){
  const t=Date.now();try{
   const response=await round(messages,{temperature:.4,maxTokens:6000,thinking:{type:'disabled'},signal:AbortSignal.timeout(90000)});modelMs+=Date.now()-t;trace.push({messages:structuredClone(messages),response,elapsedMs:Date.now()-t});r.source=response.message.content;r.reportedModel=response.model;r.attempts=attempt+1
   const compiled=compile(c,arm,r.source);r.complete=!!compiled.complete;r.spec=compiled.complete?compiled.spec:null;r.expanded=compiled.expanded;r.diagnostics=compiled.diagnostics
   r.host=compiled.complete?await checkHost(c,arm,compiled.spec):null
   await writeFile(DEST+'/runs/'+id+'.json',JSON.stringify(r));r.browser=compiled.complete?await inspectS2(browser,c,r,{dir:ROOT}):null
   r.passed=!!r.host?.passed&&!!r.browser?.passed;if(attempt===0)r.firstPass=r.passed
   await writeFile(ROOT+'/'+id+'-attempt-'+attempt+'.json',JSON.stringify({source:r.source,host:r.host,browser:r.browser,diagnostics:r.diagnostics},null,2))
   if(r.passed)break
   const feedback=[...(r.diagnostics||[]).filter(x=>x.severity==='error').map(x=>({message:x.message,line:x.line,context:compiled.expanded?.split('\n').slice(Math.max(0,(x.line||1)-2),(x.line||1)+1).join('\n')})),...(r.host?.checks||[]).filter(x=>!x.passed).map(x=>x.name+':'+JSON.stringify(x.errors||'')),...(r.browser?.checks||[]).filter(x=>!x.passed).map(x=>x.name+':'+x.error)]
   if(attempt<2)messages.push({role:'assistant',content:r.source},{role:'user',content:'修复以下失败，保留全部需求。完整输出card。不要复制宿主声明，不用root或CardSpec标签。'+JSON.stringify({failures:feedback.slice(0,5),observed:r.browser?.steps?.map(s=>({bindings:s.bindings,calls:s.calls})),required:c.write?'保留用户触发按钮，未调用不能宣称成功，success才展示回执；不能用静态成功文案替代执行':undefined})})
  }catch(e){modelMs+=Date.now()-t;r.error=e.message;r.passed=false;trace.push({error:e.message,elapsedMs:Date.now()-t,messages:structuredClone(messages)});break}
 }
 r.modelMs=modelMs;r.elapsedMs=Date.now()-start;r.usage=trace.reduce((v,t)=>{for(const k of ['prompt_tokens','completion_tokens','total_tokens'])v[k]+=t.response?.usage?.[k]||0;return v},{prompt_tokens:0,completion_tokens:0,total_tokens:0});r.tracePath=id+'-trace.json'
 await writeFile(ROOT+'/'+r.tracePath,JSON.stringify(trace,null,2));await writeFile(DEST+'/runs/'+id+'.json',JSON.stringify(r));results.push(r);writing=writing.then(()=>writeFile(ROOT+'/results.json',JSON.stringify(results,null,2)));await writing;console.log(JSON.stringify({id,passed:r.passed,attempts:r.attempts,ms:modelMs,error:r.error}))
}}))}finally{await browser.close()}
