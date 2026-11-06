import test from 'node:test'
import assert from 'node:assert/strict'
import {createImageService,IMAGE_MODEL} from '../server/image-service.mjs'
import {resolveCardResources} from '../server/cardspec/resources.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
const jpeg=Buffer.from([255,216,255,224,1,2,3])
function storage(){const m=new Map();return {read:async k=>m.get(k)||null,write:async(k,v)=>{m.set(k,v)}}}
const reply=()=>Response.json({data:[{b64_json:jpeg.toString('base64')}]})
test('generated image persistent cache, role size isolation, no secret in metadata',async()=>{
 const disk=storage();let calls=0;const options={key:'secret-test',storage:disk,fetchImpl:async(url,o)=>{calls++;assert.equal(url,'https://api.openai.com/v1/images/generations');assert.equal(JSON.parse(o.body).model,IMAGE_MODEL);return reply()}}
 const a=await createImageService(options).photo('gen: origami forest');assert.equal(a.provider,'OpenAI');assert.equal(a.cacheHit,false);assert.ok(!JSON.stringify(a).includes('secret-test'))
 const service=createImageService({...options,fetchImpl:()=>assert.fail('cache miss')}),b=await service.photo('gen: origami forest');assert.equal(b.content,a.content);assert.equal(b.cacheHit,true);assert.deepEqual((await service.media(a.content.split('/').pop())).bytes,jpeg)
 await createImageService(options).photo('gen: origami forest',undefined,'thumbnail');assert.equal(calls,2)
 assert.equal(await service.media('../secret'),null)
})
test('same query coalesces; one cancelled subscriber does not cancel another',async()=>{
 let calls=0,finish;const service=createImageService({key:'test',storage:storage(),fetchImpl:async()=>{calls++;await new Promise(r=>finish=r);return reply()}}),a=new AbortController()
 const first=service.photo('gen: planet',a.signal).catch(e=>e),second=service.photo('gen: planet');while(!finish)await new Promise(r=>setTimeout(r,1));a.abort();finish();assert.ok((await first) instanceof Error);assert.equal((await second).provider,'OpenAI');assert.equal(calls,1)
})
test('provider failures and missing storage preserve card; never cache broken bytes',async()=>{
 for(const response of [new Response('',{status:429}),Response.json({data:[]}),Response.json({data:[{b64_json:Buffer.from('not an image').toString('base64')}]})]){let writes=0;const service=createImageService({key:'test',storage:{read:async()=>null,write:async()=>writes++},fetchImpl:async()=>response});assert.equal(await service.photo('gen: planet'),null);assert.equal(writes,0)}
 assert.equal(await createImageService({key:'test',fetchImpl:()=>assert.fail()}).photo('gen: planet'),null)
})
test('normal query delegates to Pexels, not OpenAI',async()=>{
 let input;const service=createImageService({key:'test',storage:storage(),fetchImpl:()=>assert.fail(),pexels:async(...args)=>{input=args;return {provider:'Pexels'}}});assert.equal((await service.photo('forest',undefined,'thumbnail')).provider,'Pexels');assert.deepEqual(input,['forest',undefined,'thumbnail'])
})
test('CardSpec generated images defer until card commit; photos still resolve',async()=>{
 const c=compileCard('<card><image query="gen: watercolor forest" alt="森林"/><image query="pine forest" alt="照片"/></card>',{final:true});assert.equal(c.complete,true);const calls=[];const resources=await resolveCardResources(c.spec,async q=>{calls.push(q);return {content:'/api/media/'+ 'a'.repeat(64)+'.jpg'}},new AbortController().signal);assert.deepEqual(calls,['pine forest']);assert.equal(Object.values(resources).filter(x=>x.status==='deferred').length,1);assert.equal(Object.values(resources).filter(x=>x.status==='loaded').length,1)
})
