import {loadApiKey} from '../server/env.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {createResearchSession} from '../server/research/session.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {createGenerationBudget,generationPolicy} from '../server/cardspec/budget.mjs'
import {generateCard} from '../server/cardspec/generation.mjs'
import {collectImages} from '../shared/cardspec/images.mjs'
import {mkdir,writeFile} from 'node:fs/promises'
const out=process.env.MATERIAL_QA_OUTPUT||'artifacts/material-motion-qa';await mkdir(out,{recursive:true})
const key=loadApiKey();if(!key.ok)throw Error('model key unavailable')
const round=createModelClient({base:process.env.MODEL_BASE_URL||'https://model-gateway.example.invalid/v1',key:key.value,model:'glm-5.3-flash'})
for(const [id,prompt] of [
 ['nature','做一个周末自然观察灵感卡，可以比较森林、湖边、山地三种环境，选择想去观察的环境后查看建议并保存选择。这是灵感示例，不要编造具体目的地或营业事实。'],
 ['living','帮我比较北欧、日式、现代三种客厅布置，选择一种后展示适合的材质和配色。做成可互动的设计灵感卡，不需要真实商品或报价。']]){
 const started=Date.now(),events=[],policy=generationPolicy(prompt,{profile:'adaptive-v1'}),budget=createGenerationBudget(policy)
 const research=createResearchSession({budget,maxRounds:4,maxContextChars:18000,timeoutMs:180000,extensions:createGenerationTools({catalog:[],budget,enabled:false,goal:prompt,allowPlanning:false,invoke:async()=>{throw Error('No live CLI in visual QA')}})})
 let result,error
 try{result=await generateCard({input:{prompt},view:{generationProfile:'adaptive-v1',generationMode:'direct',renderMode:'native',cardSize:'square',expressionDialect:'js-v1'},catalog:[],research,budget,signal:AbortSignal.timeout(180000),emit:e=>events.push(e),streamUpstream:(messages,options)=>research.run(round,messages,options)})}catch(e){error=e.message}
 const photos=result?.spec?collectImages(result.spec):[]
 const summary={id,elapsedMs:Date.now()-started,error,contentImages:photos.filter(p=>p.role!=='background').length,backgroundImages:photos.filter(p=>p.role==='background').length,modelCalls:budget.snapshot().modelCalls}
 await writeFile(`${out}/model-${id}.json`,JSON.stringify({...summary,prompt,result,events,budget:budget.snapshot()},null,2));console.log(JSON.stringify(summary))
}
