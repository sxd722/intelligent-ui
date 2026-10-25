import test from 'node:test'
import assert from 'node:assert/strict'
import {generationHistory} from '../src/generation-history.mjs'
import {TOOLS,toolReference} from '../shared/cardspec/tools.mjs'
import {normalizeOpenCli} from '../server/tools/opencli.mjs'
import {detailRequests} from '../shared/cardspec/result-view.mjs'
const user=content=>({role:'user',content})
const turn=(source,status='succeeded',format='cardspec')=>({role:'assistant',format,status,source,phases:[]})
const history=messages=>generationHistory(messages,'cardspec','当前需求',m=>m.source)

test('rejected source and repair diagnostics do not continue into a new request',()=>{
 const failed={...turn('INVALID DSL','failed'),error:'unknown binding p'}
 const result=history([user('周末观影'),failed])
 assert.equal(result[0].content,'周末观影')
 assert.ok(!JSON.stringify(result).includes('unknown binding p'))
 assert.ok(!JSON.stringify(result).includes('INVALID DSL'))
 assert.equal(result.at(-1).content,'当前需求')
})
test('history retains recent successful programs whole, excludes other protocol and bounds old examples',()=>{
 const messages=Array.from({length:10},(_,i)=>[user('任务'+i),turn('<card>'+i+'</card>')]).flat()
 messages.push(turn('DIL program','succeeded','dil'))
 const result=history(messages)
 assert.equal(result.length,7)
 assert.equal(result[0].content,'任务7')
 assert.equal(JSON.parse(result.at(-2).content).source,'<card>9</card>');assert.equal(JSON.parse(result.at(-2).content).status,'completed')
 assert.ok(!JSON.stringify(result).includes('DIL program'))
 assert.equal(messages.length,21)
 const large=history([user('大型卡片'),turn('<card>'+ 'x'.repeat(22000)+'</card>')])
 assert.ok(large[1].content.length<200)
 assert.ok(!large[1].content.includes('<card>'))
})
test('disclosed search fields preserve real subject IDs and type through detail handoff',()=>{
 const tool='opencli.douban.search'
 for(const field of ['id','type','cover'])assert.ok(TOOLS[tool].additionalFields.includes(field))
 assert.match(toolReference(true,[tool]),/Real subject ID/)
 for(const type of ['movie','book','music']){
  const row=normalizeOpenCli(tool,[{id:'1292052',type,title:'测试条目',url:'https://movie.douban.com/subject/1292052/',cover:'https://img1.doubanio.com/view/photo/s_ratio_poster/public/p.jpg'}]).items[0]
  const requests=detailRequests(tool,row)
  if(type==='music')assert.deepEqual(requests,[])
  else assert.deepEqual(requests[0].input,{id:'1292052',type})
 }
 assert.deepEqual(detailRequests(tool,{title:'没有ID'}),[])
})
