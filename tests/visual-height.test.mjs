import test from 'node:test'
import assert from 'node:assert/strict'
import {createVisualEvidenceGuard} from '../server/cardspec/visual-evidence.mjs'
import {createDebugSession} from '../server/cardspec/debug-session.mjs'
const snapshot=(visible=1,issues=[])=>({errors:[],controls:[],coverage:[],visuals:[{owner:'/scene',visible,issues}]})
const evidence=(visible=1,issues=[])=>({status:'tested',runs:[{width:432,scenario:'normal',initial:snapshot(visible,issues),final:snapshot(visible,issues),actions:[],pageErrors:[]}]})
test('visual presence is kept at matched views; geometry implementation may change',()=>{
 const guard=createVisualEvidenceGuard();guard.observe(evidence(),'a')
 assert.equal(guard.compare(evidence(0),'a')[0].code,'debug_visual_regression')
 assert.deepEqual(guard.compare(evidence(1),'a'),[])
 assert.deepEqual(guard.compare(evidence(0),'different-context'),[])
 const narrow=evidence(0);narrow.runs[0].width=320;assert.deepEqual(guard.compare(narrow,'a'),[])
 const empty=evidence(0);empty.runs[0].scenario='empty';assert.deepEqual(guard.compare(empty,'a'),[])
})
test('intentional navigation is compared only against the same executed steps',()=>{
 const guard=createVisualEvidenceGuard(),a=evidence()
 a.runs[0].actions=[{step:{op:'click',name:'详情'},ok:true,visuals:[{owner:'/scene',visible:0}]}]
 guard.observe(a,'a');assert.deepEqual(guard.compare(a,'a'),[])
 const b=evidence();b.runs[0].actions=[{step:{op:'click',name:'动画'},ok:true,visuals:[{owner:'/scene',visible:1}]}];guard.observe(b,'a')
 assert.deepEqual(guard.compare(a,'a'),[])
 b.runs[0].actions[0].visuals[0].visible=0;assert.equal(guard.compare(b,'a').length,1)
})
test('zero sized drawing fails debugging even when text and controls are present',async()=>{
 const session=createDebugSession({artifactRoot:'artifacts/visual-height-qa/gates',cardId:'zero',runner:async()=>evidence(0,[{message:'SVG 320×0px'}])})
 const r=await session.test({source:'<card><text>Text still present</text></card>'})
 assert.equal(r.status,'failed');assert.ok(r.diagnostics.some(d=>d.code==='debug_visual_zero_size'));assert.throws(()=>session.commit({version:r.version}));assert.equal(session.canCommit(),false)
})
test('deleting visuals cannot bypass gate via cached feedback or an older commit',async()=>{
 let count=0;const session=createDebugSession({artifactRoot:'artifacts/visual-height-qa/gates',cardId:'cache',runner:async()=>evidence(count++===1?1:0)})
 const a='<card><text>Draft</text></card>',b='<card><text>Working visual</text></card>'
 const first=await session.test({source:a});assert.equal(first.status,'passed')
 const good=await session.test({source:b});assert.equal(good.status,'passed')
 const cached=await session.test({source:a});assert.equal(cached.cached,true);assert.equal(cached.status,'failed')
 assert.throws(()=>session.commit({version:first.version}),/debug_visual_regression/)
 assert.equal(session.commit({version:good.version}).source,b)
 const dropped=await session.test({source:a+'\n'});assert.equal(dropped.status,'failed')
})
