import {mkdir,writeFile} from 'node:fs/promises'
import {loadApiKey} from '../server/env.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {createResearchProviders} from '../server/research/providers.mjs'
import {refinePrompt} from '../server/cardspec/refine-prompt.mjs'
const root='artifacts/refine-background-20261111'
await mkdir(root,{recursive:true})
const health=await(await fetch('http://127.0.0.1:8787/api/health')).json(),key=loadApiKey()
if(!key.ok)throw Error('Missing model credential')
const round=createModelClient({base:health.upstream,key:key.value,model:'glm-5.3-flash'})
const providers=createResearchProviders({base:health.upstream,key:key.value,model:'glm-5.3-flash'})
const cases=[
 {id:'game',prompt:'原神7.x的枪战和影域现在口碑怎么样？采集真实社交平台结果，看看玩家喜欢和不喜欢的理由，能按来源和态度筛选并打开原文。只做一张可用卡。'},
 {id:'distinct',prompt:'比较Switch和Switch 2的玩家反馈，按平台看真实体验和选购取舍。'},
 {id:'alias',prompt:'周末想在胡志明市（西贡）玩两天，查真实景点和天气，多选地点再安排行程。'},
 {id:'gpa',prompt:'做个GPA计算器，三门课各填学分和绩点，修改后更新加权结果。'}
]
for(const c of cases.filter(c=>!process.env.QA_CASE||process.env.QA_CASE.split(',').includes(c.id))){
 const payload={prompt:c.prompt,modelProfile:'deepseek-flash',toolsEnabled:true,cardSize:'auto',renderMode:'native'}
 const record={...c,payload,calls:[]}
 console.log('START '+c.id)
 try{record.result=await refinePrompt(payload,{providers,streamUpstream:(messages,options)=>{
  const call=async(m,o)=>{const started=Date.now(),r=await round(m,o);record.calls.push({messages:m,response:r,elapsedMs:Date.now()-started});console.log(JSON.stringify({case:c.id,elapsedMs:Date.now()-started,tools:r.message.tool_calls?.map(t=>t.function.name)}));return r}
  return options.research?options.research.run(call,messages,options):call(messages,options).then(r=>r.message.content)
 }})}catch(e){record.error=e.message}
 await writeFile(root+'/'+c.id+'.json',JSON.stringify(record,null,2))
 console.log(JSON.stringify({case:c.id,error:record.error,seconds:record.result?.elapsedMs/1000,sources:record.result?.research.evidence.length,searches:record.result?.research.searches}))
}
