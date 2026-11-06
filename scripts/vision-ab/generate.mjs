import {mkdir,writeFile,appendFile} from 'node:fs/promises'
import {createDeltaApplier,isControlEvent} from '../../src/delta.js'
const {ROOT,DEST,cases}=await import('./cases.mjs')
await mkdir(ROOT,{recursive:true});await mkdir(DEST+'/runs',{recursive:true})
await writeFile(ROOT+'/BRIEF.md','# 真实复杂任务验收\n\n只使用本地现有生成服务与已连接只读工具。默认生产配置 DeepSeek Flash / direct / adaptive-v1 / js-v1，开启生成期调试；保存实际模型名、工具结果和失败。允许原生加严格沙箱，不增加预算，不修改工具连接。\n\n'+cases.map(c=>'## '+c.title+'\n\n'+c.prompt+'\n\n'+c.requirements.map(x=>'- '+x).join('\n')).join('\n\n')+'\n\n每例按完整要求打分；生成完成、绑定成功和完整CUJ达成分列。真实取数、缓存命中、录制回放分开记录；没有预设数据。默认 candidate，不晋级金标。')
for(const c of cases.filter(c=>!process.env.CUJ_ONLY||process.env.CUJ_ONLY===c.id)){
 const payload={messages:[{role:'user',content:c.prompt}],format:'cardspec',mode:'direct',generationProfile:'adaptive-v1',expressionDialect:'js-v1',modelProfile:c.modelProfile||'deepseek-flash',toolsEnabled:c.toolsEnabled!==false,designMode:'image-first',designImageInput:c.directImage,debugGeneration:true,buildMode:c.buildMode||'quick',cardSize:'square',renderMode:c.renderMode||'native',turnId:'complex-live-'+c.id+'-'+Date.now()}
 const started=Date.now(),events=[],applier=createDeltaApplier(),envelope={};let error
 await writeFile(ROOT+'/'+c.id+'-request.json',JSON.stringify(payload,null,2));await writeFile(ROOT+'/'+c.id+'.sse','')
 try{
  const response=await fetch('http://127.0.0.1:8787/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:8787'},body:JSON.stringify(payload),signal:AbortSignal.timeout(480000)})
  if(!response.ok)throw Error('HTTP '+response.status)
  let buffer='';const decoder=new TextDecoder();for await(const chunk of response.body){const text=decoder.decode(chunk,{stream:true});await appendFile(ROOT+'/'+c.id+'.sse',text);buffer+=text;let index;while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);if(!line.startsWith('data:')||line.slice(5).trim()==='[DONE]')continue;const e=JSON.parse(line.slice(5));events.push(e);if(!isControlEvent(e))applier.apply(envelope,e);if(['research','generation_debug','error','stream_note'].includes(e.type))console.log(JSON.stringify({case:c.id,type:e.type,status:e.status,tool:e.tool,note:e.note,error:e.error}).slice(0,500))}}
 }catch(e){error=e.message}
 const message=envelope.message||{},spec=message.metadata?.card_spec,source=message.content?.parts?.join('')||''
 const r={id:c.id,title:c.title,prompt:c.prompt,requirements:c.requirements,elapsedMs:Date.now()-started,error,status:events.findLast(e=>e.type==='message_stream_complete')?.status,metadata:message.metadata,spec,source,events}
 await writeFile(ROOT+'/'+c.id+'.json',JSON.stringify(r,null,2));await writeFile(DEST+'/runs/'+c.id+'.json',JSON.stringify(r));console.log(JSON.stringify({finished:c.id,spec:!!spec,status:r.status,error,seconds:r.elapsedMs/1000}))
}
