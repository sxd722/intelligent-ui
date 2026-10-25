import {mkdir,writeFile} from 'node:fs/promises'
import {parse} from 'acorn'
import {CASES} from './direct-benchmark-cases.mjs'
import {loadApiKey} from '../server/env.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const out='artifacts/html-reference-2026-10-16',publicPath='public/html-reference'
await mkdir(out,{recursive:true});await mkdir(publicPath,{recursive:true})
const health=await fetch('http://127.0.0.1:8787/api/health').then(r=>r.json()),key=loadApiKey()
if(!key.ok)throw Error('Model key unavailable')
const model=createModelClient({base:health.upstream,key:key.value,model:health.model})
const photos={}
for(const [query,role]of [['forest sunlight','hero'],['small bird','thumbnail'],['green leaf','thumbnail']]){
 try{const r=await fetch(`http://127.0.0.1:8787/api/photo?query=${encodeURIComponent(query)}&role=${role}`,{signal:AbortSignal.timeout(20000)});if(r.ok){const p=await r.json();photos[query]={url:new URL(p.url,'http://127.0.0.1:8787').href,photographer:p.photographer,photoUrl:p.photoUrl}}}catch{}
}
const system=`你是优秀的交互界面设计师与前端工程师。完全不使用 CardSpec、DIL 或预设组件库；自由编写 HTML、CSS、JavaScript，实现用户要求的交互卡片。自行决定结构、视觉、图形、动画和状态逻辑。
只输出一个完整独立 HTML 文档（含内联 style/script），不加 Markdown 围栏或解释。视口等宽高，320–432px，默认432；内容过多可内部滚动、展开或分页，所有正文和操作可达。文字可读，触摸友好。充分实现用户明确的数量、逻辑和交互要求；不要捏造历史数据。可用内联SVG/canvas。不使用外部库/CDN、网络请求、父窗口API、存储、弹窗或真实外部操作；运行于允许脚本但隔离来源的iframe，状态保存在本页JS中。图片可用用户任务匹配的以下宿主素材；没有素材时明确示意，不能声称真实照片。图片以外不访问网络。
当前日期2026-10-16，时区Asia/Shanghai。示意照片映射：${JSON.stringify(photos)}。如用照片，在界面内保留简短摄影来源。
输出上限8192 tokens，请紧凑实现，避免截断。`
const manifest={started:new Date().toISOString(),model:health.model,temperature:.4,maxTokens:8192,reasoningEffort:'low',rounds:1,concurrency:2,cardSize:'square',cases:CASES,photos,htmlPrompt:system,cardspec:'Production direct /api/chat, toolsEnabled:false, one existing repair. Same user requests. No CLI calls.',repair:'HTML: at most one repair for incomplete document or JS syntax. Semantic/UI failures remain failures. CardSpec: existing compile/rich validation one repair.'}
await writeFile(out+'/manifest.json',JSON.stringify(manifest,null,2));await writeFile(out+'/html-system-prompt.txt',system)
const records=[]
async function publish(){const data=JSON.stringify({manifest,records},null,2);await writeFile(publicPath+'/data.json',data);try{await mkdir('dist/html-reference',{recursive:true});await writeFile('dist/html-reference/data.json',data)}catch{}await writeFile(out+'/summary.json',JSON.stringify(records.map(({source,spec,resources,...r})=>r),null,2))}
function htmlDiagnostics(raw){const errors=[];if(!/<html[\s>]/i.test(raw)||!/<\/html>\s*$/i.test(raw))errors.push('需要完整html文档及结束标签');for(const m of raw.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(/type=["']application\/ld\+json/.test(m[1]))continue;try{parse(m[2],{ecmaVersion:'latest',sourceType:/module/.test(m[1])?'module':'script'})}catch(e){errors.push(e.message)}}return errors}
async function runHtml(c){
 const started=Date.now(),attempts=[];let firstTokenMs=null,source='',status='failed',error
 const messages=[{role:'system',content:system},{role:'user',content:c.prompt}]
 for(let attempt=0;attempt<2;attempt++){
  let raw='',usage;const begin=Date.now()
  try{const r=await model(messages,{temperature:.4,maxTokens:8192,reasoningEffort:'low',signal:AbortSignal.timeout(Math.max(1,300000-(Date.now()-started))),onPiece:p=>{if(p.content){firstTokenMs??=Date.now()-started;raw+=p.content}},onUsage:u=>usage=u});raw=r.message.content;source=raw.trim().replace(/^```(?:html)?\s*/i,'').replace(/\s*```$/,'');const diagnostics=htmlDiagnostics(source);attempts.push({source:raw,diagnostics,elapsedMs:Date.now()-begin,usage});if(!diagnostics.length){status='succeeded';break}error=diagnostics.join('; ');messages.push({role:'assistant',content:raw},{role:'user',content:'修复以下错误，保留用户全部交互要求，仅输出完整HTML：'+error})}
  catch(e){error=e.message;attempts.push({source:raw,error,elapsedMs:Date.now()-begin,usage});source=raw;break}
 }
 const result={id:c.id,area:c.area,format:'html',status,firstPass:status==='succeeded'&&attempts.length===1,repairCount:attempts.length-1,elapsed:Date.now()-started,firstTokenMs,sourceChars:source.length,...(status!=='succeeded'?{error}:{})}
 await writeFile(`${out}/${c.id}-html.json`,JSON.stringify({result,prompt:c.prompt,source,attempts},null,2));return {...result,source}
}
async function runCardSpec(c){
 const started=Date.now(),frames=[],envelope={},applier=createDeltaApplier();let buffer='',terminal,error,metadata={},done=false;const decoder=new TextDecoder()
 try{const r=await fetch('http://127.0.0.1:8787/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({format:'cardspec',mode:'direct',cardSize:'square',toolsEnabled:false,messages:[{role:'user',content:c.prompt}]}),signal:AbortSignal.timeout(310000)});if(!r.ok)throw Error('HTTP '+r.status)
 for await(const bytes of r.body){buffer+=decoder.decode(bytes,{stream:true});let n;while((n=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,n);buffer=buffer.slice(n+2);for(const line of block.split('\n')){if(!line.startsWith('data:'))continue;const raw=line.slice(5).trim();if(raw==='[DONE]'){done=true;continue}const f=JSON.parse(raw);frames.push({ms:Date.now()-started,frame:f});if(f.type==='message_stream_complete')terminal=f.status;if(f.type==='stream_error')error=f.error?.message;if(f.type==='server_ste_metadata')metadata=f.metadata;if(!isControlEvent(f))applier.apply(envelope,f)}}}}
 catch(e){error=e.message}
 const m=envelope.message,repairCount=metadata.repair_count??m?.metadata?.repair_count??0,status=terminal==='succeeded'&&done&&!error?'succeeded':'failed',source=m?.content?.parts?.[0]||''
 const result={id:c.id,area:c.area,format:'cardspec',status,firstPass:status==='succeeded'&&!repairCount,repairCount,elapsed:Date.now()-started,firstTokenMs:metadata.first_content_ms,sourceChars:source.length,error}
 await writeFile(`${out}/${c.id}-cardspec.json`,JSON.stringify({result,prompt:c.prompt,source,message:m,metadata,frames},null,2));return {...result,source,spec:m?.metadata?.card_spec,resources:m?.metadata?.resources}
}
const jobs=CASES.flatMap((c,i)=>(i%2?['html','cardspec']:['cardspec','html']).map(format=>({c,format})))
let publishing=Promise.resolve()
await Promise.all(Array.from({length:2},async()=>{while(jobs.length){const {c,format}=jobs.shift();const r=await(format==='html'?runHtml(c):runCardSpec(c));records.push(r);publishing=publishing.then(publish);await publishing;console.log(JSON.stringify({id:r.id,format,status:r.status,elapsed:r.elapsed,repair:r.repairCount}))}}))
