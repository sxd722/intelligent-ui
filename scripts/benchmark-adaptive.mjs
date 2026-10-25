import {mkdir,writeFile} from 'node:fs/promises'
import {CASES} from './direct-benchmark-cases.mjs'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const options=Object.fromEntries(process.argv.slice(2).map(x=>x.replace(/^--/,'').split('=')))
const root=options.out||'artifacts/adaptive-eval',results=[],dialects=(options.dialects||options.dialect||'legacy').split(',')
if(dialects.some(d=>!['legacy','js-v1'].includes(d)))throw Error('Unsupported benchmark dialect')
const extra=[
 {id:'21-opinion',prompt:'做车辆反馈样本分析卡。仅用示例：a 正面 10月20日“刹车响应好”，b 负面 10月20日“异响令人担心”，c 未知 10月21日“还没试驾”。可筛态度、核对原文、查看样本数量，不能声称代表全网。'},
 {id:'22-family',prompt:'亲子周末规划，示例POI：公园a（30.16,120.24）免费、博物馆b（30.17,120.25）30元、植物园c（30.18,120.26）20元。第一屏看位置，可多选，确认后显示已选地点和总预算，可返回修改。'},
 {id:'23-movies',prompt:'今晚看什么：仅用示例电影 a 星海 科幻 120分钟，b 纸飞机 动画 90分钟，c 日常 剧情 105分钟。选择两部比较，按时长与类型筛选，保存决定；无真实场次，不编购票链接。'},
 {id:'24-mlp',prompt:'做可交互单层MLP计算显微镜。两个输入[1,2]，权重[[3],[4]]，输出11。可调第一输入0–4，显示每个输入贡献和输出，添加残差1，揭晓加残差后的结果。标注教学玩具模型。重置恢复。'},
 {id:'25-trains',prompt:'示例往返订票助手：去程G1 10:00、G2 11:00；返程G3 16:00、G4 18:00。去返各选一班固定显示，允许改选。用户设定的起售时刻2026-11-01T08:00:00+08:00做倒计时；官方12306链接 https://www.12306.cn ，不编实际余票。'},
 {id:'26-energy',prompt:'家用电量试算，冰箱100W开24小时，灯20W开5小时，用户可改灯时长0–12小时，显示两者每天用电和合计，点击图形解释对应计算。'},
 {id:'27-garden',prompt:'园艺观察卡，薄荷每3天、绿萝每7天浇水。用户选择植物、标记今天已浇，切换后保持各自记录，可撤销。不要编造过去记录。'},
 {id:'28-debug',prompt:'设计家庭Wi-Fi排障交互，先选择“所有设备断网”或“只有一台”，再回答指示灯是否异常，给出对应安全检查步骤，可以返回修改早期答案；不要建议重置路由器密码。'},
 {id:'29-exhibition',prompt:'展览探索卡，示例三展品：机械钟（技术）、古地图（地理）、植物标本（自然），可选兴趣和收藏，多选后给出参观顺序，不编历史事实，细节按需查看。'},
 {id:'30-resources',prompt:'三回合营地模拟，初始食物5、体力5，每回合选择采集（体力-2食物+3）或休息（食物-1体力+2），付费后资源不能负数，显示结果后再下一回合，终局总结，重开恢复全部状态。'}
]
const cases=(options.extra==='1'?[...CASES,...extra]:CASES).filter(c=>!options.ids||options.ids.split(',').includes(c.id))
await mkdir(root,{recursive:true})
const health=await fetch('http://127.0.0.1:8787/api/health').then(r=>r.json())
await writeFile(root+'/manifest.json',JSON.stringify({model:options.model==='deep'?'glm-5.3':health.model,modelProfile:options.model||'default',expressionDialects:dialects,concurrency:Math.max(1,Math.min(2,Number(options.concurrency)||2)),rounds:Number(options.rounds||1),temperature:.4,tools:false,sources:'Original 20 requests, added tasks explicitly synthetic; tool workflow and live-source QA are separate',cardSize:'square',renderMode:'native',cases},null,2))
const jobs=[]
for(let round=1;round<=Number(options.rounds||1);round++)for(const [index,c]of cases.entries())for(const profile of options.profiles?.split(',')||['legacy','adaptive-v1'])for(const dialect of index%2?[...dialects].reverse():dialects)jobs.push({c,profile,round,dialect})
async function run({c,profile,round,dialect}){
 const folder=`${root}/${profile}/${dialects.length>1?dialect+"/":""}r${round}`;await mkdir(folder,{recursive:true})
 const start=Date.now(),frames=[],envelope={},applier=createDeltaApplier();let buffer='',error,terminal,metadata={}
 try{
  const r=await fetch('http://127.0.0.1:8787/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({format:'cardspec',mode:'direct',generationProfile:profile,expressionDialect:dialect,modelProfile:options.model||'default',cardSize:'square',renderMode:'native',toolsEnabled:false,messages:[{role:'user',content:c.prompt}]}),signal:AbortSignal.timeout(930000)})
  if(!r.ok)throw Error('HTTP '+r.status)
  const decoder=new TextDecoder()
  for await(const bytes of r.body){buffer+=decoder.decode(bytes,{stream:true});let n;while((n=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,n);buffer=buffer.slice(n+2);for(const line of block.split('\n')){
   if(!line.startsWith('data:'))continue;const data=line.slice(5).trim();if(data==='[DONE]')continue
   const frame=JSON.parse(data);frames.push({ms:Date.now()-start,frame})
   if(frame.type==='message_stream_complete')terminal=frame.status
   if(frame.type==='server_ste_metadata')metadata=frame.metadata
   if(frame.type==='stream_error')error=frame.error?.message
   if(!isControlEvent(frame))applier.apply(envelope,frame)
  }}}
 }catch(e){error=e.message}
 const message=envelope.message,source=message?.content?.parts?.[0]||'',repairCount=metadata.repair_count||0
 const result={id:c.id,profile,round,expressionDialect:dialect,format:'cardspec',status:terminal==='succeeded'&&message?.metadata?.card_spec?'succeeded':'failed',error,repairCount,firstPass:terminal==='succeeded'&&!repairCount,elapsed:Date.now()-start,firstUsableMs:metadata.first_usable_ms??null,budget:metadata.generationBudget,promptChars:message?.metadata?.card_spec?.generationPrompt?.systemChars}
 await writeFile(`${folder}/${c.id}-cardspec.json`,JSON.stringify({result,prompt:c.prompt,source,message,metadata,frames},null,2))
 results.push(result);await writeFile(root+'/summary.json',JSON.stringify(results,null,2));console.log(JSON.stringify(result))
}
await Promise.all(Array.from({length:Math.max(1,Math.min(2,Number(options.concurrency)||2))},async()=>{while(jobs.length)await run(jobs.shift())}))
