import fs from 'node:fs/promises'
import {createDeltaApplier,isControlEvent} from '../../src/delta.js'
const root='artifacts/task-experience-p0',base=[['traffic','bd829be6-34dd-4287-bbd7-7f5cd937da7f'],['travel','354b525c-d09b-486c-9ab3-d23aa71c1ab6'],['news','3eb3addc-7c2a-42b3-93df-83a17c3732be']];await fs.mkdir(root+'/generated',{recursive:true})
const cases=[]
for(const [id,oldId]of base){const r=JSON.parse(await fs.readFile('artifacts/rsi-adaptive/runs/'+oldId+'.json'));await fs.writeFile(root+'/'+id+'-baseline.json',JSON.stringify(r));cases.push({id,prompt:r.goal,settings:r.artifacts[0].spec.context,baseline:r.budget})}
cases.push({id:'appointment',prompt:'做一个预约到达助手。教学估算数据：步行25分钟、骑车12分钟、公交35分钟；出发时间08:00，预约09:00，可编辑。切换方式或改出发时间后计算到达时刻和提前/迟到分钟；改地址时旧估算应失效，不冒充查过新路线。展开当前方案步骤，返回保留选择，刷新恢复。不需要外部工具。',tools:false},
{id:'schedule',prompt:'课程安排编辑卡，使用明确的示例数据：周一数学09:00–10:00在A101，物理10:30–11:30在B202。可选一门课，整体替换成候选化学13:00–14:00在C303，课程名时间教室必须一起变化、其他课程不变；可撤销，按开始时间排序，刷新恢复。每个候选详情提供对应学习准备事项。不需要外部查询。',tools:false},
{id:'reviews',prompt:'多源产品反馈样本卡：a来自论坛，日期2026-11-01，正面，电池耐用；b来自视频评论，2026-11-02，负面，发热；c来自论坛，日期缺失，态度未知，只说尚未购买；d来自视频评论，2026-11-03，正面，重量轻。只用这些示例，不查询。按来源/态度筛选；图表分组点击后只显示该组记录，统计与记录一致，缺失日期保持未知；详情有对应原话，返回保留筛选，刷新恢复。不要推断全网比例。',tools:false})
await fs.writeFile(root+'/manifest.json',JSON.stringify({createdAt:new Date().toISOString(),method:'same original prompts/settings for three live cases; historical baseline not controlled A/B; three synthetic generalization cases',cases},null,2))
for(const c of cases){if(process.env.P0_ONLY&&!process.env.P0_ONLY.split(',').includes(c.id))continue;if(!process.env.P0_FORCE&&await fs.stat(root+'/generated/'+c.id+'.json').then(()=>true,()=>false))continue
 const payload={format:'cardspec',mode:'direct',generationProfile:'adaptive-v1',expressionDialect:'js-v1',modelProfile:'deepseek-flash',toolsEnabled:c.tools!==false,designMode:'host',debugGeneration:true,buildMode:'quick',cardSize:'full',renderMode:c.settings?.renderMode||'native',extendedGeneration:true,messages:[{role:'user',content:c.prompt}],turnId:'p0-experience-'+c.id+'-'+Date.now()}
 const start=Date.now(),events=[],applier=createDeltaApplier(),envelope={};let buffer='',error
 await fs.writeFile(root+'/generated/'+c.id+'-request.json',JSON.stringify(payload,null,2));await fs.writeFile(root+'/generated/'+c.id+'.sse','')
 try{const response=await fetch('http://127.0.0.1:8787/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:8787'},body:JSON.stringify(payload),signal:AbortSignal.timeout(600000)});if(!response.ok)throw Error('HTTP '+response.status);const decoder=new TextDecoder()
 for await(const chunk of response.body){const text=decoder.decode(chunk,{stream:true});await fs.appendFile(root+'/generated/'+c.id+'.sse',text);buffer+=text;let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);if(!line.startsWith('data:')||line.slice(5).trim()==='[DONE]')continue;const e=JSON.parse(line.slice(5));events.push({ms:Date.now()-start,event:e});if(!isControlEvent(e))applier.apply(envelope,e);if(['stream_error','message_stream_complete'].includes(e.type))console.log(c.id,JSON.stringify(e).slice(0,350))}}
 }catch(e){error=e.message}
 const msg=envelope.message||{},r={id:c.id,prompt:c.prompt,elapsedMs:Date.now()-start,error,status:events.findLast(e=>e.event.type==='message_stream_complete')?.event.status,source:msg.content?.parts?.join('')||'',spec:msg.metadata?.card_spec,metadata:msg.metadata,events}
 await fs.writeFile(root+'/generated/'+c.id+'.json',JSON.stringify(r,null,2));console.log(JSON.stringify({id:c.id,seconds:r.elapsedMs/1000,status:r.status,spec:!!r.spec,error}))
}
