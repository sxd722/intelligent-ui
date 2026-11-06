import fs from 'node:fs/promises'
import {loadApiKey} from '../server/env.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {createResearchSession} from '../server/research/session.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {generateCard} from '../server/cardspec/generation.mjs'
import {createGenerationBudget,generationPolicy} from '../server/cardspec/budget.mjs'
const root='artifacts/strict-stack-qa',events=[],previews=[],usage=[],started=Date.now()
const budget=createGenerationBudget({...generationPolicy('双实验台',{debugGeneration:true}),modelCalls:5,repairs:2})
const research=createResearchSession({budget,onEvent:e=>events.push(e),extensions:createGenerationTools({enabled:false,allowPlanning:false})})
const round=createModelClient({base:process.env.MODEL_BASE_URL||'https://model-gateway.example.invalid/v1',key:loadApiKey().value,model:'glm-5.3-flash'})
try{
 const result=await generateCard({budget,research,photo:async()=>null,input:{prompt:'做一个紧凑的双实验台：两个独立的严格sandbox横向并排，每个画一个SVG圆并有独立的“记录A”或“记录B”计数按钮，初值0，使用state/setState可恢复。原生“放大”按钮修改共享半径，两个圆同步变化；两个局部记录互不影响。首屏显示全部控件，单卡不分页、不加照片、不要工具。先card_test验证记录A、记录B、放大、刷新恢复，再card_commit。'},view:{renderMode:'hybrid',debugGeneration:true,cardSize:'square',generationMode:'direct'},signal:AbortSignal.timeout(150000),emit:e=>events.push(e),onDebugCandidate:c=>{previews.push({version:c.version,atMs:Date.now()-started,valid:!!c.spec,modules:Object.keys(c.spec?.sandboxModules||{})});return fs.writeFile(root+'/live-preview-'+previews.length+'.json',JSON.stringify(c,null,2))},streamUpstream:(messages,options)=>research.run(round,messages,{...options,maxTokens:5500,onUsage:u=>usage.push(u)})})
 await fs.writeFile(root+'/live.json',JSON.stringify({status:'succeeded',title:'真实 GLM Flash · 双实验台',...result,previews,events,usage,elapsedMs:Date.now()-started},null,2));console.log(JSON.stringify({status:'succeeded',elapsedMs:Date.now()-started,previews,repairs:result.repairCount}))
}catch(e){await fs.writeFile(root+'/live.json',JSON.stringify({status:'failed',error:e.message,previews,events,usage,elapsedMs:Date.now()-started},null,2));console.log(e.message);process.exitCode=1}
