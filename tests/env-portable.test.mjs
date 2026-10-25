import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,rmSync,rmdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {loadApiKey,loadPexelsKey,DEFAULT_ENV_PATH} from '../server/env.mjs'

test('source distribution uses a project-local credential file default',()=>{
 assert.equal(DEFAULT_ENV_PATH,'.env.local')
})
test('configured model environment key takes precedence without reading a private file',()=>{
 const before=process.env.MODEL_API_KEY
 try{process.env.MODEL_API_KEY='test-only-model-key';assert.deepEqual(loadApiKey('does-not-exist'),{ok:true,value:'test-only-model-key',source:'process-env'})}
 finally{if(before===undefined)delete process.env.MODEL_API_KEY;else process.env.MODEL_API_KEY=before}
})
test('model file fallback does not mistake Pexels credentials for a model key',()=>{
 const names=['MODEL_API_KEY','ARK_API_KEY','VOLC_API_KEY','VOLCENGINE_API_KEY','GLM_API_KEY','ZHIPU_API_KEY','FLYWHEEL_API_KEY','API_KEY'],saved=Object.fromEntries(names.map(n=>[n,process.env[n]])),dir=mkdtempSync(join(tmpdir(),'cardspec-env-test-')),file=join(dir,'test.env')
 try{
  names.forEach(n=>delete process.env[n]);writeFileSync(file,'PEXELS_API_KEY=test-image-key\nMODEL_API_KEY=test-file-model-key\n')
  assert.equal(loadApiKey(file).value,'test-file-model-key')
  writeFileSync(file,'PEXELS_API_KEY=test-image-key\n');assert.equal(loadApiKey(file).ok,false)
 }finally{for(const n of names)if(saved[n]===undefined)delete process.env[n];else process.env[n]=saved[n];rmSync(file);rmdirSync(dir)}
})
