import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {planExperience} from '../server/cardspec/experience.mjs'
import {validateExperiencePlan,experienceDiagnostics} from '../shared/cardspec/experience.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createAssetIssuer} from '../server/tools/assets.mjs'
import {handleCardSpec} from '../server/cardspec/handler.mjs'
import {createToolService} from '../server/tools/service.mjs'
import {createCardSession} from '../src/cardspec/tool-session.mjs'
import {cardGenerationPrompt,CARD_DSL_PROMPT} from '../server/cardspec/prompt.mjs'
const plan={goal:'理解',pattern:'quantities',primary:'柱状图',interaction:'参数改变数值',followups:['保存','比较'],resources:['示例数值'],disclosure:'先结论后说明'}
const card='<card schemaVersion="1" actionMode="snapshot"><state id="n" type="number" initial={1}/><action id="add"><increment target="n"/></action><button onPress="add">增加</button><text>{state.n}</text></card>'
const stream=value=>async(_m,o)=>{o.onUsage?.({total_tokens:10});o.onPiece({content:value})}
test('experience plan is bounded intent, not a component tree',()=>{assert.deepEqual(validateExperiencePlan(plan),plan);assert.throws(()=>validateExperiencePlan({...plan,children:[]}));assert.throws(()=>validateExperiencePlan({...plan,primary:'<card>正文'}));assert.throws(()=>validateExperiencePlan({...plan,resources:[{},{}]}))})
test('planned generation substitutes generic advice; observed actions retain no user values',()=>{
 assert.equal(cardGenerationPrompt(null),CARD_DSL_PROMPT)
 assert.ok(cardGenerationPrompt(plan).length<CARD_DSL_PROMPT.length)
 assert.ok(cardGenerationPrompt(plan).includes('assetRef'))
 const s=createCardSession(compileCard(card,{final:true}).spec)
 s.fire('add',{args:{privateText:'never retain this'}})
 assert.equal(s.current().experienceActivity.actions[0].stateChanged,true)
 assert.equal(JSON.stringify(s.current().experienceActivity).includes('privateText'),false)
 s.dispose()
})
test('planning has one call and records usage; malformed plan falls back',async()=>{
 const r=await planExperience({streamUpstream:stream(JSON.stringify(plan)),goal:'x',cardSize:'auto'});assert.equal(r.status,'succeeded');assert.equal(r.usage.total_tokens,10)
 let calls=0;const bad=await planExperience({streamUpstream:async()=>{calls++;throw Error('gateway down')},goal:'x'});assert.equal(bad.status,'fallback');assert.equal(calls,1)
})
test('planning timeout falls back but user cancellation propagates',async()=>{
 const wait=async(_m,o)=>new Promise((_,reject)=>o.signal.addEventListener('abort',()=>reject(o.signal.reason),{once:true}))
 const r=await planExperience({streamUpstream:wait,goal:'x',timeoutMs:5});assert.equal(r.status,'fallback')
 const c=new AbortController();setTimeout(()=>c.abort(Error('user cancel')),5);await assert.rejects(planExperience({streamUpstream:wait,signal:c.signal,goal:'x'}),/user cancel/)
})
test('presentation diagnostics are warnings and action probes are effect-free',()=>{
 const spec=compileCard(card,{final:true}).spec,result=experienceDiagnostics(spec,{plan});assert.equal(result.metrics.changedActions,1);assert.ok(result.warnings.every(w=>w.severity==='warning'));assert.equal(spec.state.n.initial.value,1)
 const dense=compileCard('<card><text>'+('长'.repeat(160))+'</text><text>'+('长'.repeat(160))+'</text></card>',{final:true}).spec
 assert.ok(experienceDiagnostics(dense).warnings.some(w=>w.code==='experience_dense_text'));assert.ok(!experienceDiagnostics(dense,{plan:{...plan,pattern:'reading'}}).warnings.some(w=>w.code==='experience_dense_text'))
})
test('asset references are signed, survive issuer reconstruction and reject tampering',()=>{
 const key=Buffer.alloc(32,7),a=createAssetIssuer(key),url='https://img3.doubanio.com/view/photo/s_ratio_poster/public/p123.jpg',ref=a.issue(url)
 assert.equal(createAssetIssuer(key).resolve(ref),url);assert.throws(()=>a.resolve(ref.slice(0,-2)+'zz'));assert.equal(a.issue('http://127.0.0.1/a.png'),null)
 const result=a.attach({items:[{poster:url,assetRef:'fake'},{image:'https://example.org/a.png',assetRef:'fake'}]});assert.equal(result.items[0].assetRef,ref);assert.equal(result.items[1].assetRef,undefined)
})
test('image sources are exclusive, async missing assets are renderable placeholders',()=>{
 for(const attrs of ['','query="lake" assetRef={null}'])assert.equal(compileCard(`<card><image ${attrs}/></card>`,{final:true}).complete,false)
 assert.equal(compileCard('<card><image assetRef={null} alt="未加载"/></card>',{final:true}).complete,true)
 assert.equal(compileCard('<card><image assetRef="https://evil.org/a"/></card>',{final:true}).complete,false)
 assert.equal(compileCard('<card><image query="lake"/></card>',{final:true}).complete,true)
})
test('experience HTTP generation plans once, then emits validated card with metadata',async()=>{
 const res=new EventEmitter(),frames=[];res.writeHead=()=>{};res.flushHeaders=()=>{};res.end=()=>{res.writableEnded=true};res.write=s=>{const v=s.slice(6).trim();if(v!=='[DONE]')frames.push(JSON.parse(v))};let calls=0
 await handleCardSpec({},res,{mode:'experience',messages:[{role:'user',content:'试算'}]},{keyLoaded:true,model:'fixture',streamUpstream:async(m,o)=>stream(++calls===1?JSON.stringify(plan):card)(m,o)})
 assert.equal(calls,2);assert.equal(frames.find(f=>f.type==='message_stream_complete').status,'succeeded');assert.ok(frames.some(f=>f.type==='experience'&&f.status==='succeeded'))
})
test('page and slot use the same planner, JSON target remains one model call',async()=>{
 for(const target of ['page','slot:detail','binding']){
 let calls=0;const service=createToolService({keyLoaded:true,cli:{available:async()=>({available:false}),close(){}},opencli:{status:async()=>({}),available:async()=>({available:false}),close(){}},streamUpstream:async(m,o)=>stream(++calls===1&&target!=='binding'?JSON.stringify(plan):target==='binding'?'{}':card)(m,o)})
 const result=await service.invoke({tool:'glm.generate',input:{prompt:'做一个试算',...(target==='binding'?{schema:{type:'object',properties:{}}}:{})},requestId:'r',pageId:'p',sessionId:'s',cause:'user',target,view:{generationMode:'experience'}},new AbortController().signal)
 assert.equal(calls,target==='binding'?1:2);assert.equal(result.kind,target==='binding'?'json':target==='page'?'page':'slot');service.close()
 }
})
