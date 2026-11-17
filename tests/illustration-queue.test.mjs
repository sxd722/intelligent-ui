import test from 'node:test'
import assert from 'node:assert/strict'
import {createIllustrationQueue} from '../src/cardspec/illustration-queue.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {photoKey} from '../shared/cardspec/images.mjs'

test('delivery queues hidden images in document order; visible consumers share work; failures do not block next image',async()=>{
 const compiled=compileCard(`<card><image query="gen: first"/><if test={false}><image query="gen: second"/></if><image query="forest"/><image query="gen: third"/></card>`,{final:true})
 assert.equal(compiled.complete,true,JSON.stringify(compiled.diagnostics))
 const started=[],gates=[];let active=0,maxActive=0
 const queue=createIllustrationQueue((query)=>{started.push(query);active++;maxActive=Math.max(maxActive,active);return new Promise((resolve,reject)=>gates.push(ok=>{active--;ok?resolve({status:'loaded',url:query}):reject(Error('unavailable'))}))})
 const work=queue.preload(compiled.spec)
 assert.equal(work.length,3)
 assert.equal(queue.request('gen: first'),work[0])
 await Promise.resolve();assert.deepEqual(started,['gen: first'])
 gates[0](true);await work[0];await Promise.resolve();await Promise.resolve()
 assert.deepEqual(started,['gen: first','gen: second'])
 gates[1](false);await work[1];await Promise.resolve();await Promise.resolve()
 assert.deepEqual(started,['gen: first','gen: second','gen: third'])
 gates[2](true);const result=await Promise.all(work)
 assert.equal(result[1].status,'error');assert.equal(result[2].status,'loaded');assert.equal(maxActive,1)
 await Promise.all(queue.preload(compiled.spec));assert.equal(started.length,3)
})

test('already resolved and explicitly failed fixture resources are not regenerated; deferred is queued',async()=>{
 const spec=compileCard('<card><image query="gen: first"/><image query="gen: second"/><image query="gen: third"/></card>',{final:true}).spec
 const calls=[],q=createIllustrationQueue(async query=>{calls.push(query);return {status:'loaded'}})
 await Promise.all(q.preload(spec,{[photoKey('gen: first')]:{status:'loaded'},[photoKey('gen: second')]:{status:'error'},[photoKey('gen: third')]:{status:'deferred'}}))
 assert.deepEqual(calls,['gen: third'])
})
