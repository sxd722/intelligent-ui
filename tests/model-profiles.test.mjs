import test from 'node:test'
import assert from 'node:assert/strict'
import {generationSettings,generationModelOptions,MODEL_PROFILES} from '../shared/cardspec/generation-settings.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {generateCard} from '../server/cardspec/generation.mjs'
import {handleCardSpec} from '../server/cardspec/handler.mjs'
const card='<card><title>计数器</title><state id="n" type="number" initial={0}/><text>{state.n}</text><button onPress="add">增加</button><action id="add"><increment target="n"/></action></card>'
const response=content=>new Response('data: '+JSON.stringify({choices:[{delta:{content},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n')
for(const profile of ['deepseek-flash','qwen-flash']){
 test(profile+' gateway parameters, JSON, tools and persisted profile',async()=>{
  const expected=MODEL_PROFILES[profile].model,bodies=[]
  const round=createModelClient({base:'https://gateway.test/v1',key:'test-key',model:'glm-5.3-flash',fetchImpl:async(url,options)=>{
   assert.equal(url,'https://gateway.test/v1/chat/completions');bodies.push(JSON.parse(options.body));return response(card)
  }})
  const settings=generationSettings({modelProfile:profile});assert.equal(settings.modelProfile,profile)
  await round([],{...generationModelOptions(profile),reasoningEffort:'low',responseFormat:{type:'json_object'},tools:[{type:'function',function:{name:'check',parameters:{type:'object'}}}]})
  assert.equal(bodies[0].model,expected);assert.equal(bodies[0].reasoning_effort,undefined);assert.deepEqual(bodies[0].thinking,{type:'disabled'});assert.ok(bodies[0].tools);assert.equal(bodies[0].response_format.type,'json_object')
  for(const target of ['page','slot:details']){
   const result=await generateCard({input:{prompt:'计数器'},target,view:settings,signal:AbortSignal.timeout(5000),streamUpstream:async(messages,options)=>{const r=await round(messages,options);return r.message.content}})
   assert.equal(result.spec.context.modelProfile,profile);assert.equal(bodies.at(-1).model,expected)
  }
 })
 test(profile+' trace records requested model and fresh request does not inherit it',async()=>{
  for(const selected of [profile,'default']){
   const frames=[];let options
   const res={writeHead(){},once(){},write(s){if(s.startsWith('data: {'))frames.push(JSON.parse(s.slice(6)))},end(){this.writableEnded=true}}
   await handleCardSpec({},res,{modelProfile:selected,mode:'direct',toolsEnabled:false,messages:[{role:'user',content:'计数器'}]},{model:'glm-5.3-flash',keyLoaded:true,streamUpstream:async(m,o)=>{options=o;o.onPiece({content:card})}})
   assert.equal(options.modelOverride,selected==='default'?undefined:MODEL_PROFILES[profile].model)
   assert.equal(frames.find(f=>f.type==='server_ste_metadata').metadata.model_slug,selected==='default'?'glm-5.3-flash':MODEL_PROFILES[profile].model)
  }
 })
}
test('unknown profile stays allowlisted and GLM deep settings remain unchanged',()=>{
 assert.equal(generationSettings({modelProfile:'arbitrary'}).modelProfile,'default');assert.deepEqual(generationModelOptions('arbitrary'),{})
 assert.deepEqual(generationModelOptions('deep'),{modelOverride:'glm-5.3',reasoningEffort:'high',thinking:{type:'enabled'}})
})
