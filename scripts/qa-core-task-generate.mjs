import {mkdir,writeFile,appendFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const root='artifacts/core-task-routing-20261111'+(process.env.QA_ROUND?'/'+process.env.QA_ROUND:''),dest='public/core-task-routing/'+(process.env.QA_ROUND?process.env.QA_ROUND+'/':'')+'runs',base='http://127.0.0.1:8787'
await mkdir(root,{recursive:true});await mkdir(dest,{recursive:true})
const cases=[
 {id:'social',title:'游戏口碑样本',prompt:'原神 枪战 影域，玩家到底是喜欢还是讨厌？采集真实社交平台结果，按标题或实际评论分别注明范围；首屏看态度分布，切换来源或态度会更新样本列表，点开可以看原文。不要人工写关键词分类，不需要自动刷新；先做一张可用卡。'},
 {id:'movies',title:'今晚看什么',prompt:'今晚看什么？找豆瓣正在热映的真实电影。能按类型筛选、选两部比较、打开详情看新增信息并返回。优先用宿主已有能力做一张卡，不需要再解释怎么实现。'},
 {id:'travel',title:'周末亲子',prompt:'周末带4岁孩子在杭州玩，查询真实景点和天气；选择几个景点，看看已选地点、天气是否适合出行。先做一个小而实用的选择面板，不预编具体日期，不要求购买或导航。'},
 {id:'gpa',title:'成绩试算',prompt:'做一个GPA计算器，初始数学3学分4.0、英语2学分3.0、历史2学分3.5。选择课程并修改成绩，立即显示新的加权结果；刷新保留修改。不需要工具或联网。'}
]
for(const c of cases.filter(c=>!process.env.QA_CASE||process.env.QA_CASE.split(',').includes(c.id))){
 const request={messages:[{role:'user',content:c.prompt}],format:'cardspec',mode:'direct',generationProfile:'adaptive-v1',expressionDialect:'js-v1',modelProfile:'deepseek-flash',toolsEnabled:true,designMode:'host',debugGeneration:true,buildMode:'quick',cardSize:'auto',renderMode:'native',turnId:randomUUID()}
 const started=Date.now(),events=[],applier=createDeltaApplier(),envelope={};let error
 await writeFile(root+'/'+c.id+'-request.json',JSON.stringify(request,null,2));await writeFile(root+'/'+c.id+'.sse','');console.log('START '+c.id)
 try{
  const r=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(request),signal:AbortSignal.timeout(390000)});if(!r.ok)throw Error('HTTP '+r.status)
  const dec=new TextDecoder();let buffer='';for await(const chunk of r.body){const s=dec.decode(chunk,{stream:true});await appendFile(root+'/'+c.id+'.sse',s);buffer+=s;let n;while((n=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,n);buffer=buffer.slice(n+1);if(!line.startsWith('data:')||line.slice(5).trim()==='[DONE]')continue;const e=JSON.parse(line.slice(5));events.push(e);if(!isControlEvent(e))applier.apply(envelope,e);if(['cardplan','research','stream_error','message_stream_complete'].includes(e.type))console.log(JSON.stringify({case:c.id,type:e.type,phase:e.phase,status:e.status,tool:e.tool,error:e.error?.message||e.error}));}}
 }catch(e){error=e.message}
 const m=envelope.message||{},result={...c,elapsedMs:Date.now()-started,error,status:events.findLast(e=>e.type==='message_stream_complete')?.status,metadata:m.metadata,spec:m.metadata?.card_spec,source:m.metadata?.validated_source||m.content?.parts?.join('')||'',events}
 await writeFile(root+'/'+c.id+'-generation.json',JSON.stringify(result,null,2));await writeFile(dest+'/'+c.id+'.json',JSON.stringify(result));console.log('FINISH '+JSON.stringify({id:c.id,seconds:result.elapsedMs/1000,status:result.status,spec:!!result.spec,error}))
}
