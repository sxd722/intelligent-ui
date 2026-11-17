import fs from 'node:fs/promises'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const root='artifacts/editorial-experience-qa'+(process.env.QA_SUITE?'/'+process.env.QA_SUITE:'');await fs.mkdir(root+'/generated',{recursive:true})
const ids=[['mountains','9bebb085-d179-4715-b6ae-bc9976296c0e'],['forest','ae8ccb9b-312a-43fd-aff9-c031c94fc6c6'],['routes','3b6f3331-1cc2-4008-963f-9a1edc0e44e0']]
for(const [id,ref]of ids){
 if(process.env.QA_ONLY&&!process.env.QA_ONLY.split(',').includes(id))continue
 if(!process.env.QA_FORCE&&await fs.stat(`${root}/generated/${id}.json`).then(()=>true,()=>false))continue
 const job=JSON.parse(await fs.readFile(`artifacts/stitch-comparison/${ref}/job.json`,'utf8'))
 const prompt=job.prompt.split('任务（用户最终确认的需求）：')[1].split('画布：')[0].trim()
 const payload={format:'cardspec',mode:'direct',generationProfile:'adaptive-v1',expressionDialect:'js-v1',modelProfile:'deepseek-flash',toolsEnabled:false,designMode:'host',debugGeneration:true,buildMode:'quick',cardSize:job.cardSize,renderMode:'native',extendedGeneration:true,stitchReferenceId:ref,messages:[{role:'user',content:prompt}],turnId:'editorial-'+id+'-'+Date.now()}
 const start=Date.now(),events=[],applier=createDeltaApplier(),envelope={};let buffer='',error
 await fs.writeFile(`${root}/generated/${id}-request.json`,JSON.stringify(payload,null,2));await fs.writeFile(`${root}/generated/${id}.sse`,'')
 try{
 const r=await fetch('http://127.0.0.1:8787/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:8787'},body:JSON.stringify(payload),signal:AbortSignal.timeout(600000)})
 if(!r.ok)throw Error('HTTP '+r.status)
 const decoder=new TextDecoder()
 for await(const chunk of r.body){const text=decoder.decode(chunk,{stream:true});await fs.appendFile(`${root}/generated/${id}.sse`,text);buffer+=text;let i
 while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);if(!line.startsWith('data:')||line.slice(5).trim()==='[DONE]')continue;const e=JSON.parse(line.slice(5));events.push({ms:Date.now()-start,event:e});if(!isControlEvent(e))applier.apply(envelope,e);if(['stream_error','message_stream_complete','design_reference'].includes(e.type))console.log(id,JSON.stringify(e).slice(0,250))}
 }
 }catch(e){error=e.message}
 const msg=envelope.message||{},result={id,reference:ref,prompt,elapsedMs:Date.now()-start,error,status:events.findLast(e=>e.event.type==='message_stream_complete')?.event.status,source:msg.metadata?.validated_source||msg.content?.parts?.join('')||'',spec:msg.metadata?.card_spec,metadata:msg.metadata,events}
 await fs.writeFile(`${root}/generated/${id}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({id,seconds:result.elapsedMs/1000,status:result.status,spec:!!result.spec,error}))
}
