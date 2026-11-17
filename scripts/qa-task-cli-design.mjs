import {mkdir,readFile,writeFile,appendFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const root='artifacts/task-cli-design'+(process.env.QA_ROUND?'/'+process.env.QA_ROUND:''),base='http://127.0.0.1:8787';await mkdir(root,{recursive:true})
const original=JSON.parse(await readFile('artifacts/refine-runs/14d03a30-8a77-4630-8c04-d24041b8cf9c.json','utf8'))
const cases={iphone:original.prompt,weather:'做一个杭州和上海天气观察卡：选择城市、查看未来几天天气，点一天看温度和降雨。用真实天气，缺少数据不要编造。整体紧凑，一眼看清适不适合户外活动。'}
for(const id of process.argv.slice(2)){
 const prompt=cases[id];if(!prompt)throw Error('unknown case')
 const request={messages:[{role:'user',content:prompt}],format:'cardspec',mode:'direct',generationProfile:'adaptive-v1',expressionDialect:'js-v1',modelProfile:'deepseek-flash',toolsEnabled:true,designMode:'host',debugGeneration:true,buildMode:'quick',cardSize:'full',renderMode:'native',...(process.env.QA_RESUME?{resumeToken:process.env.QA_RESUME}:{}),turnId:randomUUID()}
 const events=[],envelope={},applier=createDeltaApplier(),started=Date.now();let error
 await writeFile(root+'/'+id+'-request.json',JSON.stringify(request,null,2));await writeFile(root+'/'+id+'.sse','')
 try{
  const response=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(request),signal:AbortSignal.timeout(420000)})
  if(!response.ok)throw Error('HTTP '+response.status)
  const decoder=new TextDecoder();let buffer=''
  for await(const part of response.body){const str=decoder.decode(part,{stream:true});await appendFile(root+'/'+id+'.sse',str);buffer+=str;let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!line.startsWith('data:')||line.slice(5).trim()==='[DONE]')continue;const e=JSON.parse(line.slice(5));events.push(e);if(!isControlEvent(e))applier.apply(envelope,e);if(['cardplan','research','task_contracts','stream_error','message_stream_complete'].includes(e.type))console.log(JSON.stringify({id,type:e.type,status:e.status,tool:e.tool,tools:e.tools,error:e.error}))}}
 }catch(e){error=e.message}
 const m=envelope.message||{},result={id,prompt,elapsedMs:Date.now()-started,error,status:events.findLast(e=>e.type==='message_stream_complete')?.status,source:m.metadata?.validated_source||m.content?.parts?.join('')||'',spec:m.metadata?.card_spec,metadata:m.metadata,events}
 await writeFile(root+'/'+id+'.json',JSON.stringify(result,null,2));console.log('FINAL '+JSON.stringify({id,status:result.status,elapsedMs:result.elapsedMs,bindings:Object.values(result.spec?.bindings||{}).map(b=>b.tool),error}))
}
