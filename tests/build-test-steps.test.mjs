import test from 'node:test'
import assert from 'node:assert/strict'
import {compactBuildTestSteps} from '../server/cardspec/build-test-steps.mjs'
import {validateDebugInput} from '../server/cardspec/debug-session.mjs'
test('post-action checks compact without losing actions, assertions or requirement identity',()=>{
 const steps=[{op:'click',name:'详情',requirement:'R1',expect:{changed:true,state:{view:'detail'}}},{op:'check',requirement:'R1',expect:{text:['导演','演员']}},{op:'check',requirement:'R2',expect:{text:'简介'}},{op:'click',name:'返回'}]
 const out=compactBuildTestSteps(steps)
 assert.equal(out.length,3);assert.equal(out[0].expect.changed,true);assert.deepEqual(out[0].expect.state,{view:'detail'});assert.deepEqual(out[0].expect.text,['导演','演员']);assert.equal(out[1].requirement,'R2');assert.equal(steps.length,4)
})
test('conflicting values, changed checks and different scenarios remain separate',()=>{
 const a={op:'click',requirement:'R1',expect:{state:{n:1},visual:true}}
 for(const b of [{state:{n:2}},{visual:false},{changed:false}])assert.equal(compactBuildTestSteps([a,{op:'check',requirement:'R1',expect:b}]).length,2)
 assert.equal(compactBuildTestSteps([a,{op:'check',requirement:'R1',scenario:'empty',expect:{text:'空'}}]).length,2)
})

test('deep checks do not consume interaction slots or silently lose assertions',()=>{
 const actions=Array.from({length:12},()=>({op:'click',name:'Next'})),checks=Array.from({length:8},()=>({op:'check',expect:{changed:false,text:'Result'}}))
 assert.equal(validateDebugInput({source:'<card/>',steps:[...actions,...checks]},48000).steps.length,20)
 assert.throws(()=>validateDebugInput({source:'<card/>',steps:Array.from({length:17},()=>({op:'click',name:'Next'}))},48000),/16 interaction/)
 assert.throws(()=>validateDebugInput({source:'<card/>',steps:Array.from({length:33},()=>({op:'check'}))},48000),/32 steps/)
 assert.throws(()=>validateDebugInput({source:'<card/>',steps:checks.concat({op:'check'})}),/8 steps/)
})
