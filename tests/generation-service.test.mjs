import test from 'node:test'
import assert from 'node:assert/strict'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {createResearchSession} from '../server/research/session.mjs'
import {generateCard} from '../server/cardspec/generation.mjs'
import {TOOLS} from '../shared/cardspec/tools.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createCardSession,newPage,seedPrefetched} from '../src/cardspec/tool-session.mjs'
import {collectionRows} from '../shared/cardspec/collection.mjs'
import {EventEmitter} from 'node:events'
import {handleCardSpec} from '../server/cardspec/handler.mjs'
import {followupEntries} from '../shared/cardspec/followups.mjs'
const id='opencli.douban.top250',catalog=[{...TOOLS[id],available:true}],signal=new AbortController().signal
const value={items:Array.from({length:20},(_,i)=>({rowKey:'r'+i,id:String(i),title:'电影'+i,rating:8})),source:'fixture',fetchedAt:'2026-10-16T00:00:00Z',truncated:false}
const source='<card><state id="n" type="number" initial={0}/><button onPress="inc">增加</button><text>{state.n}</text><action id="inc"><increment target="n"/></action></card>'

test('followup button labels stay short while the complete intent and fresh selection survive',async()=>{
 const prompt='根据当前选择给出完整规划。'+ '保留约束与确认步骤。'.repeat(10)
 const t=createGenerationTools({})
 await t.execute('plan_cards',{cards:[{title:'选择',goal:'选择后规划'}],followups:[{label:'规划我的选择',prompt}]},signal)
 assert.deepEqual(followupEntries(t.plan()),[{label:'规划我的选择',prompt}])
 const old=followupEntries({followups:['很长的旧版本规划意图'.repeat(8)]})[0]
 assert.equal(Array.from(old.label).length,24);assert.equal(old.prompt,'很长的旧版本规划意图'.repeat(8))
 const spec=compileCard('<intro>当前选择页</intro>'+source,{final:true,cardId:'short-label'}).spec;spec.generationPlan=t.plan();let request
 const session=createCardSession(spec,{transport:async p=>{request=p;return {kind:'page',spec:compileCard('<card><text>已规划</text></card>',{final:true,cardId:'followed'}).spec}}})
 session.setActivity({complete:true,visible:true});session.fire('inc')
 await session.followup('规划我的选择');assert.equal(request,undefined,'label is not the authorized prompt')
 await session.followup(prompt);assert.equal(request.input.prompt,prompt);assert.equal(request.input.context.state.n,1);assert.equal(session.pages.length,2)
 assert.equal(request.view.summary,'当前选择页')
 assert.equal(request.view.taskPhase,'result')
 session.navigate(-1);assert.equal(session.current().store.values.n,1);session.dispose()
})

test('next-page and slot generation are scoped to the current request, not the original multi-step imperative',async()=>{
 for(const target of ['page','slot:result']){
  let messages
  const result=await generateCard({target,input:{prompt:'Explain the selected result',context:{selection:{id:'a',name:'Selected A'}}},view:{goal:'ORIGINAL_TASK: ask the user to choose then call a model to explain',summary:'The previous page selected A',generationMode:'direct'},signal,streamUpstream:async(m,o)=>{messages=m;o.onPiece({content:'<card><text>Selected A explanation</text></card>'})}})
  assert.equal(result.spec.context.userGoal,'Explain the selected result')
  assert.equal(result.spec.context.input.selection.name,'Selected A')
  assert.ok(!messages.some(m=>String(m.content).includes('ORIGINAL_TASK')))
  assert.equal(JSON.parse(messages.find(m=>m.role==='user').content).pageView.summary,'The previous page selected A')
  assert.equal(result.repairCount,0)
 }
})

test('explicit generated page and slot actions deliver the requested result, while JSON bindings retain their schema contract',async()=>{
 for(const target of ['page','slot:answer','binding']){
  const schema=target==='binding'?',schema:{type:"object",properties:{answer:{type:"string"}},required:["answer"]}':''
  const compiled=compileCard(`<intro>Parent selection</intro><card><binding id="answer" tool="glm.generate" input={{prompt:"Explain this choice",context:{choice:"A"}${schema}}}/><slot id="answer"><text>Original</text></slot><button onPress="explain">Explain</button><action id="explain"><invoke binding="answer" target="${target}"/></action></card>`,{final:true,cardId:'delivery-'+target})
  assert.equal(compiled.complete,true,JSON.stringify(compiled.diagnostics))
  let payload,messages
  const s=createCardSession(compiled.spec,{transport:async(p,signal)=>{
   payload=p
   return generateCard({input:p.input,target:p.target,view:p.view,signal,streamUpstream:async(m,o)=>{messages=m;o.onPiece({content:target==='binding'?'{"answer":"A explanation"}':'<card><text>A explanation</text></card>'})}})
  }})
  s.setActivity({complete:true,visible:true})
  await s.invoke({binding:'answer',target})
  assert.equal(payload.view.taskPhase,target==='binding'?undefined:'result')
  assert.equal(messages.some(m=>m.content.includes('首屏即预览结果')),target!=='binding')
  if(target==='page')assert.equal(s.pages.length,2)
  else if(target==='slot:answer')assert.ok(s.current().slots.answer)
  else assert.deepEqual(s.current().bindings.answer.value,{answer:'A explanation'})
  s.dispose()
 }
})
test('generation reads only catalogued available readonly tools, caches parameter order, stores full rows separately',async()=>{
 let calls=0;const t=createGenerationTools({catalog,invoke:async()=>{calls++;return {kind:'json',value}}})
 await assert.rejects(t.execute('cli_read',{id:'glm.generate',input:{prompt:'recursive'}},signal),/不允许/)
 await assert.rejects(t.execute('cli_read',{id:'unknown',input:{}},signal),/不允许/)
 const a=await t.execute('cli_read',{id,input:{limit:20}},signal);await t.execute('cli_read',{id,input:{limit:20}},signal)
 assert.equal(calls,1);assert.equal(a.items.length,4);assert.equal(a.totalObserved,20);assert.equal(t.datasets().D1.items.length,20)
 assert.equal((await t.execute('dataset_read',{dataset:'D1',offset:16,limit:4},signal)).items[0].rowKey,'r16')
})
test('writes and disabled capabilities cannot be reached by a generated tool call',async()=>{
 let calls=0;const t=createGenerationTools({catalog:[{id:'fake.write',readOnly:false,available:true}],invoke:async()=>calls++})
 await assert.rejects(t.execute('cli_read',{id:'fake.write',input:{}},signal));assert.equal(calls,0)
 const disabled=createGenerationTools({catalog,enabled:false,invoke:async()=>calls++});await assert.rejects(disabled.execute('cli_read',{id,input:{}},signal));assert.equal(calls,0)
})
test('failed tool executions remain explicit across repairs instead of becoming empty datasets',async()=>{
 const extensions=createGenerationTools({catalog,invoke:async()=>{throw Error('source unavailable')}}),research=createResearchSession({extensions});let n=0,history
 await research.run(async messages=>{history=messages;return {message:++n===1?{role:'assistant',tool_calls:[{id:'x',function:{name:'cli_read',arguments:JSON.stringify({id,input:{limit:6}})}}]}:{content:source}}},[],{signal})
 assert.equal(JSON.parse(history.find(m=>m.role==='tool').content).dataAvailable,false)
 await research.run(async messages=>{history=messages;return {message:{content:source}}},[],{signal})
 assert.ok(history.some(m=>m.content?.includes('失败不等于空结果')));assert.deepEqual(research.datasets(),{})
})
test('card manifest is bounded and locked against recursive sibling planning',async()=>{
 const t=createGenerationTools({});await t.execute('plan_cards',{cards:[{title:'概览',goal:'展示范围'},{title:'比较',goal:'比较候选'}],followups:['按当前选择深入']},signal)
 assert.equal(t.plan().cards.length,2);t.lockPlan();await assert.rejects(t.execute('plan_cards',{cards:[],followups:[]},signal),/已经提交/)
})
test('unified generation consumes real prefetch before compiling context references',async()=>{
 let round=0;const extensions=createGenerationTools({catalog,invoke:async()=>({kind:'json',value})}),research=createResearchSession({extensions,maxCalls:10})
 const result=await generateCard({catalog,research,photo:async()=>null,signal,input:{prompt:'电影候选'},streamUpstream:async(messages,options)=>research.run(async()=>{
  if(round++===0)return {message:{role:'assistant',content:'',tool_calls:[{id:'q',type:'function',function:{name:'cli_read',arguments:JSON.stringify({id,input:{limit:20}})}}]}}
  return {message:{content:'<card><collection label="电影" items={context.datasets.D1.items}/></card>'}}
 },messages,options)})
 assert.equal(result.spec.context.datasets.D1.items.length,20);assert.equal(result.spec.prefetched.length,1);assert.equal(result.repairCount,0)
})
test('prefetched binding avoids duplicate load, while changed parameters reload',async()=>{
 const raw=`<card><state id="limit" type="number" initial={20}/><binding id="movies" tool="${id}" load="visible" input={{limit:state.limit}} initial={{items:[],source:"",fetchedAt:"",truncated:false}}/><collection items={bindings.movies.value.items}/><action id="change"><set target="limit" value={10}/></action></card>`
 const spec=compileCard(raw,{final:true,cardId:'root'}).spec;spec.prefetched=[{tool:id,input:{limit:20},value,updatedAt:new Date().toISOString()}]
 let calls=0;const s=createCardSession(spec,{transport:async()=>{calls++;return {kind:'json',value}}});s.setActivity({complete:true,visible:true});s.tick();assert.equal(calls,0)
 s.fire('change');s.tick();await new Promise(r=>setImmediate(r));assert.equal(calls,1);s.dispose()
})
test('collection filtering preserves original rows and selection identifiers',()=>{
 const rows=collectionRows(value.items,{query:'电影19'},null);assert.equal(rows.length,1);assert.equal(rows[0],value.items[19]);assert.equal(value.items.length,20)
 const bad=compileCard('<card><collection items={[{id:"x"},{id:"x"}]}/></card>',{final:true});assert.equal(bad.complete,false)
})
test('followup uses fresh state, dedupes clicks, restores parent, and rejects stale generation',async()=>{
 const spec=compileCard(source,{final:true,cardId:'root'}).spec;spec.generationPlan={followups:['解释选择']};let resolve,calls=0
 const s=createCardSession(spec,{transport:()=>{calls++;return new Promise(r=>resolve=r)}});s.setActivity({complete:true,visible:true})
 const pending=s.followup('解释选择');s.followup('解释选择');s.fire('inc');resolve({kind:'page',spec:compileCard(source,{final:true,cardId:'next'}).spec});await pending
 assert.equal(calls,1);assert.equal(s.pages.length,1);assert.match(s.current().error,/输入已改变/)
 const next=s.followup('解释选择');resolve({kind:'page',spec:compileCard(source,{final:true,cardId:'next'}).spec});await next;assert.equal(s.pages.length,2);s.navigate(-1);assert.equal(s.current().store.values.n,1);s.dispose()
})
test('followup includes host collection selection and rejects changed selection but ignores scroll',async()=>{
 const spec=compileCard(source,{final:true,cardId:'selection-root'}).spec;spec.generationPlan={followups:['解释选择']};let resolve,input
 const s=createCardSession(spec,{transport:p=>{input=p.input;return new Promise(r=>resolve=r)}});s.setActivity({complete:true,visible:true})
 s.current().viewState.components={c:{collection:{selected:'a',selectedItem:{id:'a',title:'A'}}}}
 const first=s.followup('解释选择');assert.equal(input.context.selections[0].item.title,'A')
 s.current().viewState.components.c.collection.selected='b';resolve({kind:'page',spec:compileCard(source,{final:true,cardId:'n'}).spec});await first
 assert.equal(s.pages.length,1)
 const second=s.followup('解释选择');s.current().viewState.scrollTop=100;resolve({kind:'page',spec:compileCard(source,{final:true,cardId:'n'}).spec});await second
 assert.equal(s.pages.length,2);s.dispose()
})
test('sibling repair failure does not discard first card or prevent later sibling',async()=>{
 const frames=[],res=new EventEmitter();Object.assign(res,{writeHead(){},flushHeaders(){},end(){this.writableEnded=true},write(s){const v=s.slice(6).trim();if(v!=='[DONE]')frames.push(JSON.parse(v))}})
 let calls=0,locked=false;const plan={cards:[{title:'首卡',goal:'one'},{title:'失败卡',goal:'two'},{title:'第三卡',goal:'three'}],followups:['深入']}
 const research={plan:()=>plan,lockPlan:()=>locked=true,snapshot:()=>({evidence:[],modelCalls:calls}),datasets:()=>({}),records:()=>[]}
 await handleCardSpec({},res,{mode:'direct',messages:[{role:'user',content:'三张卡'}]},{keyLoaded:true,model:'test',researchSession:()=>research,photo:async()=>null,streamUpstream:async(_m,o)=>{calls++;o.onPiece({content:calls===2||calls===3?'<card><invalid/></card>':source})}})
 const deck=frames.flatMap(f=>f.v||[]).findLast(p=>p.v?.card_deck)?.v.card_deck
 assert.equal(locked,true);assert.deepEqual(deck.map(c=>c.status),['ready','error','ready']);assert.equal(calls,4)
 assert.equal(frames.findLast(f=>f.type==='message_stream_complete').status,'succeeded')
})
