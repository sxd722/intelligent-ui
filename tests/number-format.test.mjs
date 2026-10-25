import test from 'node:test'
import assert from 'node:assert/strict'
import {parseExpression, evaluate} from '../shared/cardspec/expression.mjs'
test('display formatting retains precision without changing numeric rounding',()=>{
  const run = source => evaluate(parseExpression(source),{})
  assert.equal(run('formatNumber(44,2)'), '44.00')
  assert.equal(run('formatNumber(1.235,2)'), '1.24')
  assert.equal(run('formatNumber(-12.5,2)'), '-12.50')
  assert.equal(run('formatNumber(0,0)'), '0')
  assert.equal(run('round(44,2)'), 44)
  assert.throws(()=>run('formatNumber(3,100)'))
  assert.throws(()=>run('formatNumber(3,-1)'))
})
