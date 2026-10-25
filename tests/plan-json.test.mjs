import test from 'node:test'
import assert from 'node:assert/strict'
import {planExperience} from '../server/cardspec/experience.mjs'
import {planningStatusText} from '../shared/cardspec/planning-status.mjs'
import {EventEmitter} from 'node:events'
import {handleCardSpec} from '../server/cardspec/handler.mjs'

const plan={goal:'理解科学发现',pattern:'explore',primary:'观察对象并预测',interaction:'选择后显示依据',followups:['比较机制','了解证据'],resources:['公开研究'],disclosure:'一句结论，按需展开'}
const json=JSON.stringify(plan)
async function run(raw,options={}) {
  let calls=0;const events=[]
  const result=await planExperience({goal:'有哪些设计科学发现的有趣的咨询',onEvent:e=>events.push(e),streamUpstream:async(_,o)=>{calls++;for(let i=0;i<raw.length;i+=17)o.onPiece({content:raw.slice(i,i+17)})},...options})
  assert.equal(calls,1,'no repair model call')
  assert.equal(events.at(-1).status,result.status)
  return result
}
for(const [name,raw] of [
  ['plain',json],['fenced','```json\n'+json+'\n```'],['BOM','\uFEFF'+json],
  ['trailing explanation',json+'\n\n以上为体验规划。'],
  ['prefix and suffix','规划如下：\n'+json+'\n请按此生成。'],
  ['surrounded fence','说明：\n```json\n'+json+'\n```\n完成。'],
  ['escaped quotes and braces','说明\n'+JSON.stringify({...plan,primary:'包含 "引号"、\\路径、{括号}与[方括号]'})+'\n结束']
]) test('safe planning JSON: '+name,async()=>{const r=await run(raw);assert.equal(r.status,'succeeded');assert.equal(r.plan.goal,plan.goal);if(name==='trailing explanation'){assert.equal(r.recovery.code,'PLAN_JSON_EXTRACTED');assert.equal(r.recovery.rawPreview,raw)}})

for(const [name,raw,code] of [
  ['two objects',json+'\n'+json,'PLAN_JSON_AMBIGUOUS'],
  ['invalid then valid','{bad:true}\n'+json,'PLAN_JSON_AMBIGUOUS'],
  ['two fenced objects','```json\n'+json+'\n```\n```json\n'+json+'\n```','PLAN_JSON_AMBIGUOUS'],
  ['nested valid object',JSON.stringify({wrapper:plan}),'PLAN_SCHEMA'],
  ['array containing plan',JSON.stringify([plan]),'PLAN_SCHEMA'],
  ['truncated',json.slice(0,-1),'PLAN_JSON_FORMAT'],
  ['incomplete second document',json+'\n{','PLAN_JSON_FORMAT'],
  ['trailing comma',json.slice(0,-1)+',}','PLAN_JSON_FORMAT'],
  ['curly quotes',json.replaceAll('"','“'),'PLAN_JSON_FORMAT'],
  ['mismatched delimiters','{"a":[1}}','PLAN_JSON_FORMAT'],
  ['no JSON','下面给你一个计划','PLAN_JSON_FORMAT'],
  ['extra field',JSON.stringify({...plan,tool:'danger'}),'PLAN_SCHEMA'],
  ['wrong type',JSON.stringify({...plan,resources:[{}]}),'PLAN_SCHEMA'],
  ['overlong field',JSON.stringify({...plan,primary:'x'.repeat(221)}),'PLAN_SCHEMA'],
  ['oversized response','x'.repeat(6000),'PLAN_LIMIT']
]) test('reject unsafe planning JSON: '+name,async()=>{const r=await run(raw);assert.equal(r.status,'fallback');assert.equal(r.code,code);assert.ok(r.diagnostic.rawPreview.length<=2000);assert.ok(planningStatusText(r).includes('已回退快速生成'));if(raw.length<=2000)assert.equal(r.diagnostic.rawPreview,raw)})

test('large single chunk is bounded and includes truncation metadata',async()=>{
 const raw='a'.repeat(100000),r=await planExperience({goal:'x',streamUpstream:async(_,o)=>o.onPiece({content:raw})})
 assert.equal(r.code,'PLAN_LIMIT');assert.equal(r.diagnostic.rawCharacters,100000);assert.equal(r.diagnostic.rawPreview.length,2000);assert.equal(r.diagnostic.rawTruncated,true)
})
test('timeout and gateway failures are distinct and retain partial output',async()=>{
 const r=await planExperience({goal:'x',timeoutMs:5,streamUpstream:async(_,o)=>{o.onPiece({content:'{'});await new Promise((_,reject)=>o.signal.addEventListener('abort',()=>reject(o.signal.reason),{once:true}))}})
 assert.equal(r.code,'PLAN_TIMEOUT');assert.equal(r.diagnostic.rawPreview,'{');assert.match(planningStatusText(r),/超时/)
 const g=await planExperience({goal:'x',streamUpstream:async()=>{throw Error('model gateway HTTP 503')}})
 assert.equal(g.code,'PLAN_UPSTREAM');assert.match(planningStatusText(g),/模型调用失败/)
})
test('legacy fallback displays its actual class without migration',()=>{
 assert.match(planningStatusText({status:'fallback',reason:'Unexpected non-whitespace character after JSON at position 628 (line 18 column 1)'}),/JSON 格式错误/)
 assert.match(planningStatusText({status:'fallback',code:'PLAN_JSON_AMBIGUOUS'}),/多个 JSON/)
 assert.match(planningStatusText({status:'fallback',code:'PLAN_SCHEMA'}),/字段不符合契约/)
})

for (const recovered of [true,false]) test('HTTP generation continues with exactly two calls: '+(recovered?'extracted':'fallback'),async()=>{
 const frames=[],res=new EventEmitter();let calls=0
 res.writeHead=()=>{};res.flushHeaders=()=>{};res.end=()=>{res.writableEnded=true}
 res.write=s=>{const data=s.slice(6).trim();if(data!=='[DONE]')frames.push(JSON.parse(data))}
 await handleCardSpec({},res,{mode:'experience',messages:[{role:'user',content:'有哪些设计科学发现的有趣的咨询'}]}, {
  keyLoaded:true,model:'fixture',streamUpstream:async(_,o)=>{
   calls++;o.onPiece({content:calls===1?(recovered?json+'\n以上为规划。':json+'\n'+json):'<card><text>科学发现</text></card>'})
  }
 })
 assert.equal(calls,2)
 assert.equal(frames.find(f=>f.type==='message_stream_complete').status,'succeeded')
 const result=frames.find(f=>f.type==='experience'&&f.status!=='planning')
 assert.equal(result.status,recovered?'succeeded':'fallback')
 assert.ok(recovered?result.recovery.rawPreview:result.diagnostic.rawPreview)
})
