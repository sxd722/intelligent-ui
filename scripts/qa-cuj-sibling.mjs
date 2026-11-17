import fs from 'node:fs/promises'
import {deckInterface,deckCoverage} from '../server/cardspec/deck-contract.mjs'
const old=JSON.parse(await fs.readFile('artifacts/cuj-continuity-qa/verified-entities/cs343/result.json','utf8'))
const root='artifacts/cuj-continuity-qa/verified-interface/cs343';await fs.mkdir(root,{recursive:true})
const first=old.deck[0],plan=old.spec.generationPlan.cards[1]
const payload={tool:'glm.generate',target:'page',cause:'user',sessionId:'cuj-shared-contract',requestId:crypto.randomUUID(),pageId:first.id,input:{prompt:plan.goal},view:{...old.request,generationMode:'direct',generationProfile:'adaptive-v1',journeys:first.spec.context.journeys,journeyIds:plan.journeyIds,deckInterface:deckInterface(first.spec)}}
delete payload.view.messages
const events=[],start=Date.now();let result,error
try{
 const response=await fetch('http://127.0.0.1:8787/api/tools/invoke',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:8787'},body:JSON.stringify(payload),signal:AbortSignal.timeout(240000)})
 if(!response.ok)throw Error('HTTP '+response.status+' '+await response.text())
 const decoder=new TextDecoder();let buffer=''
 for await(const chunk of response.body){buffer+=decoder.decode(chunk,{stream:true});let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);if(!line.startsWith('data:'))continue;const e=JSON.parse(line.slice(5));events.push(e);if(e.type==='result')result=e.result;if(e.type==='error')error=e.error;if(['debug','error'].includes(e.type))console.log(e.type,e.status||e.error,e.version)}}
}catch(e){error=e.message}
const elapsedMs=Date.now()-start,deck=result?.spec?[first,{...result,id:result.spec.cardId,status:'ready',title:plan.title}]:old.deck
const coverage=deckCoverage(old.request.messages[0].content,deck)
const output={...old,elapsedMs:old.elapsedMs+elapsedMs,targetedRepairMs:elapsedMs,parentRun:'verified-entities/cs343',status:result?.spec?'succeeded':'failed',error,request:payload,events,deck,deckCoverage:coverage,spec:old.spec}
await fs.writeFile(root+'/result.json',JSON.stringify(output,null,2));for(const [i,c]of deck.entries())await fs.writeFile(root+`/card-${i+1}.cardspec`,c.source)
console.log(JSON.stringify({status:output.status,elapsedMs,error,verification:result?.spec?.verificationStatus}))
