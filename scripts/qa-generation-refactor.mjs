import {mkdir,writeFile} from 'node:fs/promises'
import {EventEmitter} from 'node:events'
import {loadApiKey} from '../server/env.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {createResearchSession} from '../server/research/session.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {handleCardSpec} from '../server/cardspec/handler.mjs'
import {TOOLS} from '../shared/cardspec/tools.mjs'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const options=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')))
const out=options.out||'artifacts/generation-refactor-qa/new-scenarios';await mkdir(out,{recursive:true})
const health=await fetch('http://127.0.0.1:8787/api/health').then(r=>r.json()),key=loadApiKey()
const round=createModelClient({base:health.upstream,key:key.value,model:health.model})
const cases=[
 {id:'large-results',prompt:'先用OpenCLI查询2026-10-17杭州东到上海南的下午车次，再做可筛选分组的候选卡。先展示少量班次，选择后展开详情，不直接罗列全部。',tool:'opencli.12306.trains'},
 {id:'partial-results',prompt:'先用OpenCLI查豆瓣Top电影，只取得部分结果也应明确范围。让我挑选和比较，规划两个针对当前选择的后续交互。',tool:'opencli.douban.top250',partial:true},
 {id:'empty-results',prompt:'先用OpenCLI查询2026-10-17杭州东到上海南的车次，没有结果就呈现可修改条件的查询卡，不编造候选。',tool:'opencli.12306.trains',empty:true},
 {id:'source-failure',prompt:'先查豆瓣Top电影再做选片卡；如果来源不可用，显示失败与恢复入口，不用常识编造实际榜单。',tool:'opencli.douban.top250',failure:true},
 {id:'three-cards',prompt:'做三张相关卡：旅行预算参数试算、行李勾选、行前检查。自动生成三张，通过宿主左右切换；保留各卡输入。先调用plan_cards规划分工及两个后续意图。不查询真实服务。',tool:'opencli.douban.top250'},
 {id:'planned-followup',prompt:'做一张缓存原理探索卡，两个不同请求路径可选择，结构图联动解释。先用plan_cards为当前卡规划两个基于选择的后续生成意图；不提前写后续全文，不查外部服务。',tool:'opencli.douban.top250'}
]
const results=[]
for(const c of cases.filter(c=>!options.case||c.id===options.case)){
 const frames=[],envelope={},applier=createDeltaApplier(),invocations=[],started=Date.now(),catalog=[{...TOOLS[c.tool],available:true}]
 const value={items:c.empty?[]:Array.from({length:20},(_,i)=>c.tool.includes('12306')?{rowKey:'r'+i,code:'G'+(100+i),trainNo:'internal'+i,from:'杭州东',to:'上海南',departure:`${12+Math.floor(i/4)}:${String((i%4)*15).padStart(2,'0')}`,arrival:'18:00',duration:'01:10',secondSeat:i%3?'有':'无'}:{rowKey:'r'+i,id:String(i+1),title:'示例电影'+(i+1),year:2000+i,rating:8+i/100}),source:'controlled QA fixture',fetchedAt:new Date().toISOString(),truncated:!!c.partial}
 const streamUpstream=(m,o)=>o.research?o.research.run(round,m,o):round(m,o)
 const researchSession=(onEvent,options)=>createResearchSession({onEvent,maxCalls:10,maxContextChars:18000,timeoutMs:240000,extensions:createGenerationTools({...options,invoke:async p=>{invocations.push(p);if(c.failure)throw Error('SOURCE_UNAVAILABLE: controlled fixture');return {kind:'json',value}}})})
 const res=new EventEmitter();Object.assign(res,{writeHead(){},flushHeaders(){},write(raw){const text=raw.slice(6).trim();if(text==='[DONE]')return;const frame=JSON.parse(text);frames.push(frame);if(!isControlEvent(frame))applier.apply(envelope,frame)},end(){this.writableEnded=true}})
 await handleCardSpec({},res,{mode:'direct',messages:[{role:'user',content:c.prompt}]},{streamUpstream,researchSession,toolCatalog:async()=>catalog,keyLoaded:true,photo:async()=>null,model:health.model})
 const meta=envelope.message?.metadata||{},result={id:c.id,status:frames.findLast(f=>f.type==='message_stream_complete')?.status,elapsedMs:Date.now()-started,calls:invocations.length,deck:meta.card_deck?.map(c=>({title:c.title,status:c.status})),followups:meta.card_spec?.generationPlan?.followups,error:frames.findLast(f=>f.type==='stream_error')?.error}
 results.push(result);await writeFile(`${out}/${c.id}.json`,JSON.stringify({result,prompt:c.prompt,message:envelope.message,frames,invocations},null,2));await writeFile(`${out}/summary.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(result))
}
