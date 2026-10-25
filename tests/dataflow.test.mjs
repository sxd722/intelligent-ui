import {test} from 'node:test'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createCardSession} from '../src/cardspec/tool-session.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
import {validateToolInput} from '../shared/cardspec/tools.mjs'
import {parseExpression as expr} from '../shared/cardspec/expression.mjs'
import {interactionDiagnostics} from '../shared/cardspec/interaction-diagnostics.mjs'
import {evidenceRequests,boundedEvidence} from '../shared/cardspec/tool-evidence.mjs'
const result={items:[],source:'controlled QA',fetchedAt:'2026-10-15T00:00:00Z',truncated:false}
const source=`<card actionMode="snapshot"><state id="q" type="string" initial="A"/><state id="note" type="string" initial=""/>
<binding id="lookup" tool="opencli.douban.search" input={{keyword:state.q}} initial={{items:[],source:"",fetchedAt:"",truncated:false}}/>
<binding id="gen" tool="glm.generate" requires="lookup" input={{prompt:"Explain supplied data",context:{result:bindings.lookup.value}}}/>
<text>Ready</text><action id="query"><set target="q" value={event.value}/></action><action id="note"><set target="note" value={event.value}/></action></card>`
function compiled(text=source){const r=compileCard(text,{final:true,cardId:'qa'});assert.equal(r.complete,true,JSON.stringify(r.diagnostics));return r.spec}
function session(transport){const s=createCardSession(compiled(),{transport});s.setActivity({complete:true});return s}
const page=()=>compiled('<card><text>Generated</text></card>')
test('requires rejects unknown and cyclic dependencies; expression aliases infer dependencies',()=>{
 assert.equal(compileCard(source.replace('requires="lookup"','requires="missing"'),{final:true}).complete,false)
 assert.equal(compileCard(source.replace('tool="opencli.douban.search"','tool="opencli.douban.search" requires="gen"'),{final:true}).complete,false)
 compiled(source.replace('requires="lookup"','').replace('context:{result:bindings.lookup.value}','context:{result:derived.rows}').replace('<text>','<derive id="rows" value={bindings.lookup.value.items}/><text>'))
})
test('missing, loading, failed and stale dependencies block generation without network calls',async()=>{
 let calls=0,resolve,fail=false
 const s=session(async p=>{calls++;if(fail)throw Error('offline');return new Promise(r=>{resolve=r})})
 await s.invoke({binding:'gen',target:'page'});assert.equal(calls,0);assert.equal(s.current().bindings.gen.errorInfo.code,'DEPENDENCY_NOT_READY')
 const pending=s.invoke({binding:'lookup'});await s.invoke({binding:'gen',target:'page'});assert.equal(calls,1)
 resolve({kind:'json',value:result});await pending
 s.fire('query',{event:{value:'B'}});await s.invoke({binding:'gen',target:'page'});assert.equal(calls,1)
 fail=true;await s.invoke({binding:'lookup'});await s.invoke({binding:'gen',target:'page'});assert.equal(calls,2);assert.deepEqual(s.current().bindings.lookup.value,result);s.dispose()
})
test('dependency versions prevent late replacement; unrelated form edits preserve generation',async()=>{
 let resolve;const s=session(async p=>p.tool==='glm.generate'?new Promise(r=>{resolve=r}):{kind:'json',value:result})
 await s.invoke({binding:'lookup'});let pending=s.invoke({binding:'gen',target:'page'})
 await s.invoke({binding:'lookup'});resolve({kind:'page',spec:page()});await pending;assert.equal(s.pages.length,1)
 pending=s.invoke({binding:'gen',target:'page'});s.fire('note',{event:{value:'keep me'}});resolve({kind:'page',spec:page()});await pending
 assert.equal(s.pages.length,2);s.navigate(-1);assert.equal(s.current().store.values.note,'keep me');s.dispose()
})
test('auto dependencies wait without fetching GLM; response callback starts a fresh transaction',async()=>{
 const sp=compiled(source.replace('initial={{items:[],source:"",fetchedAt:"",truncated:false}}/>','load="visible" initial={{items:[],source:"",fetchedAt:"",truncated:false}}/>'))
 sp.actions.received=[{type:'set',target:'note',value:expr('state.note+"!"')},{type:'invoke',binding:'gen',target:'page'}]
 let resolve;const calls=[];const s=createCardSession(sp,{transport:async p=>{calls.push(p.tool);return p.tool==='glm.generate'?{kind:'page',spec:page()}:new Promise(r=>{resolve=r})}});s.setActivity({complete:true})
 const pending=s.invoke({binding:'lookup',onSuccess:'received'});s.fire('note',{event:{value:'latest'}});resolve({kind:'json',value:result});await pending;await new Promise(r=>setTimeout(r,0))
 assert.deepEqual(calls,['opencli.douban.search','glm.generate']);s.navigate(-1);assert.equal(s.current().store.values.note,'latest!');s.dispose()
})
test('business IDs reject reserved UI identity for different tools, but preserve original IDs',()=>{
 for(const [tool,key] of [['opencli.douban.subject','id'],['opencli.dongchedi.series','series_id']]){
  assert.throws(()=>validateToolInput(tool,{[key]:'row:abc'}),/rowKey/)
  assert.doesNotThrow(()=>validateToolInput(tool,{[key]:'12345'}))
 }
})
test('snapshot owns nested args; failed transactions discard both state and effects',()=>{
 const sp=compiled('<card actionMode="snapshot"><state id="saved" type="record" initial={{}}/><text>Ready</text><action id="save"><set target="saved" value={args}/></action></card>')
 const store=createStore();makeScope(sp,store);const args={rows:[{qty:2}]};executeAction(sp,store,'save',{args});args.rows[0].qty=9;assert.equal(store.values.saved.rows[0].qty,2)
})
test('saved rows after reset reject live reads; materialized ledger works for quote and inventory',()=>{
 for(const name of ['quote','inventory']){
  const bad=`<card actionMode="snapshot"><data id="rows" value={[{id:"a",price:3}]}/><state id="counts" type="record" initial={{a:2}}/><state id="${name}" type="array" initial={[]}/><each items={state.${name}} itemKey={item.id}><text>{state.counts[item.id]}</text></each><action id="save"><set target="${name}" value={filter(data.rows,state.counts[item.id]>0)}/><set target="counts" value={{}}/></action></card>`
  assert.ok(compileCard(bad,{final:true}).diagnostics.some(d=>d.code==='snapshot_live_read'))
  const good=compiled(bad.replace('{state.counts[item.id]}</text>','{item.qty}</text>').replace('filter(data.rows,state.counts[item.id]>0)','map(data.rows,{id:item.id,qty:state.counts[item.id],subtotal:item.price*state.counts[item.id]})'))
  const st=createStore();makeScope(good,st);executeAction(good,st,'save');st.values.counts={a:7};assert.deepEqual(st.values[name],[{id:'a',qty:2,subtotal:6}])
 }
})
test('sequential writes and snapshot next semantics stay distinct; stale invoke gets repair diagnostic',()=>{
 const bad=source.replace('</card>','<action id="search"><set target="q" value="B"/><invoke binding="lookup"/></action></card>')
 assert.ok(compileCard(bad,{final:true}).diagnostics.some(d=>d.code==='action_stale_input'))
 const sp=compiled(bad.replace('<invoke binding="lookup"/>','<invoke binding="lookup" input={{keyword:next.q}}/>')),st=createStore(),effects=[]
 makeScope(sp,st);executeAction(sp,st,'search',{effects});assert.equal(effects[0].input.keyword,'B')
})
test('table scalar projections fail even with empty rows',()=>{
 const sp=compiled('<card><state id="picks" type="array" initial={[]}/><text>Ready</text></card>')
 sp.children=[{id:'table',type:'table',props:{rows:expr('map(state.picks,item.id)')}}]
 assert.ok(interactionDiagnostics(sp).some(d=>d.code==='collection_shape'))
})
test('visible dependent reads wait and refresh on dependency version changes without polling GLM',async()=>{
 const sp=compiled(source.replace('<text>','<binding id="dependent" tool="autocli.hackernews.top" requires="lookup" load="visible" input={{limit:1}} initial={{items:[],source:"",fetchedAt:""}}/><text>'))
 const calls=[];const s=createCardSession(sp,{transport:async p=>{calls.push(p.tool);return {kind:'json',value:p.tool.startsWith('opencli.')?result:{items:[],source:'QA',fetchedAt:result.fetchedAt}}}})
 s.setActivity({complete:true,visible:true});assert.deepEqual(calls,[])
 await s.invoke({binding:'lookup'});s.tick();await new Promise(r=>setTimeout(r,0));assert.equal(calls.length,2)
 s.tick();assert.equal(calls.length,2)
 await s.invoke({binding:'lookup'});s.tick();await new Promise(r=>setTimeout(r,0));assert.equal(calls.length,4);assert.ok(!calls.includes('glm.generate'));s.dispose()
})
const entitySource=source.replace('context:{result:bindings.lookup.value}','context:{entity:state.selected}').replace('<text>','<state id="selected" type="record" initial={{}}/><each items={bindings.lookup.value.items} as="entry" itemKey={entry.rowKey}><button onPress="select" args={entry} label={entry.title}/></each><action id="select"><set target="selected" value={args}/></action><text>')
test('selected entities retain identity through explicit input overrides and infer dependency',()=>{
 const good=compiled(entitySource.replace(' requires="lookup"',''));assert.deepEqual(good.bindings.gen.requires,['lookup'])
 const lost=entitySource.replace('context:{entity:state.selected}','context:{title:state.selected.title}')
 assert.ok(compileCard(lost,{final:true}).diagnostics.some(d=>d.code==='tool_context_identity'))
})
test('evidence resolution uses business identity for different domains and never guesses from title',()=>{
 const spec={bindings:{cars:{tool:'opencli.dongchedi.search'},movies:{tool:'opencli.douban.search'}}},bindings={cars:{status:'success',value:{items:[{rowKey:'row:c',series_id:'88',name:'Car'}]}},movies:{status:'success',value:{items:[{rowKey:'row:m',id:'99',type:'movie',title:'Film'}]}}}
 assert.equal(evidenceRequests({entity:{rowKey:'row:c',series_id:'88'}},spec,bindings)[0].tool,'opencli.dongchedi.series')
 assert.deepEqual(evidenceRequests({entity:{id:'99',type:'movie'}},spec,bindings)[0].input,{id:'99',type:'movie'})
 assert.equal(evidenceRequests({title:'Film'},spec,bindings).length,0)
 const bounded=boundedEvidence('qa',{...result,items:[{summary:'X'.repeat(10000)}]});assert.equal(bounded.truncated,true);assert.equal(bounded.items[0].summary.length,3000)
})
test('GLM waits for host facts, details failure preserves page, and late facts never call GLM',async()=>{
 const selected={rowKey:'row:m',id:'99',type:'movie',title:'Film'},list={...result,items:[selected]};let fail=false,delay=false,resolve;const calls=[]
 const s=createCardSession(compiled(entitySource),{transport:async p=>{
  calls.push(p)
  if(p.tool==='opencli.douban.search')return {kind:'json',value:list}
  if(p.tool==='opencli.douban.subject'){assert.equal(p.input.id,'99');if(fail)throw Error('offline');if(delay)return new Promise(r=>{resolve=r});return {kind:'json',value:{...result,items:[{id:'99',summary:'Observed facts'}]}}}
  assert.equal(p.input.context.toolEvidence[0].items[0].summary,'Observed facts');return {kind:'page',spec:page()}
 }});s.setActivity({complete:true});await s.invoke({binding:'lookup'});s.fire('select',{args:selected})
 fail=true;await s.invoke({binding:'gen',target:'page'});assert.equal(s.pages.length,1);assert.equal(calls.filter(p=>p.tool==='glm.generate').length,0)
 fail=false;delay=true;const pending=s.invoke({binding:'gen',target:'page'});s.fire('select',{args:{...selected,id:'different'}});resolve({kind:'json',value:result});await pending;assert.equal(calls.filter(p=>p.tool==='glm.generate').length,0)
 delay=false;s.fire('select',{args:selected});await s.invoke({binding:'gen',target:'page'});assert.equal(s.pages.length,2);assert.equal(calls.filter(p=>p.tool==='glm.generate').length,1);s.dispose()
})
test('submit-and-clear sends entry snapshot, accepts response and retries the same payload',async()=>{
 const text='<card actionMode="snapshot"><state id="draft" type="string" initial="original"/><binding id="gen" tool="glm.generate" input={{prompt:state.draft}}/><text>Ready</text><action id="submit"><invoke binding="gen" target="page"/><set target="draft" value=""/></action></card>'
 const requests=[];let fail=true
 const s=createCardSession(compiled(text),{transport:async p=>{requests.push(p);if(fail)throw Error('offline');return {kind:'page',spec:page()}}});s.setActivity({complete:true})
 s.fire('submit');await new Promise(r=>setTimeout(r,0));assert.equal(s.current().store.values.draft,'');assert.equal(s.current().bindings.gen.status,'error')
 fail=false;await s.retry('gen');assert.equal(s.pages.length,2);assert.deepEqual(requests.map(p=>p.input.prompt),['original','original']);s.dispose()
})
