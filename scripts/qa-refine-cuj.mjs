import fs from 'node:fs/promises'
import {loadApiKey} from '../server/env.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {refinePrompt} from '../server/cardspec/refine-prompt.mjs'
import {REFINE_POLICY_VERSION} from '../server/cardspec/refine-policy.mjs'
const root='artifacts/refine-cuj-qa',dir=root+(process.env.REFINE_CUJ_ROUND?'/'+process.env.REFINE_CUJ_ROUND:'');await fs.mkdir(dir,{recursive:true})
const previous=await fs.readFile(root+'/policy-before.txt','utf8'),oldSystem=previous.split('export const REFINE_SYSTEM=`')[1].split('`\n')[0].replace(/`\r?\n[\s\S]*$/,'')
if(!oldSystem||oldSystem.includes('export function'))throw Error('baseline extraction failed')
const key=loadApiKey();if(!key.ok)throw Error('Model credential unavailable')
const round=createModelClient({base:process.env.MODEL_BASE_URL||'https://model-gateway.example.invalid/v1',key:key.value,model:'glm-5.3-flash'})
const cases=[
 {id:'simple',prompt:'做一个GPA计算器',cardSize:'square',toolsEnabled:false},
 {id:'forest',prompt:'给孩子的森林观察卡：在树叶、鸟和蘑菇三个对象之间选择，放大观察特征，勾选今天的发现，显示已发现数量。只做一张432px卡片，有趣且易操作。',cardSize:'square',toolsEnabled:false},
 {id:'mountains',prompt:'做一张《疯狂山脉》阅读探索卡：按出发准备、海上穿越、登岸与山脉探索理解情节，串起人物动机、关键线索和恐怖感的变化。能选择阶段看细节，并整理我的发现，不要只给剧情简介。',cardSize:'auto',toolsEnabled:false},
 {id:'movies',prompt:'今晚看什么？想看看真实电影海报，按类型筛选，选两部比较，看详情之后还能回到之前的选择。',cardSize:'auto',toolsEnabled:true},
 {id:'family',prompt:'萧山带娃两天，在地图上选多个景点，用孩子年龄和预算规划两天路线，可调整后查看变化，不要只列景点；所有内容放一张完整长卡。',cardSize:'full',toolsEnabled:true},
 {id:'learning',prompt:'讲解CPU、缓存和内存的关系，逐步演示读数据过程，调整输入观察命中与未命中；给一组习题，作答后看答案和分析。',cardSize:'auto',toolsEnabled:false},
]
const jobs=cases.flatMap(c=>[{c,variant:'new',modelProfile:'deepseek-flash'},...(['simple','mountains','family'].includes(c.id)?[{c,variant:'old',modelProfile:'deepseek-flash'}]:[])]).concat(['forest','learning'].map(id=>({c:cases.find(c=>c.id===id),variant:'new',modelProfile:'default'})))
let cursor=0;const results=[]
await Promise.all([0,1].map(async()=>{while(cursor<jobs.length){const {c,variant,modelProfile}=jobs[cursor++],id=`${c.id}-${variant}-${modelProfile}`,file=dir+'/'+id+'.json';
 try{const cached=JSON.parse(await fs.readFile(file,'utf8'));if(cached.policyVersion===(variant==='new'?REFINE_POLICY_VERSION:'v3')){results.push(cached);continue}}catch{}
 let messages,calls=0,reportedModel;const start=Date.now()
 try{const result=await refinePrompt({...c,renderMode:'native',modelProfile},{streamUpstream:async(m,o)=>{calls++;messages=variant==='old'?[{role:'system',content:oldSystem},m[1]]:m;const r=await round(messages,o);reportedModel=r.model;return r.message.content}})
 const record={id,case:c,variant,modelProfile,reportedModel,policyVersion:variant==='new'?REFINE_POLICY_VERSION:'v3',calls,wallMs:Date.now()-start,result,messages,signals:{cujIds:[...new Set(result.prompt.match(/CUJ-\d+/g)||[])],characters:result.prompt.length}}
 results.push(record);await fs.writeFile(file,JSON.stringify(record,null,2));console.log(id,'ok',record.wallMs,record.signals.characters,record.signals.cujIds.length)
 }catch(e){const record={id,case:c,variant,modelProfile,policyVersion:variant==='new'?REFINE_POLICY_VERSION:'v3',calls,wallMs:Date.now()-start,error:e.message};results.push(record);await fs.writeFile(file,JSON.stringify(record,null,2));console.log(id,'failed',record.wallMs,e.message)}
 }}))
await fs.writeFile(dir+'/results.json',JSON.stringify(results,null,2))
