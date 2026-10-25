import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { planningConversation, planningMessages, assertJsonPrefix, PlanningFormatError, parsePlanningDocument, planningRepairInstruction } from '../server/cardspec/planning.mjs'
import { handleCardSpec } from '../server/cardspec/handler.mjs'
import { FIXTURES, TEST_CONTEXT } from '../shared/cardspec/fixtures.mjs'
import { closePlanningContainers } from '../server/cardspec/planning-json.mjs'

test('planning context preserves prior content without assistant DSL exemplars', () => {
  const history = [{role:'user',content:'计数卡片'}, {role:'assistant',content:FIXTURES.counter}, {role:'user',content:'改成减一'}]
  const result = planningConversation(history, TEST_CONTEXT)
  assert.deepEqual(result[0], history[0]); assert.deepEqual(result[2], history[2])
  assert.equal(typeof result[1].summary, 'object')
  assert.ok(result[1].summary.components.some(n=>n.component==='button'))
  assert.ok(!JSON.stringify(result).includes('<card'))
})

test('current request is an explicit final message, separate from unrelated old card content',()=>{
  const messages=planningMessages('JSON schema',TEST_CONTEXT,[{role:'user',content:'计数卡'},{role:'assistant',content:FIXTURES.counter},{role:'user',content:'介绍勒贝格测度'},{role:'assistant',content:''}],null,'analysis')
  assert.ok(messages.at(-1).content.startsWith('本轮用户请求：\n介绍勒贝格测度'))
  assert.ok(!messages[1].content.includes('介绍勒贝格测度'))
  assert.ok(messages[1].content.includes('计数卡'))
  assert.ok(!messages.some(m=>m.content.includes('<card')))
})

test('JSON prefix guard handles split fences and rejects markup immediately', () => {
  for (const text of ['', ' ', '{', '\uFEFF {', '`', '``', '```', '```j', '```json\n{']) assert.doesNotThrow(()=>assertJsonPrefix(text))
  for (const text of ['<', '<intro>', '好的', '```html', '[]']) assert.throws(()=>assertJsonPrefix(text), PlanningFormatError)
})

async function run(mode, alwaysWrong = false, badPlan = null) {
  const res = new EventEmitter(), frames = [], calls = []
  res.writeHead = ()=>{}; res.flushHeaders = ()=>{}
  res.write = s => { const data=s.slice(6).trim(); if(data!=='[DONE]') frames.push(JSON.parse(data)) }
  res.end = ()=>{res.writableEnded=true}
  const attempts = {}
  await handleCardSpec({},res,{mode,messages:[{role:'user',content:'做计数卡'}, {role:'assistant',content:FIXTURES.counter}, {role:'user',content:'把标题改一下'}]}, {
    keyLoaded:true, model:'fixture', photo:async()=>null,
    streamUpstream: async(messages, options) => {
      const stage=options.responseFormat ? messages[0].content.includes('"regions"') ? 'plan' : 'analysis' : 'dsl'
      attempts[stage]=(attempts[stage]||0)+1
      calls.push({stage,messages,options})
      if(stage==='dsl') { options.onPiece({content:FIXTURES.counter}); return }
      assert.equal(options.responseFormat.type,'json_object')
      assert.equal(messages.filter(m=>m.role==='system').length,1)
      assert.ok(!messages.some(m=>m.role==='assistant'))
      assert.ok(!messages.some(m=>m.content.includes('<card')))
      if(stage==='plan'&&attempts[stage]===1&&badPlan) { options.onPiece({content:badPlan}); return }
      if(attempts[stage]===1 || alwaysWrong) {
        // Throwing on the first token must prevent the remaining full DSL emission.
        options.onPiece({content:'<'})
        assert.fail('non-JSON model stream was not stopped early')
      }
      options.onPiece({content:JSON.stringify(stage==='analysis' ? {goal:'改标题',interactions:[]} : {theme:{language:'soft',palette:'a'},regions:[]})})
    }
  })
  return {frames,calls}
}

test('staged pipeline aborts wrong-format attempts, retries within phase, then generates DSL once', async()=>{
  const {frames,calls}=await run('staged')
  assert.deepEqual(calls.map(c=>c.stage),['analysis','analysis','plan','plan','dsl'])
  assert.ok(calls.every(c=>c.options.signal.aborted))
  assert.equal(frames.find(f=>f.type==='message_stream_complete').status,'succeeded')
  assert.equal(frames.find(f=>f.type==='server_ste_metadata').metadata.plan_repair_count,2)
  assert.ok(!frames.some(f=>f.o==='patch'&&f.v.some(op=>op.p==='/message/content/parts/0'&&op.v==='<')))
})

const malformedPlans=JSON.parse(readFileSync(new URL('./fixtures/planning-invalid.json',import.meta.url)))
test('real malformed planning output is rejected with a localized retry, never forwarded to DSL',async()=>{
  for(const source of malformedPlans) {
    assert.throws(()=>parsePlanningDocument(source,'plan'),SyntaxError)
    const {frames,calls}=await run('staged',false,source)
    assert.equal(frames.find(f=>f.type==='message_stream_complete').status,'succeeded')
    assert.equal(calls.filter(c=>c.stage==='dsl').length,1)
    const retry=calls.filter(c=>c.stage==='plan')[1].messages.at(-1).content
    assert.ok(retry.includes('错误位置附近'))
    assert.ok(retry.includes('短字符串数组'))
    assert.ok(!retry.includes(source))
  }
})
test('valid JSON still must obey the compact planning shape',()=>{
  const plan={theme:{language:'soft',palette:'a'},regions:[{id:'main',role:'content',content:['table比较两种概念']}],rules:['选择后显示解释']}
  assert.deepEqual(parsePlanningDocument(JSON.stringify(plan),'plan'),plan)
  for(const mutate of [
    p=>p.regions[0].content=[{component:'table',rows:[[1,2]]}],
    p=>p.regions[0].role='footer',p=>p.regions.push(p.regions[0]),
    p=>p.theme.language='frosted-glass',p=>p.rules=[{}],
    p=>p.regions[0].content=['x'.repeat(501)],
  ]) {const p=structuredClone(plan);mutate(p);assert.throws(()=>parsePlanningDocument(JSON.stringify(p),'plan'),PlanningFormatError)}
  assert.throws(()=>parsePlanningDocument('{"goal":"demo","interactions":[{}]}','analysis'),PlanningFormatError)
  assert.ok(planningRepairInstruction(new PlanningFormatError('bad role'),'arbitrary source').includes('bad role'))
  const legacy=structuredClone(plan);legacy.regions[0].role='supporting'
  let normalizations
  const normalized=parsePlanningDocument(JSON.stringify(legacy),'plan',{onNormalize:changes=>{normalizations=changes}})
  assert.equal(normalized.regions[0].role,'content');assert.equal(normalized.regions[0].priority,'supporting');assert.equal(normalizations.length,1)
  legacy.regions[0].priority='required'
  assert.throws(()=>parsePlanningDocument(JSON.stringify(legacy),'plan'),PlanningFormatError)
})

test('missing container closer recovery preserves all content and rejects ambiguous or truncated JSON',async()=>{
  const original=JSON.parse(readFileSync(new URL('./fixtures/planning-missing-closer.json',import.meta.url)))
  let repaired
  const doc=parsePlanningDocument(original,'plan',{onRepair:r=>{repaired=r}})
  assert.equal(doc.regions.length,5)
  assert.deepEqual(repaired.edits,[{offset:874,insert:'}'}])
  assert.equal(repaired.source,original.slice(0,874)+'}'+original.slice(874))
  const {frames,calls}=await run('staged',false,original)
  assert.equal(calls.filter(c=>c.stage==='plan').length,1)
  assert.equal(calls.filter(c=>c.stage==='dsl').length,1)
  assert.equal(frames.find(f=>f.type==='message_stream_complete').status,'succeeded')
  assert.ok(frames.some(f=>f.o==='patch'&&f.v.some(op=>op.v?.planning_syntax_repairs?.length)))
  assert.deepEqual(JSON.parse(closePlanningContainers('{"rows":[{"text":"a ] } \\\" quote"],"n":2}').source),{rows:[{text:'a ] } " quote'}],n:2})
  assert.deepEqual(JSON.parse(closePlanningContainers('{"a":[1,2}').source),{a:[1,2]})
  for(const bad of ['{"a":[1,2','{"a":}','{"a":[1,]}','{"a":1 "b":2}','{"a":"unterminated}','{"a":1} explanation','{"a":1}{"b":2}']) assert.throws(()=>closePlanningContainers(bad))
  // Mechanical closure must not bypass the plan schema.
  assert.throws(()=>parsePlanningDocument('{"theme":{"language":"soft","palette":"a"},"regions":[{"id":"x","role":"content","content":[{"component":"table"}]]}','plan'),PlanningFormatError)
})

test('invalid retry fails without cascading into DSL; direct makes one DSL call', async()=>{
  const failed=await run('staged',true)
  assert.equal(failed.calls.length,2)
  assert.equal(failed.frames.find(f=>f.type==='message_stream_complete').status,'failed')
  const direct=await run('direct')
  assert.deepEqual(direct.calls.map(c=>c.stage),['dsl'])
  assert.equal(direct.frames.find(f=>f.type==='message_stream_complete').status,'succeeded')
})
