import test from 'node:test'
import assert from 'node:assert/strict'
import {latestInputPump} from '../src/cardspec/latest-input.mjs'
const settle=()=>new Promise(resolve=>setImmediate(resolve))
test('rapid snapshots run one at a time and render only the latest input',async()=>{
 const calls=[],rendered=[],errors=[],pending=[]
 const pump=latestInputPump(value=>{calls.push(value);return new Promise(resolve=>pending.push(resolve))},v=>rendered.push(v),e=>errors.push(e))
 pump.push(0);for(let i=1;i<=100;i++)pump.push(i)
 assert.deepEqual(calls,[0]);pending.shift()('old');await settle()
 assert.deepEqual(calls,[0,100]);assert.deepEqual(rendered,[])
 pending.shift()('latest');await settle();assert.deepEqual(rendered,['latest']);assert.deepEqual(errors,[])
})
test('stale failure does not hide newer content and disposal ignores late results',async()=>{
 const pending=[],errors=[],rendered=[]
 const pump=latestInputPump(value=>new Promise((resolve,reject)=>pending.push({resolve,reject})),v=>rendered.push(v),e=>errors.push(e))
 pump.push(1);pump.push(2);pending[0].reject(Error('old failure'));await settle()
 assert.equal(pending.length,2);assert.deepEqual(errors,[])
 pump.close();pending[1].resolve('late');await settle();assert.deepEqual(rendered,[])
})
test('current failure is reported without swallowing real sandbox errors',async()=>{
 const errors=[];const pump=latestInputPump(async()=>{throw Error('invalid source')},()=>{},e=>errors.push(e.message))
 pump.push(1);await settle();assert.deepEqual(errors,['invalid source'])
})
