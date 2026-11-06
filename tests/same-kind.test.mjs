import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {reuseSlots,applyReuseChanges,translateReuseSteps,createSameKindService} from '../server/cardspec/same-kind.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
const context={expressionDialect:'js-v1',renderMode:'native',cardSize:'square'}
const source='<card><title>基础知识</title><data id="cards" value={[{id:"a",title:"猫",note:"观察耳朵"},{id:"b",title:"狗",note:"观察尾巴"}]}/><state id="n" type="number" initial={0}/><text>{data.cards[state.n].title}</text><button onPress="next">切换</button><action id="next"><set target="n" value={1-state.n}/></action></card>'
const steps=[{op:'click',name:'切换',expect:{changed:true,state:{n:1},text:'狗'}},{op:'reload',expect:{changed:false,state:{n:1}}}]
const evidence=steps=>({status:'tested',runs:[{scenario:'normal',width:432,initial:{errors:[]},final:{errors:[]},pageErrors:[],actions:steps.map(step=>({step,ok:true,assertion:{passed:true},errors:[],...(step.op==='reload'?{restored:true}:{})}))}]})
const runner=async(_s,{steps})=>evidence(steps)
const setup=async(extra={})=>createSameKindService({directory:await mkdtemp(path.join(os.tmpdir(),'same-kind-test-')),engineFingerprint:async()=> 'engine-1',runner,...extra})
test('editable spans exclude logic, actions, state, navigation and sandbox programs',()=>{
 const slots=reuseSlots(source);assert.equal(slots.length,2);assert.equal(slots[0].kind,'text');assert.equal(slots[1].kind,'data')
 const result=applyReuseChanges(source,[{slot:'s0',value:'太阳系'}]);assert.equal(compileCard(result.source,{final:true,context}).complete,true);assert.match(result.source,/<button onPress="next">切换<\/button>/);assert.match(result.source,/<state id="n" type="number" initial=\{0\}/)
 assert.equal(reuseSlots('<card><sandbox id="x" source="<text>secret</text>"/><logic id="l" source="return state"/></card>').length,0)
})
test('slot replacement escapes executable-looking content and rejects IDs, structure and URLs',()=>{
 const slots=reuseSlots(source),data=structuredClone(slots[1].value);data[0].title='</data><action id="evil"/>'
 const r=compileCard(applyReuseChanges(source,[{slot:'s1',value:data}]).source,{final:true,context});assert.equal(r.complete,true);assert.equal(r.spec.actions.evil,undefined)
 data[0].id='new';assert.throws(()=>applyReuseChanges(source,[{slot:'s1',value:data}]),/稳定 ID/)
 assert.throws(()=>applyReuseChanges(source,[{slot:'s1',value:[]}]),/数据结构/)
 assert.throws(()=>applyReuseChanges(source,[{slot:'unknown',value:'x'}]),/未知/)
 assert.throws(()=>applyReuseChanges(source,[{slot:'s0',value:'x'},{slot:'s0',value:'y'}]),/重复/)
})
test('test rebasing preserves state assertions and operation order',()=>{
 const rebased=translateReuseSteps(steps,new Map([['狗','火星']]));assert.equal(rebased[0].expect.text,'火星');assert.deepEqual(rebased[0].expect.state,{n:1});assert.equal(rebased[1].op,'reload');assert.equal(steps[0].expect.text,'狗')
})
test('one content call, unchanged layout and child template; no planning or tool access on model call',async()=>{
 let calls=0;const service=await setup({streamUpstream:async(messages,options)=>{calls++;assert.equal(options.research,undefined);assert.equal(options.debugSession,undefined);return JSON.stringify({compatible:true,changes:[{slot:'s0',value:'天文知识'}]})}})
 const b=await service.registerVerified({source,context,steps},new AbortController().signal)
 const r=await service.generate({baselineId:b.id,prompt:'标题改为天文知识'},new AbortController().signal)
 assert.equal(calls,1);assert.equal(r.spec.sameKind.modelCalls,1);assert.notEqual(r.spec.cardId,compileCard(source,{final:true,context}).spec.cardId)
 assert.equal((await service.load(b.id)).source,source)
 assert.equal((await service.load(r.spec.sameKind.templateId)).source,r.source)
})
test('incompatible requests, validation failures and missing proof do not publish a new card',async()=>{
 let status='tested';const service=await setup({streamUpstream:async()=>JSON.stringify({compatible:true,changes:[{slot:'s0',value:'新标题'}]}),runner:async(_s,{steps})=>({...evidence(steps),status})})
 const b=await service.registerVerified({source,context,steps});status='unverified';await assert.rejects(service.generate({baselineId:b.id,prompt:'改标题'}),/缺少/)
 await assert.rejects(service.prepare({source,spec:{context}}),/没有宿主/)
 await assert.rejects(service.registerVerified({source,context,steps:[{op:'check'}]}),/缺少/)
})
test('engine drift invalidates an old verified template',async()=>{
 let engine='first';const service=await setup({engineFingerprint:async()=>engine});const b=await service.registerVerified({source,context,steps});engine='second';await assert.rejects(service.load(b.id),e=>e.code==='REUSE_REVALIDATE')
})
test('unproven dataset snapshots cannot leak old entity data into new cards',async()=>{
 const s=await setup();await assert.rejects(s.registerVerified({source,context:{...context,datasets:{D1:{items:[]}}},steps}),/旧实体数据/)
})
test('cancelled late model response cannot publish a card',async()=>{
 const c=new AbortController(),service=await setup({streamUpstream:async()=>{c.abort();return JSON.stringify({compatible:true,changes:[{slot:'s0',value:'新'}]})}});const b=await service.registerVerified({source,context,steps});await assert.rejects(service.generate({baselineId:b.id,prompt:'改标题'},c.signal));assert.equal((await service.load(b.id)).source,source)
})

test('binding identity and code stay fixed while parameter changes use the tool service',async()=>{
 const toolSource='<card><title>News</title><binding id="feed" tool="autocli.hackernews.search" input={{query:"old",limit:3}} initial={{items:[],source:"HN",fetchedAt:""}} load="visible"/><state id="n" type="number" initial={0}/><button onPress="next">Next</button><action id="next"><increment target="n"/></action></card>'
 const toolSteps=[{op:'click',name:'Next',expect:{changed:true,state:{n:1}}},{op:'reload',expect:{changed:false,state:{n:1}}}],seen=[]
 const service=await setup({streamUpstream:async()=>JSON.stringify({compatible:true,changes:[{slot:'s1',value:{query:'new',limit:3}}]}),invoke:async payload=>{seen.push(payload);return {value:{items:[],source:'HN',fetchedAt:'2026-10-30'},cache:{status:'hit',fetchedAt:'2026-10-30T00:00:00Z'}}}})
 const b=await service.registerVerified({source:toolSource,context,steps:toolSteps});const r=await service.generate({baselineId:b.id,prompt:'query new'})
 assert.equal(seen.length,1);assert.equal(seen[0].tool,'autocli.hackernews.search');assert.deepEqual(seen[0].input,{query:'new',limit:3});assert.equal(r.spec.prefetched[0].updatedAt,'2026-10-30T00:00:00Z');assert.equal(r.spec.bindings.feed.tool,'autocli.hackernews.search')
})

test('layout-only and new feature requests explicitly fall back without an automatic second model call',async()=>{
 let calls=0;const service=await setup({streamUpstream:async()=>{calls++;return JSON.stringify({compatible:false,reason:'需要新增模拟器，请正常生成'})}});const b=await service.registerVerified({source,context,steps});await assert.rejects(service.generate({baselineId:b.id,prompt:'新增模拟器'}),/新增模拟器/);assert.equal(calls,1)
})

test('GLM always-thinking gateway uses low effort without an unsupported disable flag',async()=>{
 const {createModelClient}=await import('../server/research/model-client.mjs');let sent
 const client=createModelClient({base:'https://test.invalid',key:'test',model:'glm-5.3-flash',fetchImpl:async(_url,init)=>{sent=JSON.parse(init.body);return new Response('data: '+JSON.stringify({choices:[{delta:{content:'{}'},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n')}})
 await client([],{thinking:{type:'disabled'}});assert.equal(sent.thinking,undefined);assert.equal(sent.reasoning_effort,'low')
})
