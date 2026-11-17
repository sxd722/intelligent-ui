import test from 'node:test'
import assert from 'node:assert/strict'
import {validateExpectation as baseline} from '../experiments/round1-20261117/common-calibration/before/debug-assertions.mjs'
import {validateExpectation} from '../shared/cardspec/debug-assertions.mjs'
import {CARD_TEST_TOOL,CARD_RETEST_TOOL,validateDebugInput} from '../server/cardspec/debug-session.mjs'

test('frozen B0 reproduces vague error; calibrated schema excludes extra expect fields and localizes without rewriting source',()=>{
 const expect={text:'chosen',requirement:'R1'}
 assert.throws(()=>baseline(expect),/^Error: invalid expectation$/)
 assert.throws(()=>validateExpectation(expect),/unsupported expect.requirement; put requirement on the step/)
 const shape=CARD_TEST_TOOL.function.parameters.properties.steps.items.properties
 assert.equal(shape.expect.additionalProperties,false);assert.ok(shape.requirement);assert.equal(shape.expect.properties.requirement,undefined)
 assert.equal(CARD_RETEST_TOOL.function.parameters.properties.steps.items.properties.expect.additionalProperties,false)
 const source='<card><text>chosen</text></card>'
 assert.throws(()=>validateDebugInput({source,steps:[{op:'check',expect}]}),/step 1.expect: unsupported expect.requirement/)
 const fixed=validateDebugInput({source,steps:[{op:'check',requirement:'R1',expect:{text:'chosen'}}]})
 assert.equal(fixed.source,source);assert.deepEqual(expect,{text:'chosen',requirement:'R1'})
 assert.throws(()=>validateExpectation({whatever:1}),/unsupported expect.whatever/)
})
