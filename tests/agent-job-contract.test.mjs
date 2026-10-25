import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {validateCompletion} from '../server/agent-job-contract.mjs'
const hash=s=>createHash('sha256').update(s).digest('hex')
function fixture(){const source='card',tests=[{op:'expectText',text:'done'}];return [{startedAt:1000},{status:'compiled',sourceHash:hash(source),artifactHash:'v2'},{artifactHash:'v2',at:new Date(2000).toISOString(),testsHash:hash(JSON.stringify(tests)),results:[320,360,432].flatMap(width=>['square','auto'].map(size=>({width,size,passed:true})))},tests,source]}
test('fresh verified artifact completes',()=>assert.doesNotThrow(()=>validateCompletion(...fixture())))
test('old results and mismatched sources never complete new jobs',()=>{for(const change of [a=>a[2].at=new Date(500).toISOString(),a=>a[4]='new source',a=>a[2].artifactHash='v1',a=>a[3].push({op:'click'}),a=>a[1].status='invalid']){const a=fixture();change(a);assert.throws(()=>validateCompletion(...a))}})
test('all six unique size checks must pass',()=>{for(const change of [a=>a[2].results[0].passed=false,a=>a[2].results.pop(),a=>a[2].results[0]={...a[2].results[1]},a=>a[2].results[0].width=999]){const a=fixture();change(a);assert.throws(()=>validateCompletion(...a))}})
