import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createDesignMockService} from '../server/design-mock-service.mjs'
import {IMAGE_MODEL} from '../server/image-service.mjs'
import {defaultMockLayout,resolveMockDesign} from '../shared/cardspec/design-mock-layout.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {generationSettings,generationModelOptions} from '../shared/cardspec/generation-settings.mjs'
import {generateCard} from '../server/cardspec/generation.mjs'
const jpeg=Buffer.from([255,216,255,224,1,2,3])
const memory=()=>{const values=new Map();return {read:async k=>values.get(k)||null,write:async(k,v)=>values.set(k,v)}}
const source='<card><data id="designLayout" value={{layout:"hero",background:"#112233",ink:"#ffffff",accent:"#ccaa44",art:{x:0,y:0,width:100,height:45},contentColumns:2}}/><title>体验</title><state id="n" type="number" initial={0}/><button onPress="add">增加 {state.n}</button><action id="add"><increment target="n"/></action></card>'

test('design image creation uses only images API; cache and old paid-for image reuse never call vision',async()=>{
 const storage=memory(),calls=[],charges=[],service=createDesignMockService({key:'secret',storage,fetchImpl:async(url,o)=>{calls.push(url);assert.equal(JSON.parse(o.body).model,IMAGE_MODEL);return Response.json({data:[{b64_json:jpeg.toString('base64')}]})}})
 const a=await service({goal:'test',cardSize:'square',budget:{model:t=>charges.push(t)}})
 assert.deepEqual(calls,['https://api.openai.com/v1/images/generations']);assert.deepEqual(charges,['design-image'])
 assert.equal(a.visionModel,null);assert.equal(a.analysisMode,'direct');assert.equal(a.usage.vision,null)
 assert.equal((await service({goal:'test',cardSize:'square'})).cacheHit,true);assert.equal(calls.length,1)
 const legacy=createHash('sha256').update(JSON.stringify(['design-mock-v2',IMAGE_MODEL,'gpt-4.1','old','square'])).digest('hex')
 await storage.write(`generated/${legacy}.jpg`,jpeg);const migrated=await service({goal:'old',cardSize:'square'});assert.equal(calls.length,1)
 assert.match((await service.imageInput(migrated.id)).image_url.url,/^data:image\/jpeg;base64,/)
 await assert.rejects(()=>service.imageInput('../secret'))
 assert(!JSON.stringify(a).includes('secret'))
})

test('static design parameters survive persistence, correct contrast, and cannot execute state or change image URL',()=>{
 const context={designMock:{...defaultMockLayout(),status:'ready',analysisMode:'direct',url:'/api/media/'+ 'a'.repeat(64)+'.jpg'}}
 const spec=compileCard(source,{final:true,context}).spec,d=resolveMockDesign(JSON.parse(JSON.stringify(spec)))
 assert.equal(d.layoutSource,'generation-model');assert.equal(d.contentColumns,2);assert.equal(d.art.height,45)
 assert.equal(d.url,context.designMock.url)
 spec.data.designLayout={type:'member',object:{type:'identifier',name:'state'},key:{type:'literal',value:'layout'}}
 assert.equal(resolveMockDesign(spec).layoutSource,'host-default')
 const old={context:{designMock:{...context.designMock,analysisMode:undefined}}};assert.equal(resolveMockDesign(old),old.context.designMock)
})

for(const profile of ['default','deepseek-flash','qwen-flash','gpt-instant'])test(profile+' direct image keeps selected model through generation and repair',async()=>{
 let calls=0,imageLoads=0
 const mock={...defaultMockLayout(),status:'ready',analysisMode:'direct',id:'a'.repeat(64),url:'/api/media/'+ 'a'.repeat(64)+'.jpg'}
 const designMock=async()=>mock;designMock.imageInput=async()=>{imageLoads++;return {type:'image_url',image_url:{url:'data:image/jpeg;base64,'+jpeg.toString('base64')}}}
 const result=await generateCard({photo:{designMock},input:{prompt:'一个可点击的卡片'},view:{designMode:'image-first',designImageInput:false,modelProfile:profile},signal:AbortSignal.timeout(5000),streamUpstream:async(messages,options)=>{
  calls++;assert.equal(options.modelOverride,generationModelOptions(profile).modelOverride)
  const images=messages.filter(m=>Array.isArray(m.content)).flatMap(m=>m.content).filter(p=>p.type==='image_url');assert.equal(images.length,1)
  options.onPiece?.({content:calls===1?'<card><invalid/></card>':source});return ''
 }})
 assert.equal(calls,2);assert.equal(imageLoads,1);assert.equal(result.spec.context.modelProfile,profile)
 assert(!JSON.stringify(result.spec).includes('base64'));assert.equal(resolveMockDesign(result.spec).contentColumns,2)
 assert.equal(generationSettings({designMode:'image-first',modelProfile:profile}).designImageInput,true)
})

test('unsupported deep image model fails before paying for an image, without silently selecting Flash',async()=>{
 await assert.rejects(()=>generateCard({photo:{designMock:()=>assert.fail('image must not run')},input:{prompt:'test'},view:{designMode:'image-first',modelProfile:'deep'},signal:AbortSignal.timeout(1000),streamUpstream:()=>assert.fail('generation must not run')}),/未通过/)
})

test('GPT Instant uses only its OpenAI credential and supported parameters; other models keep gateway routing',async()=>{
 const sent=[],client=createModelClient({base:'https://gateway.test/v1',key:'gateway-secret',model:'glm-5.3-flash',openaiKey:'openai-secret',fetchImpl:async(url,o)=>{sent.push({url,auth:o.headers.Authorization,body:JSON.parse(o.body)});return new Response('data: '+JSON.stringify({model:'chat-latest',choices:[{delta:{content:'OK'},finish_reason:'stop'}],usage:{total_tokens:4}})+'\n\ndata: [DONE]\n\n')}})
 await client([],{modelOverride:'chat-latest',thinking:{type:'enabled'},reasoningEffort:'high',maxTokens:100,tools:[{type:'function',function:{name:'inspect'}}]})
 assert.equal(sent[0].url,'https://api.openai.com/v1/chat/completions');assert.equal(sent[0].auth,'Bearer openai-secret')
 assert.equal(sent[0].body.max_completion_tokens,100);for(const name of ['temperature','max_tokens','thinking','reasoning_effort'])assert.equal(sent[0].body[name],undefined)
 assert.equal(sent[0].body.tools.length,1)
 await client([],{modelOverride:'volcengine/deepseek-v4.1-flash'});assert.equal(sent[1].url,'https://gateway.test/v1/chat/completions');assert.equal(sent[1].auth,'Bearer gateway-secret')
 const missing=createModelClient({base:'https://gateway.test/v1',key:'gateway-secret',model:'chat-latest',fetchImpl:()=>assert.fail()})
 await assert.rejects(()=>missing([]),/OpenAI API key/)
})
