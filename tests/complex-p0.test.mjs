import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createCardSession} from '../src/cardspec/tool-session.mjs'
import {TOOLS,validateToolInput} from '../shared/cardspec/tools.mjs'
import {normalizeIdentifierSchema} from '../shared/cardspec/input-contract.mjs'
import {contentIntegrity,auditClassification,auditResultSensitivity} from '../shared/cardspec/content-integrity.mjs'
import {assertSnapshot} from '../shared/cardspec/debug-assertions.mjs'
import {composeTask} from '../shared/cardspec/task-composition.mjs'
const compile=s=>{const r=compileCard(s,{final:true,context:{expressionDialect:'js-v1'}});assert.ok(r.complete,JSON.stringify(r.diagnostics));return r.spec}
const sleep=()=>new Promise(r=>setTimeout(r,10))

test('collapsed detail consumer waits for the host opening signal',async()=>{
 const spec=compile('<card><region id="detail" overflow="details" label="详情"><tool-view tool="opencli.bilibili.search" input={{query:"结构"}}/></region></card>')
 let calls=0;const s=createCardSession(spec,{transport:async()=>{calls++;return {kind:'json',value:{items:[],source:'test',fetchedAt:new Date().toISOString(),truncated:false}}}})
 s.setActivity({visible:true,complete:true});await sleep();assert.equal(calls,0);s.setRegionVisibility('detail',true);await sleep();assert.equal(calls,1);s.dispose()
})

test('non-unique producer IDs do not merge different entities or become detail IDs',()=>{
 const v=composeTask({main:{tool:'opencli.ctrip.search',status:'success',value:{items:[{id:0,name:'地点甲',lat:30,lon:120},{id:0,name:'地点乙',lat:31,lon:121}]}}})
 assert.equal(v.items.length,2);assert.notEqual(v.items[0].id,v.items[1].id);assert.ok(v.items.every(i=>i.entityId===null));assert.ok(v.issues.some(i=>i.code==='AMBIGUOUS_ENTITY_ID'))
})

test('plain presses distinguish explicit args from component event payloads',()=>{
 const s=compile('<card><state id="x" type="string" initial=""/><if test={false}><button args="a" onPress="pick">选择</button></if><action id="pick"><set target="x" value={event.value}/></action></card>')
 assert.ok(contentIntegrity(s).some(d=>d.code==='evidence_click_payload'))
 const good=compile('<card><state id="x" type="string" initial=""/><button args="a" onPress="pick">选择</button><action id="pick"><set target="x" value={args}/></action></card>');assert.equal(contentIntegrity(good).length,0)
})

test('planning settings must affect decisions, not just interpolated prose',()=>{
 const source=value=>`<card><state id="budget" type="number" initial={100}/><state id="plan" type="string" initial=""/><input label="预算" inputType="number" value={state.budget}/><button onPress="go">生成方案</button><text>{state.plan}</text><action id="go"><set target="plan" value={${value}}/></action></card>`
 assert.ok(contentIntegrity(compile(source('"预算"+state.budget'))).some(d=>d.code==='evidence_constraint_unused'))
 assert.ok(!contentIntegrity(compile(source('state.budget<200?"步行路线":"公共交通路线"'))).some(d=>d.code==='evidence_constraint_unused'))
})

test('behavior evidence excludes cosmetic feedback and requires a fresh tool call',()=>{
 const before={state:{result:1,msg:''},calls:[]},after={state:{result:1,msg:'done'},calls:[]}
 assert.equal(assertSnapshot({changedKeys:['result']},before,after).passed,false)
 assert.equal(assertSnapshot({tool:'opencli.wttr.forecast'},before,after).passed,false)
 assert.equal(assertSnapshot({changedKeys:['result'],tool:'opencli.wttr.forecast'},before,{state:{result:2},calls:[{tool:'opencli.wttr.forecast'}]}).passed,true)
})
test('URL-carrying identifiers preserve real producer values; bounded size remains',()=>{
 const value='https://www.xiaohongshu.com/explore/64b000000000000000000001?xsec_token='+'a'.repeat(180)+'&xsec_source=pc_search'
 assert.doesNotThrow(()=>validateToolInput('opencli.xiaohongshu.note',{noteId:value}))
 assert.throws(()=>validateToolInput('opencli.xiaohongshu.note',{noteId:'x'.repeat(8193)}))
 assert.equal(normalizeIdentifierSchema({type:'string',description:'Full URL with signature'}).maxLength,8192)
 assert.equal(normalizeIdentifierSchema({type:'string',description:'Numeric ID'}).maxLength,128)
 // Historical real search output contract, never execute a browser or expose tokens.
 const file='artifacts/complex-live-cuj-20261103/sentiment.json'
 if(fs.existsSync(file)){const d=JSON.parse(fs.readFileSync(file));const matches=JSON.stringify(d).match(/https:\/\/(?:www\.)?xiaohongshu\.com\/[^"\\\s]+/g)||[];assert.ok(matches.length);for(const noteId of matches)assert.doesNotThrow(()=>validateToolInput('opencli.xiaohongshu.note',{noteId}))}
})
test('hidden/empty consumer never dispatches; shows only after valid input, then cancels hidden request',async()=>{
 const spec=compile('<card><state id="show" type="boolean" initial={false}/><state id="q" type="string" initial=""/><if test={state.show}><tool-view tool="opencli.bilibili.search" input={{query:state.q}}/></if><button onPress="show">打开</button><action id="show"><set target="show" value={true}/></action><action id="query"><set target="q" value="自行车"/></action><action id="hide"><set target="show" value={false}/></action></card>')
 let calls=0,aborted=false
 const s=createCardSession(spec,{transport:async(p,signal)=>{calls++;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(Error('cancelled'))}))}})
 s.setActivity({visible:true,complete:true});assert.equal(calls,0)
 s.fire('show');s.tick();assert.equal(calls,0);assert.equal(s.current().error,'')
 s.fire('query');s.tick();await sleep();assert.equal(calls,1)
 s.fire('hide');s.tick();await sleep();assert.equal(aborted,true);s.dispose()
})
test('visible ordinary bindings still load; user invalid invocation reports error',async()=>{
 const spec=compile('<card><binding id="b" tool="opencli.bilibili.search" input={{query:"地图"}} load="visible"/><tool-view binding="b"/></card>')
 let calls=0;const s=createCardSession(spec,{transport:async()=>{calls++;return {kind:'json',value:{items:[],source:'test',fetchedAt:new Date().toISOString(),truncated:false}}}})
 s.setActivity({visible:true,complete:true});await sleep();assert.equal(calls,1);await s.invoke({binding:'b',input:{query:''}});assert.equal(calls,1);assert.match(s.current().error,/length/);s.dispose()
})
test('missing classification field and fake refresh are detected without effects',()=>{
 const spec=compile('<card><data id="rows" value={[{id:"a",text:"内容"}]}/><derive id="n" value={data.rows.filter(r=>r.stance=="positive").length}/><state id="msg" type="string" initial=""/><text>{derived.n}</text><button onPress="refresh">刷新</button><action id="refresh"><set target="msg" value="已刷新"/></action></card>')
 const d=contentIntegrity(spec,{goal:'真实舆情工具刷新'});assert.ok(d.some(x=>x.code==='evidence_missing_category'));assert.ok(d.some(x=>x.code==='evidence_fake_refresh'))
 const good=compile('<card><data id="rows" value={[{id:"a"}]}/><derive id="n" value={data.rows.filter(r=>r.stance==null).length}/><text>{derived.n}</text></card>');assert.equal(contentIntegrity(good).length,0)
})
test('publication date cannot be invented for an exact retrieved title',()=>{
 const s=compile('<card><data id="rows" value={[{title:"消息A",date:"2026-11-02"}]}/><text>时间线</text></card>')
 assert.ok(contentIntegrity(s,{records:[{value:{items:[{title:'消息A'}]}}]}).some(d=>d.code==='evidence_date_unproven'))
 assert.equal(contentIntegrity(s,{records:[{value:{items:[{title:'消息A',date:'2026-11-02'}]}}]}).length,0)
})
test('classification requires body provenance, target and conserved counts',()=>{
 const row={id:'a',stance:'negative',target:'vehicle',evidence:{text:'正文',source:'source-url'}}
 const input={samples:[row],analyzedIds:['a'],tally:{positive:0,negative:1,neutral:0,uncertain:0}}
 assert.equal(auditClassification(input).status,'passed');assert.equal(auditClassification({...input,samples:[{...row,evidence:null}]}).status,'failed')
 assert.equal(auditClassification({...input,tally:{}}).status,'failed')
 assert.equal(auditResultSensitivity({beforeInput:1,afterInput:2,beforeResult:'固定',afterResult:'固定'}).status,'unverified')
})
