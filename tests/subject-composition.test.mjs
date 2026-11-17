import test from 'node:test'
import assert from 'node:assert/strict'
import {collectImages} from '../shared/cardspec/images.mjs'
import {composeTask} from '../shared/cardspec/task-composition.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createStore,makeScope} from '../shared/cardspec/store.mjs'
import {activeBindings} from '../shared/cardspec/binding-schedule.mjs'
import {createCardSession} from '../src/cardspec/tool-session.mjs'
import {projectDecisionActions} from '../shared/cardspec/decision-profile.mjs'
const rec=(tool,items,input={})=>({tool,input,status:'success',value:{items,source:tool,fetchedAt:'2026-11-13T00:00:00Z',truncated:false},updatedAt:'2026-11-13T00:00:00Z'})
const train={code:'G1',train_no:'real-internal-id',from_station:'北京南',to_station:'上海虹桥',start_time:'06:30',arrive_time:'11:24',duration:'04:54',second_seat:'有'}
const rail=()=>rec('opencli.12306.trains',[train],{from:'北京南',to:'上海虹桥',date:'2026-11-14'})
const weather=()=>rec('opencli.wttr.current',[{location:'上海',description:'多云',tempC:0,feelsLikeC:null}],{location:'上海'})
test('current object combines reviewed route slots, weather and media without inventing joins',()=>{
 const v=composeTask({车次:'r',天气:'w'},{subject:{id:'sh',title:'上海'},media:[{query:'train',alt:'列车示意'}]},{r:rail(),w:weather()})
 assert.equal(v.subject.id,'sh');assert.equal(v.roles.车次[0].raw.train_no,train.train_no)
 assert.equal(v.roles.车次[0].provenance[0].binding,'r');assert.equal(v.roles.天气[0].slots.find(x=>x.key==='tempC').value,0)
 assert.equal(v.media[0].kind,'illustration');assert.equal(v.related.length,0);assert.equal(v.items.length,1)
 assert.equal(composeTask({a:rail(),b:rail()}).counts.duplicates,1)
})
test('one failed or stale source never revives unrelated results or hides successful roles',()=>{
 const v=composeTask({r:rail(),w:{...weather(),status:'error',error:'offline',current:false}},{subject:{id:'bj',title:'北京'}})
 assert.equal(v.roles.w.length,0);assert.equal(v.roles.r.length,1);assert.ok(v.issues.some(i=>i.code==='SOURCE_ERROR'))
 assert.throws(()=>composeTask({}, {subject:{title:'missing id'}}),/stable id/)
 for(const media of [[{query:'train',assetRef:'asset.v1.a.b'}],[{url:'https://example.org/a.png'}],[{assetRef:'bad'}]])assert.throws(()=>composeTask({}, {media}),/COMPOSITION/)
 const view=composeTask({f:rec('opencli.douban.top250',[{id:'m',title:'电影',assetRef:'asset.v1.a.b'}])},{subject:{id:'m',title:'电影'}})
 assert.equal(view.media[0].kind,'source-image');assert.equal(view.media[0].alt,'电影')
})
const source='<card><state id="city" type="string" initial="上海"/><binding id="r" tool="opencli.12306.trains" input={{from:"北京南",to:state.city,date:"2026-11-14"}} initial={{items:[],source:"",fetchedAt:"",truncated:false}} load="visible"/><binding id="w" tool="opencli.wttr.current" input={{location:state.city}} initial={{items:[],source:"",fetchedAt:"",truncated:false}} load="visible"/><derive id="view" value={compose({"车次":"r","天气":"w"},{subject:{id:state.city,title:state.city}})}/><region id="details" overflow="destination" label="资料"><task-board view={derived.view}/></region><action id="change"><set target="city" value="杭州"/></action></card>'
const compile=dialect=>{const c=compileCard(source,{final:true,context:{expressionDialect:dialect}});assert.ok(c.complete,JSON.stringify(c.diagnostics));return c.spec}
test('named compose bindings obey actual destination visibility in both dialects',()=>{
 for(const dialect of ['legacy','js-v1']){const spec=compile(dialect),scope=makeScope(spec,createStore());assert.equal(activeBindings(spec,scope,{}).size,0);assert.deepEqual([...activeBindings(spec,scope,{details:true,$destination:'details'})].sort(),['r','w'])}
})
test('selection fans out to two tools; stale requests cannot repaint a new object; restore retains selection',async()=>{
 const saved=new Map(),storage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};const calls=[],spec=compile('js-v1'),session=createCardSession(spec,{storage,persistenceKey:"subject-test",transport:(payload,signal)=>new Promise(resolve=>calls.push({payload,signal,resolve}))});const wait=()=>new Promise(r=>setTimeout(r,15))
 try{session.setActivity({visible:true,complete:true});await wait();assert.equal(calls.length,0)
 session.setRegionVisibility('details',true);session.setRegionVisibility('$destination','details');await wait();assert.equal(calls.length,2)
 session.fire('change');session.tick();await wait();assert.equal(calls.length,4);assert.ok(calls.slice(0,2).every(c=>c.signal.aborted));assert.ok(calls.slice(2).every(c=>Object.values(c.payload.input).includes('杭州')))
 const result=location=>({kind:'json',value:{items:[{location,description:'晴',tempC:12}],source:'test',fetchedAt:new Date().toISOString(),truncated:false}})
 calls.find(c=>c.payload.tool==='opencli.wttr.current'&&c.payload.input.location==='杭州').resolve(result('杭州'));await wait()
 calls.find(c=>c.payload.tool==='opencli.wttr.current'&&c.payload.input.location==='上海').resolve(result('上海'));await wait()
 assert.equal(session.current().bindings.w.value.items[0].location,'杭州')
 session.save();const restored=createCardSession(spec,{storage,persistenceKey:"subject-test"});try{assert.equal(restored.scope().state.city,"杭州")}finally{restored.dispose()}
 }finally{session.dispose()}
})
test('summary mode retains links that only the full decision workspace owns',()=>{
 const c=compileCard('<card><binding id="r" tool="opencli.12306.trains" input={{from:"北京",to:"上海",date:"2026-11-14"}} initial={{items:[],source:"",fetchedAt:"",truncated:false}}/><tool-view binding="r" presentation="summary"/><link url="https://www.12306.cn/">官网</link></card>',{final:true})
 assert.ok(c.complete,JSON.stringify(c.diagnostics));assert.equal(projectDecisionActions(c.spec.children,c.spec.bindings).length,2)
})

test('composed media participates in the existing delivery queue without model calls',()=>{
 const c=compileCard('<card><task-board view={compose({},{subject:{id:"x",title:"X"},media:[{query:"gen: illustration"},{query:"train"}]})}/></card>',{final:true,context:{expressionDialect:'js-v1'}});assert.ok(c.complete,JSON.stringify(c.diagnostics));assert.deepEqual(collectImages(c.spec).map(x=>[x.query,x.role]),[['gen: illustration','thumbnail'],['train','thumbnail']]);
})
