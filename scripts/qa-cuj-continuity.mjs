import fs from 'node:fs/promises'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const root=process.env.QA_OUTPUT||'artifacts/cuj-continuity-qa',base='http://127.0.0.1:8787'
await fs.mkdir(root,{recursive:true})
const cases=[['bamboo','903a583f-9455-413e-a2d4-ebad0e14034f'],['cs343','a45fa115-c47c-47f0-ae82-bb5695aeb417'],['care','b5cc7e05-b15c-4a67-888e-b4e7f7a1c1f3']]
for(const [name,oldId]of cases){
 if(process.env.QA_CASE&&process.env.QA_CASE!==name)continue
 const old=JSON.parse(await fs.readFile(`artifacts/rsi-adaptive/runs/${oldId}.json`,'utf8'))
 // Same user brief/model/size as the old run; no hand-authored case implementation.
 const request={messages:[{role:'user',content:old.goal}],format:'cardspec',mode:'direct',generationProfile:'adaptive-v1',expressionDialect:'js-v1',modelProfile:'deepseek-flash',toolsEnabled:true,stitchComparison:false,designMode:'host',debugGeneration:true,buildMode:'quick',cardSize:'auto',renderMode:'hybrid',extendedGeneration:true,turnId:'cuj-p0-'+name+'-'+Date.now()}
 const envelope={},applier=createDeltaApplier(),events=[],start=Date.now();let error
 const path=`${root}/${name}`;await fs.mkdir(path,{recursive:true});console.log('start',name)
 try{
  const response=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(request),signal:AbortSignal.timeout(480000)})
  if(!response.ok)throw Error('HTTP '+response.status)
  let buffer='';const decoder=new TextDecoder()
  for await(const chunk of response.body){buffer+=decoder.decode(chunk,{stream:true});let index;while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);if(!line.startsWith('data:')||line.slice(5).trim()==='[DONE]')continue;const event=JSON.parse(line.slice(5));events.push(event);if(!isControlEvent(event))applier.apply(envelope,event);if(['debug','cardplan','stream_error','debug_retained'].includes(event.type))console.log(name,event.type,event.status||'',event.version||'');await fs.writeFile(path+'/progress.json',JSON.stringify({elapsedMs:Date.now()-start,last:event.type,status:event.status}));}}
 }catch(e){error=e.message}
 const metadata=envelope.message?.metadata||{},deck=metadata.card_deck||[]
 const result={name,oldId,request,elapsedMs:Date.now()-start,error,status:events.findLast(e=>e.type==='message_stream_complete')?.status,deck,source:metadata.validated_source||envelope.message?.content?.parts?.join(''),spec:metadata.card_spec,events}
 await fs.writeFile(path+'/result.json',JSON.stringify(result,null,2))
 for(const [i,card]of deck.entries())if(card.source)await fs.writeFile(`${path}/card-${i+1}.cardspec`,card.source)
 console.log('finished',name,JSON.stringify({status:result.status,elapsedMs:result.elapsedMs,error,cards:deck.map(c=>({id:c.id,status:c.status,verification:c.spec?.verificationStatus}))}))
}
