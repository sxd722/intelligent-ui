import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
import {CASES} from './direct-benchmark-cases.mjs'
import {SEMANTIC_CASES} from './semantic-benchmark-cases.mjs'
import {RICH_CASES} from './rich-benchmark-cases.mjs'
import {CARD_DSL_PROMPT} from '../server/cardspec/prompt.mjs'
import {DSL_PROMPT} from '../server/prompt.mjs'
const opts=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')))
const suite=opts.suite==='rich'?RICH_CASES:opts.suite==='semantic'?SEMANTIC_CASES:CASES
const base=opts.base||'http://127.0.0.1:8787',out=opts.out||'artifacts/direct-benchmark-2026-10-13'
await mkdir(out,{recursive:true})
const health=await fetch(`${base}/api/health`).then(r=>r.json())
const prompts={cardspec:CARD_DSL_PROMPT,dil:DSL_PROMPT}
await writeFile(`${out}/manifest.json`,JSON.stringify({started:new Date().toISOString(),base,model:health.model,mode:'direct',rounds:1,freshConversation:true,concurrency:2,productionParameters:{cardspec:{temperature:.4,maxTokens:8192,reasoning:'low',repairLimit:1},dil:{temperature:.7,maxTokens:8192,reasoning:'low',semanticRepair:false}},prompts:Object.fromEntries(Object.entries(prompts).map(([k,v])=>[k,{characters:v.length,sha256:createHash('sha256').update(v).digest('hex')}])),cases:suite},null,2))
for(const [format,prompt] of Object.entries(prompts))await writeFile(`${out}/prompt-${format}.txt`,prompt)
const selected=opts.cases?suite.filter(c=>opts.cases.split(',').includes(c.id)):suite
const formats=opts.formats?opts.formats.split(','):['cardspec','dil']
if(formats.some(f=>!['cardspec','dil'].includes(f)))throw new Error('formats must be cardspec and/or dil')
const jobs=selected.flatMap((c,i)=>(i%2?[...formats].reverse():formats).map(format=>({...c,format})))
const totalJobs=jobs.length
const results=[]
async function run(job){
 const path=`${out}/${job.id}-${job.format}.json`
 if(opts.resume==='true'){try{const old=JSON.parse(await readFile(path,'utf8'));results.push(old.result);return}catch{}}
 const start=Date.now(),frames=[],envelope={},applier=createDeltaApplier();let terminal,done=false,error,metadata={},theme,firstCandidate
 try{
  const response=await fetch(`${base}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:job.prompt}],format:job.format,mode:'direct'}),signal:AbortSignal.timeout(210000)})
  if(!response.ok||!response.body)throw new Error(`HTTP ${response.status}`)
  let buffer='';const decoder=new TextDecoder()
  for await(const chunk of response.body){
   buffer+=decoder.decode(chunk,{stream:true});let boundary
   while((boundary=/\r?\n\r?\n/.exec(buffer))){const block=buffer.slice(0,boundary.index);buffer=buffer.slice(boundary.index+boundary[0].length)
    for(const line of block.split('\n')){if(!line.startsWith('data:'))continue;const raw=line.slice(5).trim();if(raw==='[DONE]'){done=true;continue}
     const frame=JSON.parse(raw);frames.push({ms:Date.now()-start,frame})
     if(frame.type==='message_stream_complete')terminal=frame.status
     if(frame.type==='stream_error')error=frame.error?.message||JSON.stringify(frame.error)
     if(frame.type==='server_ste_metadata')metadata=frame.metadata
     if(frame.type==='theme')theme=frame
     if(frame.type==='stream_note'&&/修复 CardSpec/.test(frame.note))firstCandidate=structuredClone(envelope.message)
     if(!isControlEvent(frame))applier.apply(envelope,frame)
    }
   }
  }
 }catch(e){error=e.message}
 const message=envelope.message,repairCount=metadata.repair_count??message?.metadata?.repair_count??(firstCandidate?1:0)
 const status=terminal==='succeeded'&&done&&!error?'succeeded':'failed'
 const result={id:job.id,area:job.area,format:job.format,status,firstPass:status==='succeeded'&&!repairCount,repairCount,error,elapsed:Date.now()-start,metadata,diagnostics:message?.metadata?.diagnostics||[],sourceChars:message?.content?.parts?.[0]?.length||0,firstDiagnostics:firstCandidate?.metadata?.diagnostics||[]}
 await writeFile(path,JSON.stringify({result,prompt:job.prompt,checks:job.checks,theme,source:message?.content?.parts?.[0]||'',firstSource:firstCandidate?.content?.parts?.[0],message,frames},null,2))
 results.push(result);await writeFile(`${out}/summary.json`,JSON.stringify(results,null,2))
 console.log(`[${results.length}/${totalJobs}] ${job.id} ${job.format}: ${status}; repair=${repairCount}; ${result.elapsed}ms${error?' '+error:''}`)
}
await Promise.all(Array.from({length:2},async()=>{while(jobs.length)await run(jobs.shift())}))
await writeFile(`${out}/summary.json`,JSON.stringify(results,null,2))
console.log(JSON.stringify(['cardspec','dil'].map(format=>({format,total:results.filter(r=>r.format===format).length,firstPass:results.filter(r=>r.format===format&&r.firstPass).length,finalPass:results.filter(r=>r.format===format&&r.status==='succeeded').length}))))
