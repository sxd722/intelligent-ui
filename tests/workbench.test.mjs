import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {createWorkbenchStore} from '../server/workbench.mjs'
import {sandboxDocument} from '../src/workbench/sandbox.mjs'
test('feedback survives store recreation, isolates cases, and retains revision history',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'rsi-workbench-'));try{
 const s=createWorkbenchStore(dir)
 await Promise.all([s.save('01-sentiment',{html:{note:'HTML feedback'}}),s.save('02-family',{cardspec:{note:'CardSpec feedback'}})])
 await s.save('01-sentiment',{html:{note:'edited'}})
 const saved=await createWorkbenchStore(dir).all();assert.equal(saved['01-sentiment'].revision,2);assert.equal(saved['02-family'].feedback.cardspec.note,'CardSpec feedback')
 assert.equal((await readFile(path.join(dir,'history.jsonl'),'utf8')).trim().split('\n').length,3)
 assert.throws(()=>s.save('../escape',{}),/unknown case/);assert.throws(()=>s.save('01-sentiment',{huge:'x'.repeat(31000)}),/invalid feedback/)
 await s.event('01-sentiment',{format:'html',type:'interaction',label:'选择'});assert.match(await readFile(path.join(dir,'interactions.jsonl'),'utf8'),/选择/)
 }finally{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('rsi-workbench-'));await rm(dir,{recursive:true,force:true})}
})
test('sandbox policy is established before model source and host bridge only reports observations',()=>{
 const html=sandboxDocument('<html><body><button>test</button></body></html>','safe-token')
 assert.ok(html.indexOf('Content-Security-Policy')<html.indexOf('<button>'))
 assert.match(html,/connect-src 'none'/);assert.match(html,/worker-src 'none'/);assert.match(html,/form-action 'none'/)
 assert.match(html,/unhandledrejection/);assert.doesNotMatch(html,/fetch\(/)
})
test('remote H5 media follows host origin while network capabilities remain disabled',()=>{
 globalThis.location={origin:'https://example.ts.net'}
 try{const html=sandboxDocument('<img src="http://127.0.0.1:8787/api/media/poster">','test');assert.match(html,/https:\/\/example.ts.net\/api\/media\/poster/);assert.doesNotMatch(html,/127\.0\.0\.1/);assert.match(html,/connect-src 'none'/)}finally{delete globalThis.location}
})
