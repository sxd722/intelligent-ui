import {test} from 'node:test'
import assert from 'node:assert/strict'
import {toolTransport} from '../src/cardspec/tool-session.mjs'

const payload={tool:'opencli.douban.movie-hot',input:{},requestId:'request',pageId:'page'}
const result={kind:'json',value:{items:[{id:'1',title:'正在热映 🎬'}]}}
const frame=e=>'data: '+JSON.stringify({...e,requestId:'request',pageId:'page'})+'\r\n\r\n'
function stream(text,{open=false}={}){
  let cancelled=false
  const bytes=new TextEncoder().encode(text)
  const body=new ReadableStream({start(c){
    // Split inside UTF-8 characters, JSON, and CRLF boundaries.
    for(let i=0;i<bytes.length;i+=2)c.enqueue(bytes.slice(i,i+2))
    if(!open)c.close()
  },cancel(){cancelled=true}})
  Object.defineProperty(body,Symbol.asyncIterator,{value:undefined})
  return {body,cancelled:()=>cancelled}
}
function mockFetch(t,body){t.mock.method(globalThis,'fetch',async()=>({ok:true,status:200,body}))}

test('reader-only browser streams deliver split UTF-8 SSE results and progress',async t=>{
  const s=stream(frame({type:'status',status:'running'})+frame({type:'result',result})+frame({type:'done'}))
  mockFetch(t,s.body);const progress=[]
  assert.deepEqual(await toolTransport(payload,undefined,e=>progress.push(e.type)),result)
  assert.deepEqual(progress,['status','result','done']);assert.equal(s.body.locked,false)
})
test('tool errors retain structured recovery metadata',async t=>{
  const s=stream(frame({type:'error',error:'需要登录',errorInfo:{code:'AUTH_REQUIRED'}})+frame({type:'done'}))
  mockFetch(t,s.body)
  await assert.rejects(toolTransport(payload),e=>e.message==='需要登录'&&e.errorInfo.code==='AUTH_REQUIRED')
  assert.equal(s.body.locked,false)
})
test('incomplete streams cannot commit partial results',async t=>{
  const s=stream(frame({type:'result',result}));mockFetch(t,s.body)
  await assert.rejects(toolTransport(payload),/工具连接提前结束/)
  assert.equal(s.body.locked,false)
})
for(const [label,text,pattern] of [
  ['malformed JSON','data: {broken}\n\n',/JSON|property/i],
  ['wrong request',frame({type:'result',result}).replace('"request"','"other"'),/工具响应标识不匹配/]
])test(label+' cancels the remaining response and releases its lock',async t=>{
  const s=stream(text,{open:true});mockFetch(t,s.body)
  await assert.rejects(toolTransport(payload),pattern)
  assert.equal(s.cancelled(),true);assert.equal(s.body.locked,false)
})
test('abort during pending read preserves AbortError and unlocks stream',async t=>{
  const controller=new AbortController()
  const body=new ReadableStream({start(c){controller.signal.addEventListener('abort',()=>c.error(controller.signal.reason))}})
  Object.defineProperty(body,Symbol.asyncIterator,{value:undefined})
  t.mock.method(globalThis,'fetch',async(url,options)=>{assert.equal(options.signal,controller.signal);return {ok:true,status:200,body}})
  const pending=toolTransport(payload,controller.signal)
  controller.abort()
  await assert.rejects(pending,{name:'AbortError'});assert.equal(body.locked,false)
})
