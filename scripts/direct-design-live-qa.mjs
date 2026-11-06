import fs from 'node:fs/promises'
import {loadApiKey,loadOpenAIImageKey} from '../server/env.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {createDesignMockService} from '../server/design-mock-service.mjs'
import {diskImageStorage} from '../server/image-storage.mjs'
import {generateCard} from '../server/cardspec/generation.mjs'
import {resolveMockDesign} from '../shared/cardspec/design-mock-layout.mjs'
const root='artifacts/direct-image-qa',http=[],modelCalls=[],charges=[]
const round=createModelClient({base:process.env.MODEL_BASE_URL||'https://model-gateway.example.invalid/v1',key:loadApiKey().value,model:'glm-5.3-flash',openaiKey:loadOpenAIImageKey().value,fetchImpl:async(url,args)=>{
 const b=JSON.parse(args.body),r=await fetch(url,args);modelCalls.push({model:b.model,host:new URL(url).host,status:r.status,images:b.messages.flatMap(m=>Array.isArray(m.content)?m.content:[]).filter(c=>c.type==='image_url').length,at:new Date().toISOString()});return r
}})
const photo=async()=>null
photo.designMock=createDesignMockService({key:loadOpenAIImageKey().value,storage:diskImageStorage('.cache/images'),fetchImpl:async(url,args)=>{const r=await fetch(url,args);http.push({path:new URL(url).pathname,status:r.status});return r}})
const goal='做一张紧凑的昼夜观察互动卡。设计主图体现白天和夜晚的对照。用户点击“白天”或“夜晚”，同一处简短解释和选中状态立即变化；不保存A/B、不用工具、不另加图片。只用原生CardSpec和一个状态，配合设计图的颜色和构图，保持方形可读。'
// Test the real image service once; subsequent models reuse exactly this image.
const imageStart=Date.now(),mock=await photo.designMock({goal,cardSize:'square',signal:AbortSignal.timeout(130000),budget:{model:s=>charges.push(s)}})
await fs.writeFile(root+'/live-image.json',JSON.stringify({mock,http,charges,elapsedMs:Date.now()-imageStart},null,2))
console.log('image ready',mock.id,Date.now()-imageStart,'ms',JSON.stringify(http))
const runs=[]
for(const profile of ['deepseek-flash','gpt-instant','default']){
 const events=[],usage=[],start=Date.now(),callStart=modelCalls.length
 try{
  const result=await generateCard({input:{prompt:goal},photo,view:{modelProfile:profile,designMode:'image-first',renderMode:'native',cardSize:'square',generationMode:'direct',expressionDialect:'js-v1'},signal:AbortSignal.timeout(90000),emit:e=>events.push(e),streamUpstream:async(messages,opts)=>{const r=await round(messages,{...opts,onUsage:u=>usage.push(u)});return r.message.content}})
  const run={status:'succeeded',title:profile+' 原图直传',prompt:goal,...result,metadata:{resources:result.resources},resolvedDesign:resolveMockDesign(result.spec),usage,events,modelCalls:modelCalls.slice(callStart),wallMs:Date.now()-start}
  await fs.writeFile(root+'/live-'+profile+'.json',JSON.stringify(run,null,2));runs.push({profile,status:run.status,wallMs:run.wallMs,repairs:result.repairCount,layoutSource:run.resolvedDesign?.layoutSource,modelCalls:run.modelCalls});console.log(JSON.stringify(runs.at(-1)))
 }catch(e){const r={profile,status:'failed',error:e.message,wallMs:Date.now()-start,events,modelCalls:modelCalls.slice(callStart)};await fs.writeFile(root+'/live-'+profile+'.json',JSON.stringify(r,null,2));runs.push(r);console.log(profile,r.error)}
}
// Harmless function call proves the same provider can enter the existing tool loop.
const tool=await round([{role:'user',content:'Call choose_mode with mode night.'}],{modelOverride:'chat-latest',maxTokens:200,signal:AbortSignal.timeout(30000),tools:[{type:'function',function:{name:'choose_mode',description:'Choose a display mode',parameters:{type:'object',properties:{mode:{type:'string',enum:['day','night']}},required:['mode'],additionalProperties:false}}}],toolChoice:{type:'function',function:{name:'choose_mode'}}})
await fs.writeFile(root+'/live-summary.json',JSON.stringify({runs,http,charges,toolProbe:{model:tool.model,calls:tool.message.tool_calls,usage:tool.usage}},null,2))
console.log('GPT function call',tool.message.tool_calls?.[0]?.function?.name)
