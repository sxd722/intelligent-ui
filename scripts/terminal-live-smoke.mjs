import {writeFile,mkdir} from 'node:fs/promises'
import {loadOpenAIImageKey} from '../server/env.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {createResearchSession} from '../server/research/session.mjs'
import {createRsiJournal} from '../server/rsi-journal.mjs'
import {generateCard} from '../server/cardspec/generation.mjs'
import {generationPolicy,createGenerationBudget} from '../server/cardspec/budget.mjs'
const root='artifacts/terminal-journeys-qa/live';await mkdir(root,{recursive:true})
const goal='制作一张可玩的微型深海探险游戏，纯CardSpec。初始氧气6、宝藏0；探索消耗2氧气并获得1宝藏，休息恢复1氧气上限6。收集3宝藏成功返航；氧气耗尽且未收集3宝藏时失败。请提供一种危险行动让玩家可主动进入失败。正确处理同回合获胜与氧气耗尽的优先级。刷新保留进度并能继续。视觉紧凑，不使用图片或网络。验证从初始状态到胜利、失败与刷新恢复的路径。'
const policy=generationPolicy(goal,{generationMinutes:2,debugGeneration:true,profile:'adaptive-v1'}),budget=createGenerationBudget(policy),frames=[],journal=createRsiJournal({root:root+'/journal',autoAnalyze:false})
const raw=createModelClient({openaiKey:loadOpenAIImageKey().value,model:'chat-latest'})
const round=(m,o)=>journal.model(raw,m,o)
const research=createResearchSession({providers:null,onEvent:e=>frames.push(e),budget,timeoutMs:120000})
const res={write(s){try{frames.push(JSON.parse(s.slice(6)))}catch{}return true},end(){this.writableEnded=true},setHeader(){},getHeader(){return 'text/event-stream'}}
const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Object.assign(Error('2 minute limit'),{code:'GENERATION_TIMEOUT'})),120000),start=Date.now()
try{await journal.capture({headers:{'x-rsi-record-id':'terminal-live'}},res,{kind:'generation',prompt:goal},async()=>{
 const result=await generateCard({input:{prompt:goal},view:{modelProfile:'gpt-instant',debugGeneration:true,generationMinutes:2,generationMode:'direct',renderMode:'native',cardSize:'square'},budget,research,signal:controller.signal,emit:e=>frames.push(e),streamUpstream:async(m,o)=>o.research?o.research.run(round,m,o):(await round(m,o)).message.content})
 await writeFile(root+'/result.json',JSON.stringify(result,null,2));await writeFile(root+'/source.txt',result.source)
 console.log(JSON.stringify({elapsedMs:Date.now()-start,status:result.spec?.verificationStatus,terminalCoverage:result.spec?.terminalCoverage,budget:budget.snapshot(),diagnostics:result.diagnostics}))
})}catch(e){console.log(JSON.stringify({elapsedMs:Date.now()-start,error:e.message,code:e.code}));await writeFile(root+'/error.json',JSON.stringify({error:e.message,code:e.code}))}finally{clearTimeout(timer);await writeFile(root+'/trace.json',JSON.stringify(frames,null,2))}
