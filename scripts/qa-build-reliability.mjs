import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const directory=process.env.QA_DIRECTORY||'artifacts/build-reliability-qa'
await mkdir(directory,{recursive:true})
const cases={
 "movie-flow":"今晚看什么：从真实豆瓣榜单选择今晚的电影。按类型和最长片长筛选，筛选必须真的改变候选集合；详情展示列表没有的导演、演员和简介。选择两部进行评分、片长和类型对比，返回保留筛选及选择。海报与短摘要展示，未知资料保留未知，不编造购票或播放权限。",
 movie:JSON.parse(await readFile('artifacts/deep-build/71c1bf73-61d6-4a2c-be91-0ea31930d86e/trace.json','utf8')).goal,
 learning:'做一个电池能量教学卡：调整容量与电压，联动显示Wh和可供10W灯泡使用的小时数；进入解释视图看到公式，返回保留参数。用结构化图形解释，不用工具，不添加保存分组。',
 news:'用真实 Hacker News 工具制作今日阅读清单：显示前8条标题、分数和来源链接，支持输入关键词过滤、查看选中条目的摘要信息与原文入口、收藏两条后在收藏视图查看并移除。返回列表保留筛选。未知正文不能编造。',
}
for(const id of (process.env.QA_CASES||'learning,news').split(',')){
 const prompt=cases[id];if(!prompt)throw Error('unknown case')
 const frames=[],state={},apply=createDeltaApplier(),start=Date.now();let buffer='';const decoder=new TextDecoder()
 try{
  const r=await fetch('http://127.0.0.1:8787/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({format:'cardspec',mode:'direct',messages:[{role:'user',content:prompt}],toolsEnabled:id!=='learning',renderMode:'hybrid',cardSize:'full',expressionDialect:'js-v1',modelProfile:process.env.QA_MODEL_PROFILE||'deep',generationProfile:'adaptive-v1',debugGeneration:true,buildMode:process.env.QA_BUILD_MODE||'deep'}),signal:AbortSignal.timeout(660000)})
  if(!r.ok)throw Error('HTTP '+r.status)
  for await(const b of r.body){buffer+=decoder.decode(b,{stream:true});let i;while((i=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,i);buffer=buffer.slice(i+2);for(const line of block.split('\n'))if(line.startsWith('data:')){const raw=line.slice(5).trim();if(raw==='[DONE]')continue;const f=JSON.parse(raw);frames.push(f);if(!isControlEvent(f))apply.apply(state,f);if(['build_progress','stream_error','message_stream_complete'].includes(f.type))console.log(JSON.stringify({id,...f}))}}}
 }catch(e){frames.push({type:'qa_error',message:e.message})}
 const result={id,buildMode:process.env.QA_BUILD_MODE||'deep',elapsedMs:Date.now()-start,status:frames.findLast(f=>f.type==='message_stream_complete')?.status,error:frames.findLast(f=>f.type==='stream_error'||f.type==='qa_error')}
 await writeFile(`${directory}/${id}.json`,JSON.stringify({result,prompt,state,frames},null,2));console.log(JSON.stringify(result))
}
