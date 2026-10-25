import test from 'node:test'
import assert from 'node:assert/strict'
import { recoveryDraft } from '../shared/cardspec/recovery.mjs'
import { compileCard } from '../shared/cardspec/compiler.mjs'

test('rejected cards retain literal copy and form labels without executing the program',()=>{
  const source='<card><title>行程安排</title><input label="出发站" value={state.missing}/><text>请补充出发站与到达站。</text><text>查询结果 {bindings.missing.value}</text><if test={state.missing}><text>已经查询成功</text></if><each items={state.missing} as="r" itemKey={r.id}><text>伪结果</text></each><action id="x"><invoke binding="missing"/></action></card>'
  assert.equal(compileCard(source,{final:true}).complete,false)
  assert.deepEqual(recoveryDraft(source,'安排明天行程'),{title:'行程安排',goal:'安排明天行程',text:['请补充出发站与到达站。'],fields:['出发站']})
})
test('recovery handles clarification prose, truncated syntax and unknown markup as text only',()=>{
  assert.deepEqual(recoveryDraft('请告诉我出发站与到达站。').text,['请告诉我出发站与到达站。'])
  assert.equal(recoveryDraft('<card><title>标题</title><text>{').title,'标题')
  const draft=recoveryDraft('<card><script>bad()</script><text>&lt;img src=x onerror=bad()&gt;</text></card>')
  assert.deepEqual(draft.text,['<img src=x onerror=bad()>']) // React renders this as text, never HTML.
  assert.equal(recoveryDraft('', '原始需求').goal,'原始需求')
})
test('recovery excludes hidden and actionable content and bounds large drafts',()=>{
  const result=recoveryDraft('<card><text visible={false}>隐藏</text><button onPress="pay">已经付款</button><text>'+ '字'.repeat(4000) +'</text></card>')
  assert.deepEqual(result.text,['字'.repeat(1200)])
  assert.equal(result.fields.length,0)
})
