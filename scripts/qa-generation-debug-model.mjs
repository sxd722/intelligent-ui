import {loadApiKey} from '../server/env.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {createResearchSession} from '../server/research/session.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {createGenerationBudget,generationPolicy} from '../server/cardspec/budget.mjs'
import {generateCard} from '../server/cardspec/generation.mjs'
import {TOOLS} from '../shared/cardspec/tools.mjs'
import {mkdir,writeFile} from 'node:fs/promises'
const out=process.env.DEBUG_QA_OUTPUT||'artifacts/generation-debug-model';await mkdir(out,{recursive:true})
const key=loadApiKey();if(!key.ok)throw Error('model key unavailable')
const round=createModelClient({base:process.env.MODEL_BASE_URL||'https://model-gateway.example.invalid/v1',key:key.value,model:'glm-5.3-flash'})
const cases=[
 {id:'simulator',prompt:'做一个三步能量模拟器：初始能量3，每步先减1，再将剩余能量累计到得分，第三步才结束。可重置和刷新恢复；展示过程与当前结果。输出前用card_test点击推进两次并reload，检查状态恢复。'},
 {id:'feed',prompt:'制作一个Hacker News榜单卡。使用autocli.hackernews.top绑定，支持刷新、选择一条查看详情、返回。无需真实查询；先按工具契约布局，真实数据运行时加载，明确加载/失败/空状态。输出前用card_test在mock中检查刷新和选择。'}
]
for(const c of cases.filter(c=>!process.argv[2]||c.id===process.argv[2])){
 const events=[],started=Date.now(),policy=generationPolicy(c.prompt,{profile:'adaptive-v1',debugGeneration:true}),budget=createGenerationBudget(policy)
 const catalog=c.id==='feed'?[{...TOOLS['autocli.hackernews.top'],available:true}]:[]
 const research=createResearchSession({budget,maxRounds:5,maxContextChars:18000,timeoutMs:300000,extensions:createGenerationTools({catalog,budget,enabled:!!catalog.length,goal:c.prompt,allowPlanning:false,invoke:async()=>{throw Error('Live calls disabled in this QA; use card_test mock transport')}})})
 let result,error
 try{result=await generateCard({input:{prompt:c.prompt},view:{debugGeneration:true,generationProfile:'adaptive-v1',generationMode:'direct',cardSize:'square',expressionDialect:'js-v1'},catalog,research,budget,signal:AbortSignal.timeout(300000),emit:e=>{events.push(e);console.log(c.id,e.type,e.status||'')},streamUpstream:(messages,options)=>research.run(round,messages,options)})}
 catch(e){error=e.message}
 await writeFile(`${out}/${c.id}.json`,JSON.stringify({case:c,elapsedMs:Date.now()-started,error,result,events,research:research.snapshot(),budget:budget.snapshot()},null,2))
 console.log(JSON.stringify({id:c.id,status:error?'failed':'generated',error,debug:result?.spec.generationDebug?.tests.map(t=>t.status),modelCalls:budget.snapshot().modelCalls,elapsedMs:Date.now()-started}))
}
