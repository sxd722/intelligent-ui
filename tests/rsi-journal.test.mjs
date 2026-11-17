import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRsiJournal,redact,rsiContext} from '../server/rsi-journal.mjs'
test('durable model/frame archive, lineage, interactions, feedback and explicit deep review',async()=>{
 const root=await mkdtemp(join(tmpdir(),'rsi-journal-'));let reviewOptions
 const journal=createRsiJournal({root,autoAnalyze:false,round:async(messages,options)=>{reviewOptions=options;assert.match(messages[1].content,/selection/);return {model:'glm-5.3',message:{content:'建议：增加联动验收',reasoning_content:'mock reviewer reasoning'},usage:{total_tokens:123}}}})
 const res={write(){return true},end(){this.writableEnded=true},setHeader(){}}
 await journal.capture({headers:{'x-rsi-record-id':'test-child','x-rsi-parent-id':'test-parent'}},res,{kind:'generation'},async()=>{
  await journal.describe({messages:[{role:'user',content:'旅行路线'}],turnId:'test-stitch'})
  await journal.model(async()=>({message:{content:'<card/>',reasoning_content:'model returned reasoning',tool_calls:[{function:{name:'component_describe'}}]},usage:{total_tokens:5}}),[{role:'user',content:'query',apiKey:'secret-value'}],{})
  res.write('data: {"type":"debug","status":"partial"}\n\n');res.end('data: [DONE]\n\n')
 })
 await journal.interactions('test-child',[{kind:'selection',stateChanged:true}]);await journal.feedback('test-child','地图需要高亮')
 assert.equal((await journal.get('test-child')).parentId,'test-parent');assert.equal((await journal.events('test-child','models')).length,2)
 assert.equal((await journal.events('test-child','models'))[0].messages[0].apiKey,'[REDACTED]')
 assert.equal((await journal.events('test-child','frames')).length,1)
 assert.equal((await journal.events('test-child','feedback'))[0].comment,'地图需要高亮')
 const review=await journal.analyze('test-child');assert.equal(review.status,'completed');assert.equal(reviewOptions.modelOverride,'glm-5.3');assert.equal(reviewOptions.reasoningEffort,'high')
 await journal.append('test-child','models',{type:'result',result:{message:{content:null,tool_calls:[{function:{name:'tool_describe',arguments:'{}'}}]}}});assert.equal((await journal.analyze('test-child')).status,'completed')
 assert.equal((await createRsiJournal({root,autoAnalyze:false}).list()).length,1)
 assert.equal(rsiContext.getStore(),undefined)
 await assert.rejects(()=>journal.get('../outside'))
 await journal.interactions('test-child',[{eventId:'same',kind:'click'},{eventId:'same',kind:'click'}]);await journal.interactions('test-child',[{eventId:'same',kind:'click'}])
 assert.equal((await journal.events('test-child','interactions')).filter(x=>x.event.eventId==='same').length,1)
 await journal.update('test-child',{status:'running',analysis:{status:'running'}});await createRsiJournal({root,autoAnalyze:false}).recoverInterrupted();assert.equal((await journal.get('test-child')).status,'interrupted');assert.equal((await journal.get('test-child')).analysis.status,'interrupted')
})
test('secrets are redacted without deleting ordinary card content',()=>{
 assert.deepEqual(redact({cookie:'abc',value:'Bearer token-123',content:'card text'}),{cookie:'[REDACTED]',value:'Bearer [REDACTED]',content:'card text'})
})

test('GPT metering emits exactly once per physical call, including failed calls with unknown usage',async()=>{
 const root=await mkdtemp(join(tmpdir(),'rsi-cost-')),journal=createRsiJournal({root,autoAnalyze:false}),frames=[]
 const res={write(s){frames.push(s);return true},end(){this.writableEnded=true},setHeader(){},getHeader(){return 'text/event-stream'}}
 await journal.capture({headers:{}},res,{kind:'generation'},async()=>{
  await journal.model(async(_m,o)=>{o.onUsage({prompt_tokens:100,completion_tokens:20});return {requestedModel:'chat-latest',message:{content:'ok'},usage:{prompt_tokens:100,completion_tokens:20}}},[],{modelOverride:'chat-latest'})
  await assert.rejects(journal.model(async()=>{throw Error('cancelled')},[],{modelOverride:'chat-latest'}))
 })
 const costs=frames.filter(x=>x.includes('model_cost')).map(x=>JSON.parse(x.slice(6)))
 assert.equal(costs.length,2);assert.notEqual(costs[0].callId,costs[1].callId);assert.equal(costs[0].cost.usd,.0011);assert.equal(costs[1].cost.status,'unknown')
})
