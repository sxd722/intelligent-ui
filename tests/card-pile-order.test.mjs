import test from 'node:test'
import assert from 'node:assert/strict'
import {forwardPile} from '../src/cardspec/pile-order.mjs'
test('back covers are only later cards, capped at three; final and single cards have no pile',()=>{
 const cards='abcde'.split('').map(id=>({id}))
 assert.deepEqual(forwardPile(cards,0),[{id:'b',depth:1},{id:'c',depth:2},{id:'d',depth:3}])
 assert.deepEqual(forwardPile(cards,3),[{id:'e',depth:1}])
 assert.deepEqual(forwardPile(cards,4),[])
 assert.deepEqual(forwardPile(cards.slice(0,1),0),[])
 assert.deepEqual(forwardPile([],0),[])
 assert.equal(cards[1].depth,undefined)
})
