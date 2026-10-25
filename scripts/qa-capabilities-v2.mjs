// Isolated generation regression: never imports the server or OpenCLI runtime.
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {generateCard} from '../server/cardspec/generation.mjs'
import {cardGenerationPrompt} from '../server/cardspec/prompt.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {loadApiKey} from '../server/env.mjs'
import {CASES} from './direct-benchmark-cases.mjs'
const out=process.env.QA_OUT||'artifacts/cardspec-capabilities-v2',key=loadApiKey(),model=process.env.MODEL_NAME||'glm-5.3-flash'
if(!key.ok)throw Error('No configured model key')
await mkdir(out,{recursive:true})
const round=createModelClient({base:process.env.MODEL_BASE_URL||'https://model-gateway.example.invalid/v1',key:key.value,model})
const prompt=cardGenerationPrompt(null,{compact:true}),before=await readFile('artifacts/cardspec-capabilities-v2/prompt-before.txt','utf8')
await writeFile(`${out}/prompt-after.txt`,prompt)
await writeFile(`${out}/manifest.json`,JSON.stringify({at:new Date().toISOString(),model,mode:'direct',renderMode:'native',cardSize:'square',concurrency:2,temperature:.4,reasoningEffort:'low',beforeChars:before.length,afterChars:prompt.length,research:'disabled; no tools executed; real model generation',cases:CASES},null,2))
const jobs=[...CASES],results=[]
await Promise.all(Array.from({length:2},async()=>{while(jobs.length){
 const c=jobs.shift(),start=Date.now(),trace=[],calls=[];let value,error
 try{value=await generateCard({input:{prompt:c.prompt},view:{generationMode:'direct',renderMode:'native',cardSize:'square'},signal:AbortSignal.timeout(300000),emit:e=>trace.push({ms:Date.now()-start,...e}),streamUpstream:async(messages,options)=>{
  const call={systemChars:messages[0].content.length,startedMs:Date.now()-start};calls.push(call)
  const result=await round(messages,{...options,onPiece:p=>{if(p.content&&call.firstContentMs==null)call.firstContentMs=Date.now()-start;options.onPiece?.(p)}})
  call.usage=result.usage;call.elapsedMs=Date.now()-start-call.startedMs;call.content=result.message.content;return result.message.content
 }})}catch(e){error=e.message}
 const result={id:c.id,status:value?'succeeded':'failed',firstPass:!!value&&value.repairCount===0,repairCount:value?.repairCount??Math.max(0,calls.length-1),elapsedMs:Date.now()-start,sourceChars:value?.source.length,error,calls:calls.length}
 await writeFile(`${out}/${c.id}.json`,JSON.stringify({result,prompt:c.prompt,...value,trace,calls},null,2))
 results.push(result);await writeFile(`${out}/summary.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(result))
}}))
