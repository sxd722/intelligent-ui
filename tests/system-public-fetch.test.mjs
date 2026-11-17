import {test} from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {PassThrough} from 'node:stream'
import {systemPublicFetch} from '../server/tools/system-public-fetch.mjs'
test('public transport isolates URL arguments and preserves HTTP failures',async()=>{
 let captured;const fetcher=systemPublicFetch(()=>{throw Error('unexpected native')},{proxy:'http://127.0.0.1:7890',spawnImpl:(file,args,options)=>{
  captured={file,args,options};const c=new EventEmitter();c.stdout=new PassThrough();c.stderr=new PassThrough();c.kill=()=>{};
  queueMicrotask(()=>{c.stdout.write('denied\n__PUBLIC_HTTP_META__'+JSON.stringify({response_code:403,url_effective:'https://example.com',num_redirects:0}));c.emit('close',0)});return c
 }})
 const r=await fetcher('https://example.com/?query=$()');assert.equal(r.status,403);assert.equal(await r.text(),'denied');assert.equal(captured.options.shell,false);assert.equal(captured.args.at(-1),'https://example.com/?query=$()');assert.ok(!captured.args.includes('--insecure'))
})
test('authenticated requests stay on original transport',async()=>{
 let called=0;const f=systemPublicFetch(async()=>{called++;return new Response('native')},{spawnImpl:()=>{throw Error('must not spawn')}})
 await f('https://example.com',{headers:{Authorization:'Bearer example'}});await f('https://example.com',{method:'POST',body:'x'});assert.equal(called,2)
})
