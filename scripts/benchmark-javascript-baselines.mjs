import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {loadApiKey} from '../server/env.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {createResearchSession} from '../server/research/session.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {generateCard} from '../server/cardspec/generation.mjs'
import {generationPolicy,createGenerationBudget} from '../server/cardspec/budget.mjs'
import {createDatasetAnalyzer} from '../server/cardspec/model-analysis.mjs'
import {TOOLS} from '../shared/cardspec/tools.mjs'
import {fixtureValue} from '../shared/cardspec/baselines/fixtures.mjs'
import {JAVASCRIPT_BASELINES} from './javascript-baseline-cases.mjs'

const options=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')))
const root=options.out||'artifacts/javascript-upgrade/deep-baselines',modelProfile=options.model||'deep',expressionDialect=options.dialect||'js-v1'
const cases=JAVASCRIPT_BASELINES.filter(c=>!options.ids||options.ids.split(',').includes(c.id)),results=[]
const key=loadApiKey();if(!key.ok)throw Error(key.reason)
const server=await readFile('server/index.mjs','utf8'),base=process.env.MODEL_BASE_URL||server.match(/const MODEL_BASE = .*?\|\| '([^']+)'/)[1]
const client=createModelClient({base,key:key.value,model:process.env.MODEL_NAME||'glm-5.3-flash'})
const ids=['opencli.google.news','opencli.weibo.search','opencli.xiaohongshu.search','opencli.bilibili.search','opencli.bilibili.comments','opencli.ctrip.search','opencli.douban.search','opencli.douban.movie-hot','opencli.douban.subject','opencli.12306.trains','dataset.analyze','glm.generate']
const catalog=ids.map(id=>({...TOOLS[id],available:true}))
await mkdir(root,{recursive:true})
await writeFile(root+'/manifest.json',JSON.stringify({at:new Date().toISOString(),modelProfile,expressionDialect,cases,mode:'direct',profile:'adaptive-v1',renderMode:'native',analysisProfile:'production-default-low',deepOutputTokens:32768,tools:'Controlled fixtures using production contracts. Real GLM generation and analysis. No OpenCLI or Owl operations. Live source/media and UI verification are separate gates.'},null,2))
async function run(c){
 const trace=[],modelCalls=[],policy=generationPolicy(c.prompt,{profile:'adaptive-v1',mode:'direct'}),budget=createGenerationBudget(policy),signal=AbortSignal.timeout(policy.timeoutMs),started=Date.now()
 const round=async(messages,opts)=>{
  const begin=Date.now();let reasoning='',content=''
  const record={messages,requestedModel:opts.modelOverride||'glm-5.3-flash',startedAt:new Date().toISOString()};modelCalls.push(record)
  try{const result=await client(messages,{...opts,onPiece:p=>{reasoning+=p.reasoning||'';content+=p.content||'';opts.onPiece?.(p)}});Object.assign(record,{response:result.message,usage:result.usage,model:result.model});return result}
  catch(e){record.error=e.message;throw e}finally{Object.assign(record,{elapsedMs:Date.now()-begin,reasoning,content});await writeFile(root+'/'+c.id+'-progress.json',JSON.stringify({id:c.id,status:'running',at:new Date().toISOString(),budget:budget.snapshot(),modelCalls,trace},null,2))}
 }
 const analyze=createDatasetAnalyzer(round,budget)
 const extensions=createGenerationTools({catalog,goal:c.prompt,budget,allowDeck:false,renderMode:'native',analyze,invoke:async(payload,readSignal)=>{readSignal?.throwIfAborted();const value=fixtureValue(payload.tool,payload.input);trace.push({type:'fixture-tool',tool:payload.tool,input:payload.input,value});return {kind:'json',value}}})
 const research=createResearchSession({extensions,budget,onEvent:v=>trace.push(v),maxRounds:5,maxCalls:12,maxContextChars:18000,timeoutMs:policy.timeoutMs})
 const streamUpstream=(messages,opts)=>{if(opts.research)return opts.research.run(round,messages,opts);opts.budget?.model(opts.stage||'generate');return round(messages,opts)}
 let output,error
 try{output=await generateCard({streamUpstream,catalog,research,budget,input:{prompt:c.prompt+' 本次工具返回值是明确标记的测试替身，不代表实时事实。'},view:{expressionDialect,modelProfile,generationProfile:'adaptive-v1',generationMode:'direct',renderMode:'native',cardSize:'square'},signal,emit:v=>trace.push(v)})}catch(e){error=e.message}
 const result={id:c.id,status:output?'generated':'failed',error,elapsedMs:Date.now()-started,repairCount:output?.repairCount,budget:budget.snapshot(),sourceHash:output?createHash('sha256').update(output.source).digest('hex'):null,uiVerified:false,functionalParityVerified:false}
 await writeFile(root+'/'+c.id+'.json',JSON.stringify({result,prompt:c.prompt,output,trace,modelCalls,records:extensions.records()},null,2))
 results.push(result);await writeFile(root+'/summary.json',JSON.stringify(results,null,2));console.log(JSON.stringify(result))
}
const jobs=[...cases];await Promise.all(Array.from({length:Math.max(1,Math.min(2,Number(options.concurrency)||2))},async()=>{while(jobs.length)await run(jobs.shift())}))
