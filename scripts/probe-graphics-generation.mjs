// Optional live gateway probe. No CLI/real-world tools are enabled.
import {mkdir,writeFile} from 'node:fs/promises'
import {loadApiKey} from '../server/env.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {generateCard} from '../server/cardspec/generation.mjs'
const dir='artifacts/graphics-qa/live';await mkdir(dir,{recursive:true})
const key=loadApiKey();if(!key.ok)throw Error('Model key unavailable')
const round=createModelClient({base:process.env.MODEL_BASE_URL||'https://model-gateway.example.invalid/v1',key:key.value,model:'glm-5.3-flash'})
const results=[]
for(const [id,prompt]of [['eclipse','用一张可操作的图解释日食，拖动月球位置观察遮挡变化。示意不按真实比例，文字少，方形卡。'],['canvas','用 Canvas 点阵图展示电池能量，可调电量，提供轻微持续 CSS 动画，使用原生滑杆，方形卡。']]){
 const trace=[],start=Date.now();let calls=0
 try{
  const result=await generateCard({input:{prompt},view:{renderMode:'hybrid',generationMode:'direct',cardSize:'square'},signal:AbortSignal.timeout(180000),streamUpstream:async(m,o)=>{calls++;const r=await round(m,o);trace.push({stage:o.stage,usage:r.usage,model:r.model,source:r.message.content});return r},emit:e=>{if(e.type==='diagnostics')trace.push(e)}})
  await writeFile(`${dir}/${id}.json`,JSON.stringify(result,null,2))
  results.push({id,passed:true,calls,repairCount:result.repairCount,elapsedMs:Date.now()-start,svg:result.source.includes('<svg'),canvas:result.source.includes('<Canvas'),modules:Object.keys(result.spec.sandboxModules||{})})
 }catch(e){results.push({id,passed:false,calls,elapsedMs:Date.now()-start,error:e.message})}
 await writeFile(`${dir}/${id}-trace.json`,JSON.stringify(trace,null,2));console.log(JSON.stringify(results.at(-1)))
}
await writeFile(dir+'/results.json',JSON.stringify(results,null,2))
