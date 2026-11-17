import fs from 'node:fs/promises'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const root='artifacts/subject-composition-qa',base='http://127.0.0.1:8787'
await fs.mkdir(root,{recursive:true})
const cases=[{id:'model-rail-v2',tools:true,prompt:'做一张短小的中国高铁探索卡：在京沪（北京南到上海虹桥）和杭沪（杭州东到上海虹桥）之间选择，查看2026-11-14真实车次及目的地当前天气。两种资料围绕当前路线组合在一起，选择路线就自动更新相应查询，不需要手动刷新。用一张列车或城市示意图片帮助理解；默认只突出当前代表车次和天气，完整车次按需展开再返回，不做购票工作台，不用长篇介绍。用原生CardSpec，不要沙箱。保持所选路线和返回状态，来源失败时其他内容仍能使用。'}]

for(const c of cases){
 if(process.env.QA_CASE&&process.env.QA_CASE!==c.id)continue
 const dir=`${root}/${c.id}`;await fs.mkdir(dir,{recursive:true})
 const request={messages:[{role:'user',content:c.prompt}],format:'cardspec',mode:'direct',modelProfile:'gpt-instant',cardSize:'full',contentMode:'guided',renderMode:'native',expressionDialect:'js-v1',debugGeneration:true,extendedGeneration:false,toolsEnabled:c.tools,stitchComparison:false,turnId:`reading-navigation-${c.id}-${Date.now()}`}
 const envelope={},apply=createDeltaApplier(),events=[],start=Date.now();let error
 await fs.writeFile(dir+'/request.json',JSON.stringify(request,null,2));console.log('start',c.id)
 try{
  const response=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(request),signal:AbortSignal.timeout(360000)})
  if(!response.ok)throw Error('HTTP '+response.status)
  let buf='';const decoder=new TextDecoder()
  for await(const chunk of response.body){buf+=decoder.decode(chunk,{stream:true});let i;while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i);buf=buf.slice(i+1);if(!line.startsWith('data:')||line.slice(5).trim()==='[DONE]')continue;const e=JSON.parse(line.slice(5));events.push(e);if(!isControlEvent(e))apply.apply(envelope,e);if(['research','debug','cardplan','stream_error'].includes(e.type))console.log(c.id,e.type,e.tool||e.phase||'',e.status||'');await fs.appendFile(dir+'/trace.jsonl',JSON.stringify(e)+'\n')}}
 }catch(e){error=e.message}
 const meta=envelope.message?.metadata||{},result={case:c.id,elapsedMs:Date.now()-start,error,status:events.findLast(e=>e.type==='message_stream_complete')?.status,spec:meta.card_spec,deck:meta.card_deck||[],source:meta.validated_source||envelope.message?.content?.parts?.join(''),events}
 await fs.writeFile(dir+'/result.json',JSON.stringify(result,null,2));if(result.source)await fs.writeFile(dir+'/card.cardspec',result.source)
 console.log('done',c.id,result.status,result.elapsedMs,error||'')
}
