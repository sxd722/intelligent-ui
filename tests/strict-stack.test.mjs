import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import {createDebugSession} from '../server/cardspec/debug-session.mjs'
import {summarizeDebugFeedback} from '../server/cardspec/debug-feedback.mjs'
import {deckItemState} from '../src/cardspec/deck-status.mjs'
import {handleCardSpec} from '../server/cardspec/handler.mjs'
const source=n=>'<card>'+Array.from({length:n},(_,i)=>`<sandbox id="s${i}" brief="独立计数" initial={{n:0}} source={'export default function App({state,setState}){return <button onClick={()=>setState({n:state.n+1})}>计数 {state.n}</button>}'} height={160}/>`).join('')+'</card>'
const tested=()=>({status:'tested',runs:[{scenario:'normal',initial:{errors:[]},final:{errors:[],controls:[],coverage:[]},actions:[],pageErrors:[]}]})
test('four independent strict modules compile with independent IDs; nesting still forbidden',async()=>{
 const result=compileCard(source(4),{final:true,context:{renderMode:'hybrid'}})
 await validateRichContent(result);assert.equal(result.complete,true,JSON.stringify(result.diagnostics));assert.deepEqual(Object.keys(result.spec.sandboxModules),['s0','s1','s2','s3'])
 assert.equal(compileCard(source(5),{final:true,context:{renderMode:'hybrid'}}).complete,false)
 assert.equal(compileCard('<card><sandbox id="a" brief="x"><sandbox id="b" brief="x"/></sandbox></card>',{final:true,context:{renderMode:'hybrid'}}).complete,false)
})
test('module compile reports all bad modules without discarding valid module',async()=>{
 const text=source(3).replaceAll('state.n+1','fetch("https://example.com")').replace('fetch("https://example.com")','state.n+1')
 const r=compileCard(text,{final:true,context:{renderMode:'hybrid'}});await validateRichContent(r)
 assert.equal(r.complete,false);assert.ok(r.spec.sandboxModules.s0);assert.deepEqual(r.diagnostics.filter(d=>d.severity==='error').map(d=>d.nodeId),['s1','s2'])
})
test('model feedback keeps late failure and actual expected-field state, omits huge snapshots',()=>{
 const action=i=>({step:{op:'click',name:'单步',expect:{state:{step:3}}},ok:true,observed:{text:'x'.repeat(6000),state:{step:i}},visuals:Array(50).fill({tree:'v'.repeat(500)}),assertion:{passed:i!==7,failures:i===7?['step expected 3']:[]},changed:true})
 const f=summarizeDebugFeedback({version:'a',status:'failed',diagnostics:[],browser:{runs:[{scenario:'normal',width:432,actions:Array.from({length:10},(_,i)=>action(i)),final:{controls:[],coverage:[]}}]}})
 assert.ok(JSON.stringify(f).length<=6000);assert.equal(f.actions[0].step,8);assert.equal(f.actions[0].observed.state.step,7);assert.equal(f.summary.failed,1);assert.ok(!JSON.stringify(f).includes('visuals'))
})
test('each submitted candidate previews before browser; invalid draft cannot replace usable UI',async()=>{
 const events=[],session=createDebugSession({context:()=>({renderMode:'hybrid'}),artifactRoot:'artifacts/strict-stack-qa/unit',onCandidate:c=>events.push({type:'candidate',valid:!!c.spec,modules:Object.keys(c.spec?.sandboxModules||{})}),runner:async()=>{events.push({type:'browser'});return tested()}})
 await session.test({source:source(2)});assert.deepEqual(events[0].modules,['s0','s1']);assert.equal(events[1].type,'browser')
 await session.test({source:source(2)});assert.equal(events[2].type,'candidate')
 await session.test({source:'<card><button onPress="missing">bad</button></card>'});assert.equal(events.at(-1).valid,false)
})
test('first-page readiness never completes sibling; restored drafts disable tools',()=>{
 assert.deepEqual(deckItemState({status:'generating'},{streaming:true}),{ready:false,busy:true,incomplete:false})
 assert.equal(deckItemState({status:'generating'},{streaming:false}).incomplete,true)
 assert.equal(deckItemState({status:'error',spec:{}},{streaming:true}).ready,false)
 assert.equal(deckItemState({status:'ready'},{streaming:true}).ready,true)
})
test('handler streams compiled DSL previews for both cards and records sibling errors',async()=>{
 const frames=[],res=new EventEmitter();res.writeHead=()=>{};res.flushHeaders=()=>{};res.write=x=>{const s=x.slice(6).trim();if(s!=='[DONE]')frames.push(JSON.parse(s))};res.end=()=>{res.writableEnded=true}
 const plan={cards:[{title:'一',goal:'一'},{title:'二',goal:'二'}]},records=[]
 await handleCardSpec({},res,{mode:'direct',toolsEnabled:false,debugGeneration:true,messages:[{role:'user',content:'两张卡'}]},{keyLoaded:true,model:'fixture',debugRunner:async()=>tested(),recordGeneration:async r=>records.push(r),researchSession:()=>({plan:()=>plan,lockPlan(){},snapshot:()=>({evidence:[]}),records:()=>[]}),streamUpstream:async(_m,o)=>{await o.debugSession.test({source:'<card><text>可见的调试稿</text></card>'});o.onPiece({content:'<card><text>可见的调试稿</text></card>'})}})
 assert.deepEqual([...new Set(frames.filter(f=>f.type==='debug_candidate').map(f=>f.cardIndex))],[0,1])
 const updates=frames.flatMap(f=>f.o==='patch'?f.v:[]).map(p=>p.v).filter(v=>v?.card_deck)
 assert.ok(updates.some(v=>v.card_deck[0].status==='ready'&&v.card_deck[1]?.status==='generating'&&v.card_deck[1]?.spec))
 assert.equal(updates.at(-1).card_deck[1].status,'ready');assert.equal(records[0].results.length,2)
})
