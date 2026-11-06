import fs from 'node:fs/promises'
import {REFINE_SYSTEM,refineContext,REFINE_POLICY_VERSION} from '../server/cardspec/refine-policy.mjs'
const dir='artifacts/refine-experience-qa'+(process.env.REFINE_QA_ROUND?'/'+process.env.REFINE_QA_ROUND:'')
await fs.mkdir(dir,{recursive:true})
const cases=[
 {id:'simple',prompt:'做一个GPA计算器',cardSize:'square',renderMode:'native',toolsEnabled:false},
 {id:'rail',prompt:'周五杭州去上海、周日返回，帮我挑两班车并固定，能跳转购票。不要漏掉下午的车次。',cardSize:'square',renderMode:'native',toolsEnabled:true},
 {id:'movies',prompt:'今晚看什么？想看看真实电影海报，选两部比较，看详情之后还能回到之前的选择。',cardSize:'auto',renderMode:'native',toolsEnabled:true,designPreference:'folio'},
 {id:'family',prompt:'萧山带娃两天，地图上选几个地方，结合预算和孩子年龄排个计划，所有内容放一张长卡。',cardSize:'full',renderMode:'native',toolsEnabled:true},
 {id:'animation',prompt:'互动讲解自行车的链轮和链条如何传动，调踏频看轮子变化，要有动画。',cardSize:'square',renderMode:'hybrid',toolsEnabled:false,designPreference:'atlas'},
 {id:'complex',prompt:'做一个计算机组成原理学习卡：讲解CPU、缓存和内存的关系，能逐步演示一次读数据的过程，调整输入观察命中与未命中，做习题后看答案和分析。',cardSize:'auto',renderMode:'hybrid',toolsEnabled:false,designMode:'image-first'},
].filter(c=>!process.env.REFINE_QA_ONLY||process.env.REFINE_QA_ONLY.split(',').includes(c.id))
const results=[]
async function run(c){
 const payload={...c,modelProfile:process.env.REFINE_QA_MODEL||'deepseek-flash'},start=Date.now()
 try{
  const response=await fetch('http://127.0.0.1:8787/api/refine-prompt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(55000)})
  const result=await response.json(),record={...c,modelProfile:payload.modelProfile,httpStatus:response.status,wallMs:Date.now()-start,result}
  results.push(record);await fs.writeFile(dir+'/'+c.id+'.json',JSON.stringify({...record,messages:[{role:'system',content:REFINE_SYSTEM},{role:'user',content:JSON.stringify(refineContext(payload))}]},null,2))
  console.log(c.id,response.status,result.policyVersion,result.prompt?.length,record.wallMs)
 }catch(e){results.push({...c,error:e.message,wallMs:Date.now()-start});console.log(c.id,e.message)}
}
let cursor=0
await Promise.all([0,1].map(async()=>{while(cursor<cases.length)await run(cases[cursor++])}))
await fs.writeFile(dir+'/results.json',JSON.stringify({policyVersion:REFINE_POLICY_VERSION,results},null,2))
for(const r of results)console.log('\n--- '+r.id+' ---\n'+(r.result?.prompt||r.error||r.result?.error))
if(results.some(r=>r.httpStatus!==200||r.result.policyVersion!==REFINE_POLICY_VERSION))process.exitCode=1
