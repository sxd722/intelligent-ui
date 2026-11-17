import test from 'node:test'
import assert from 'node:assert/strict'
import {experimentLiveRead} from '../src/cardspec/experiment-live-read.mjs'
const payload={tool:'opencli.wikipedia.search',input:{query:'light',limit:4,lang:'en'},target:'binding'}
test('local QA transport requires explicit local read binding and counts calls',async()=>{
 const calls=[];let executed=0
 const make=extra=>experimentLiveRead({hostname:'127.0.0.1',allowed:[payload.tool],calls,maxCalls:1,transport:async()=>{executed++;return {kind:'json',value:{items:[]}}},...extra})
 await assert.rejects(make({hostname:'example.com'})(payload),/DENIED/)
 await assert.rejects(make({allowed:[]})(payload),/DENIED/)
 await assert.rejects(make()({...payload,target:'page'}),/DENIED/)
 assert.equal(executed,0)
 const read=make();await read(payload);assert.equal(executed,1);assert.equal(calls[0].mode,'live-read')
 await assert.rejects(read(payload),/BUDGET/);assert.equal(executed,1)
})
test('model generation is not accepted as a live read',async()=>{
 let executed=0;const read=experimentLiveRead({hostname:'localhost',allowed:['glm.generate'],transport:async()=>executed++})
 await assert.rejects(read({...payload,tool:'glm.generate'}),/DENIED/);assert.equal(executed,0)
})
