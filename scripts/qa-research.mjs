import {mkdir,writeFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const out=process.env.RESEARCH_QA_OUT||'artifacts/research-tools-qa',base='http://127.0.0.1:8787'
await mkdir(out,{recursive:true})
const cases=[
 {id:'webb',prompt:'做一张韦伯望远镜知识卡：先联网搜索并读取 NASA 原文，核实实际发射日期和运行位置，不要混淆早期计划发射日期。展示来源引用，以及一个点击揭晓的小问答。最多三个事实，简洁呈现。'},
 {id:'westlake',prompt:'查询杭州西湖列入世界遗产的年份与两项突出价值，优先搜索和阅读 UNESCO 原文。做一张简短介绍卡，带来源引用，提供点击切换两项价值点的交互。不要旅游报价。'},
 {id:'docs',prompt:'阅读 https://docs.bigmodel.cn/cn/guide/capabilities/thinking-mode ，核实 GLM 工具调用之间能否继续推理、是否要回传 reasoning_content，生成一张带来源引用的简短说明卡，用点击切换“过程”和“注意事项”。'},
 {id:'creative',prompt:'设计一个纯本地的20次点击挑战小卡片，点击加1，到20庆祝，支持重置。无需任何事实查询或外部数据，所有交互本地执行。'}
]
async function request(endpoint,payload){
 const response=await fetch(base+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(200000)})
 if(!response.ok)throw Error('HTTP '+response.status)
 let buffer='';const frames=[],decoder=new TextDecoder();const started=Date.now()
 for await(const c of response.body){buffer+=decoder.decode(c,{stream:true});let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i).trim();buffer=buffer.slice(i+1);if(!line.startsWith('data:'))continue;const raw=line.slice(5).trim();if(raw==='[DONE]')continue;const f=JSON.parse(raw);frames.push({ms:Date.now()-started,frame:f});if(f.type==='research')console.log(endpoint,f.status,f.tool,f.sourceIds||f.error||'')}}
 return {frames,elapsed:Date.now()-started}
}
const results=[]
async function run(c){
 try{
 const data=await request('/api/chat',{messages:[{role:'user',content:c.prompt}],format:'cardspec',mode:process.env.RESEARCH_QA_MODE||'direct',cardSize:'auto',turnId:randomUUID()})
 const envelope={},applier=createDeltaApplier();for(const {frame} of data.frames)if(!isControlEvent(frame))applier.apply(envelope,frame)
 const spec=envelope.message?.metadata?.card_spec,research=spec?.research,source=envelope.message?.content?.parts?.[0]||''
 const row={id:c.id,status:data.frames.findLast(x=>x.frame.type==='message_stream_complete')?.frame.status,error:data.frames.find(x=>x.frame.type==='stream_error')?.frame.error,elapsed:data.elapsed,repair:envelope.message?.metadata?.repair_count,calls:research?.calls||0,sources:research?.evidence?.map(s=>({id:s.id,title:s.title,url:s.url,kind:s.kind})),citations:[...source.matchAll(/\[S\d+\]/g)].map(m=>m[0])}
 await writeFile(`${out}/${c.id}.json`,JSON.stringify({...c,...data,source,spec,metadata:envelope.message?.metadata,result:row},null,2));results.push(row);console.log(JSON.stringify(row))
 }catch(e){results.push({id:c.id,error:e.message});console.log(c.id,e.message)}
 await writeFile(`${out}/summary.json`,JSON.stringify(results,null,2))
}
const selected=process.env.RESEARCH_QA_CASES?.split(',')
const jobs=cases.filter(c=>!selected||selected.includes(c.id));await Promise.all(Array.from({length:2},async()=>{while(jobs.length)await run(jobs.shift())}))
for(const target of ['slot:explanation','page']){
 if(selected&&!selected.includes(target.startsWith('slot')?'slot':'page'))continue
 const c={id:target.startsWith('slot')?'slot':'page',prompt:'读取 https://science.nasa.gov/mission/webb/ ，依据原文核实韦伯望远镜发射日期和观测目标，最多两段简短文字，用[S1]式引用。不要用记忆替代查阅。'}
 try{const data=await request('/api/tools/invoke',{tool:'glm.generate',input:{prompt:c.prompt},target,cause:'user',requestId:randomUUID(),pageId:randomUUID(),sessionId:randomUUID(),view:{generationMode:process.env.RESEARCH_QA_MODE||'direct',cardSize:'auto',goal:'了解韦伯望远镜'}});const result=data.frames.find(x=>x.frame.type==='result')?.frame.result;const error=data.frames.find(x=>x.frame.type==='error')?.frame.error;const row={id:c.id,status:result?'succeeded':'failed',error,kind:result?.kind,elapsed:data.elapsed,calls:result?.spec?.research?.calls,sources:result?.spec?.research?.evidence?.map(s=>({id:s.id,url:s.url,kind:s.kind}))};await writeFile(`${out}/${c.id}.json`,JSON.stringify({...c,...data,result},null,2));results.push(row);console.log(JSON.stringify(row))}catch(e){results.push({id:c.id,error:e.message})}
 await writeFile(`${out}/summary.json`,JSON.stringify(results,null,2))
}
