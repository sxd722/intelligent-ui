import test from 'node:test'
import assert from 'node:assert/strict'
import {createSandboxClient} from '../src/cardspec/sandbox-client.js'
test('fatal sandbox close retains the first cause for pending and subsequent requests',async()=>{
 const before=globalThis.Worker
 globalThis.Worker=class{postMessage(){}terminate(){}}
 try{
  const c=createSandboxClient(),p=c.request('input',{})
  const check=assert.rejects(p,/original failure/)
  c.close('original failure');c.close('Sandbox stopped')
  await check
  await assert.rejects(c.request('input',{}),/original failure/)
 }finally{if(before===undefined)delete globalThis.Worker;else globalThis.Worker=before}
})
