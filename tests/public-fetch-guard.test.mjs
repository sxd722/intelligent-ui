import test from 'node:test'
import assert from 'node:assert/strict'
import {guardPublicFetch,publicResponseError} from '../server/tools/public-fetch-guard.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {createResearchSession} from '../server/research/session.mjs'
import {TOOLS} from '../shared/cardspec/tools.mjs'
const signal=new AbortController().signal
test('public HTTP login redirects and access statuses are typed, without exposing query credentials',()=>{
 const error=publicResponseError({url:'https://example.org/login-required?redirect=secret',status:200,redirected:true},'https://example.org/search?keyword=private')
 assert.equal(error.code,'AUTH_REQUIRED');assert.doesNotMatch(error.message,/secret|private/)
 for(const [status,code] of [[401,'AUTH_REQUIRED'],[403,'ACCESS_RESTRICTED'],[429,'RATE_LIMITED']])assert.equal(publicResponseError({url:'https://example.org/api',status},'https://example.org/api').code,code)
 for(const path of ['/articles/login-guide','/search?keyword=login','/sso'])assert.equal(publicResponseError({url:'https://example.org'+path,status:200,redirected:true},'https://example.org/search'),null)
 assert.equal(publicResponseError({url:'https://example.org/login',status:200,redirected:false},'https://example.org/login'),null)
})
test('fetch guard passes legitimate responses through and cancels gated response bodies',async()=>{
 let cancelled=false;const response={url:'https://example.org/signin',status:200,redirected:true,body:{cancel:async()=>{cancelled=true}}}
 await assert.rejects(guardPublicFetch(async()=>response)('https://example.org/search'),{code:'AUTH_REQUIRED'});assert.equal(cancelled,true)
 const good=new Response('{"items":[]}');assert.equal(await guardPublicFetch(async()=>good)('https://example.org/api'),good)
})
test('generation stops changed-query retries after access/schema failures, but allows other tools and new sessions',async()=>{
 const id='opencli.dongchedi.search',other='opencli.douban.search',catalog=[id,other].map(id=>({...TOOLS[id],available:true}))
 for(const code of ['AUTH_REQUIRED','ACCESS_RESTRICTED','RATE_LIMITED','SCHEMA_MISMATCH']){
  let calls=0;const invoke=async()=>{calls++;throw Object.assign(Error('blocked'),{errorInfo:{code}})}
  const t=createGenerationTools({catalog,invoke})
  for(const keyword of ['A','B'])await assert.rejects(t.execute('cli_read',{id,input:{keyword}},signal))
  assert.equal(calls,1)
  await assert.rejects(t.execute('cli_read',{id:other,input:{keyword:'other'}},signal));assert.equal(calls,2)
  await assert.rejects(createGenerationTools({catalog,invoke}).execute('cli_read',{id,input:{keyword:'A'}},signal));assert.equal(calls,3)
 }
})
test('model continuation gets actionable failure and can use remaining public research without fabricating a dataset',async()=>{
 const id='opencli.dongchedi.search';let reads=0,searches=0,round=0
 const extensions=createGenerationTools({catalog:[{...TOOLS[id],available:true}],invoke:async()=>{reads++;throw Object.assign(Error('来源需要登录'),{errorInfo:{code:'AUTH_REQUIRED',recovery:'open_source'}})}})
 const session=createResearchSession({extensions,providers:{search:async()=>{searches++;return {items:[{url:'https://example.org/news',title:'Public report',excerpt:'Public evidence',kind:'search'}]}}}})
 const call=(name,args)=>({message:{role:'assistant',tool_calls:[{id:String(round),function:{name,arguments:JSON.stringify(args)}}]}})
 await session.run(async messages=>{
  round++
  if(round===1)return call('cli_read',{id,input:{keyword:'A'}})
  if(round===2){const failure=JSON.parse(messages.findLast(m=>m.role==='tool').content);assert.equal(failure.code,'AUTH_REQUIRED');assert.match(failure.instruction,/web_search/);return call('web_search',{query:'public evidence'})}
  return {message:{content:'<card><text>公开报道 [S1]；未取得原站口碑。</text></card>'}}
 },[],{signal})
 assert.equal(reads,1);assert.equal(searches,1);assert.deepEqual(session.datasets(),{});assert.equal(session.snapshot().evidence[0].id,'S1')
})
