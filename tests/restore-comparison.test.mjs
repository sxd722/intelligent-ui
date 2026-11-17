import test from 'node:test'
import assert from 'node:assert/strict'
import {compareRestoredState} from '../server/cardspec/restore-comparison.mjs'
test('continuous simulation is compared with the saved checkpoint, not the earlier observation',()=>{
 const observed=[{},{flight:{ticks:1,speed:42}}],saved=[{},{flight:{ticks:4,speed:61}}]
 assert.equal(compareRestoredState(saved,structuredClone(saved)).matched,true)
 assert.equal(compareRestoredState(observed,saved).matched,false)
})
test('real state loss still fails with exact field differences; property order is irrelevant',()=>{
 const saved=[{},{flight:{ticks:4,speed:61}}]
 assert.equal(compareRestoredState(saved,[{},{flight:{speed:61,ticks:4}}]).matched,true)
 const result=compareRestoredState(saved,[{},{flight:{ticks:0,speed:35}}])
 assert.equal(result.matched,false);assert.equal(result.differences[0].path,'/1/flight/ticks')
 assert.equal(result.differences[0].saved,4);assert.equal(result.differences[0].restored,0)
 assert.equal(compareRestoredState(saved,[{},{}]).matched,false)
})
