import {writeFile} from 'node:fs/promises'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const base='http://127.0.0.1:8787',before=await fetch(base+'/api/tools/connections').then(r=>r.json())
const prompt='用公开新闻和B站搜索“尊界 刹车”，每来源最多2条结果，生成一个可交互的样本观察卡。先取真实数据再生成；有来源失败就标明部分结果。首屏用紧凑的来源统计和筛选，选择结果后可看原文出处。不要把新闻标题或视频标题统计为用户好恶，不宣称代表全网舆情。不需要其他页面或长文。'
const start=Date.now(),frames=[],envelope={},applier=createDeltaApplier();let buffer='',terminal,error,metadata={}
try{
 const response=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({format:'cardspec',mode:'direct',generationProfile:'adaptive-v1',toolsEnabled:true,renderMode:'native',cardSize:'square',messages:[{role:'user',content:prompt}]}),signal:AbortSignal.timeout(305000)})
 const decoder=new TextDecoder()
 for await(const bytes of response.body){buffer+=decoder.decode(bytes,{stream:true});let n;while((n=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,n);buffer=buffer.slice(n+2);for(const line of block.split('\n')){
  if(!line.startsWith('data:'))continue;const data=line.slice(5).trim();if(data==='[DONE]')continue
  const frame=JSON.parse(data);frames.push({ms:Date.now()-start,frame})
  if(frame.type==='message_stream_complete')terminal=frame.status
  if(frame.type==='server_ste_metadata')metadata=frame.metadata
  if(frame.type==='stream_error')error=frame.error?.message
  if(!isControlEvent(frame))applier.apply(envelope,frame)
 }}}
}catch(e){error=e.message}
const after=await fetch(base+'/api/tools/connections').then(r=>r.json()),message=envelope.message
const result={status:terminal==='succeeded'&&message?.metadata?.card_spec?'succeeded':'failed',error,elapsedMs:Date.now()-start,firstUsableMs:metadata.first_usable_ms,budget:metadata.generationBudget,bindingPreserved:before.browser.binding.session===after.browser.binding.session&&before.browser.daemonPid===after.browser.daemonPid&&after.browser.binding.bound}
await writeFile('artifacts/adaptive-eval-v2/live-generation.json',JSON.stringify({prompt,result,metadata,message,source:message?.content?.parts?.[0],frames,before,after},null,2));console.log(JSON.stringify(result))
