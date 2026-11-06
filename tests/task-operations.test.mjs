import test from 'node:test'
import assert from 'node:assert/strict'
import {taskDataset,taskSelection,toggleTaskSelection,taskComparison,taskAggregate,validateTask,validateTaskFields} from '../shared/cardspec/task-operations.mjs'
import {auditTaskConstraints,auditFixedRoles,auditDetailEvidence} from '../shared/cardspec/task-gates.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {detailRequests} from '../shared/cardspec/result-view.mjs'
import {createCardSession} from '../src/cardspec/tool-session.mjs'
import {repairCapabilities,lostRepairCapabilities} from '../server/cardspec/repair-capabilities.mjs'
const envelope=items=>({items,source:'fixture',fetchedAt:'2026-11-02T00:00:00Z',truncated:false})
const rows=[{sku:'a',title:'A',price:399,shop:'甲'},{sku:'b',title:'B',price:499,shop:'乙'},{sku:'c',title:'C',price:899,shop:'乙'},{sku:'d',title:'D',price:null},{sku:'e',title:'E',price:0},{sku:'f',title:'F',price:'400'}]
const task={where:[{field:'price',op:'lte',value:500,unit:'元'}],selection:'multiple',max:2,compare:true}
const dataset=(r=rows,input={query:'耳机'},t=task)=>taskDataset('opencli.jd.search',envelope(r),{task:t,input})
test('typed budget filters numbers; unknown/string values cannot masquerade as zero or price',()=>{
 const d=dataset();assert.deepEqual(d.eligible.map(x=>x.entityId),['a','b','e']);assert.equal(d.unknown.length,2)
 assert.equal(auditTaskConstraints({rows:d.eligible,constraints:task.where,fields:d.columns}).status,'passed')
 assert.equal(auditTaskConstraints({rows:d.items,constraints:task.where,fields:d.columns}).status,'failed')
 assert.throws(()=>dataset(rows,{}, {...task,where:[{field:'price',op:'lte',value:500,unit:'USD'}]}),/unit mismatch/)
 assert.throws(()=>dataset(rows,{}, {...task,where:[{field:'madeup',op:'lte',value:5}]}),/unknown field/)
})
test('selection respects limits, survives filters/reorder, rejects constraint or source changes',()=>{
 const d=dataset();let s=toggleTaskSelection(d,{},d.eligible[0].key,task);s=toggleTaskSelection(d,s,d.eligible[1].key,task)
 assert.throws(()=>toggleTaskSelection(d,s,d.eligible[2].key,task),/limit/)
 assert.equal(taskSelection(dataset([...rows].reverse()),s,task).keys.length,2)
 assert.equal(taskSelection(dataset(rows,{query:'新查询'}),s,task).keys.length,0)
 assert.equal(taskSelection(dataset(rows,{}, {...task,where:[]}),s,task).keys.length,0)
 assert.throws(()=>toggleTaskSelection(d,s,d.items[2].key,task),/outside/)
 assert.equal(taskComparison(d,s).fields.find(f=>f.key==='price').values[0],'399元')
 const updated=dataset(rows.map(r=>r.sku==='a'?{...r,price:900}:r));assert.equal(taskSelection(updated,s,task).keys.length,1)
})
test('pin is one object per role with input-scoped identity and restores from JSON',()=>{
 const r=[{train_no:'real-a',code:'G1',start_time:'14:00',arrive_time:'15:00',second_seat:'有'},{train_no:'real-b',code:'G2',start_time:'15:00',arrive_time:'16:00',second_seat:'无'}],t={pin:'去程'},input={from:'杭州',to:'上海',date:'2026-11-06'},d=taskDataset('opencli.12306.trains',envelope(r),{input,task:t})
 let s=toggleTaskSelection(d,{},d.items[0].key,t);s=toggleTaskSelection(d,s,d.items[1].key,t);assert.equal(s.keys.length,1)
 const restored=taskSelection(d,JSON.parse(JSON.stringify(s)),t);assert.deepEqual(restored,s)
 const back=taskDataset('opencli.12306.trains',envelope(r),{input:{...input,date:'2026-11-08'},task:t});assert.notEqual(back.items[0].key,d.items[0].key)
 assert.equal(auditFixedRoles({required:[{name:'去程',input}],results:[{role:'去程',key:s.keys[0],input,visible:true}]}).status,'passed')
 assert.equal(auditFixedRoles({required:[{name:'去程',input}],results:[]}).status,'failed')
 assert.throws(()=>validateTask({pin:'去程',selection:'multiple'}),/single/)
})
test('aggregation reports observed denominator, partial data and missing group values',()=>{
 const d=dataset(rows,{},{});d.partial=true;const a=taskAggregate(d,{groupBy:'shop',aggregate:{op:'sum',field:'price'}})
 assert.equal(a.total,6);assert.equal(a.unknown,3);assert.equal(a.partial,true);assert.equal(a.groups.find(g=>g.label==='乙').value,1398)
})
test('date range requires real dates, datetime requires timezone, no invented conversions',()=>{
 const c={title:'name',entity:'id',fields:[{key:'date',path:'date',label:'日期',type:'date'}]},t={where:[{field:'date',op:'gte',value:'2026-11-02'}]}
 const d=taskDataset('test',envelope([{name:'A',date:'2026-11-01'},{name:'B',date:'2026-11-03'},{name:'C',date:'2026-99-99'}]),{task:t,contract:c});assert.deepEqual(d.eligible.map(r=>r.title),['B'])
 assert.throws(()=>validateTaskFields({where:[{field:'date',op:'gte',value:'invalid'}]},c),/invalid typed/)
 const dc={...c,fields:[{key:'date',path:'date',label:'时间',type:'datetime'}]},dt={where:[{field:'date',op:'gte',value:'2026-11-02T00:00:00Z'}]}
 const dd=taskDataset('test',envelope([{name:'A',date:'2026-11-03T08:00:00+08:00'},{name:'B',date:'2026-11-03T08:00:00'}]),{task:dt,contract:dc})
 assert.equal(dd.eligible.length,1);assert.equal(auditTaskConstraints({rows:dd.eligible,constraints:dt.where,fields:dd.columns}).status,'passed')
})
test('curated details keep real ID and full route context; unavailable edges remain absent',()=>{
 const q=detailRequests('opencli.12306.trains',{train_no:'internal',code:'G1'},{from:'杭州',to:'上海',date:'2026-11-06'})[0];assert.equal(q.input.trainNo,'internal');assert.equal(q.input.date,'2026-11-06')
 assert.deepEqual(detailRequests('opencli.12306.trains',{train_no:'internal'}),[])
 assert.deepEqual(detailRequests('opencli.tvmaze.search',{id:901}),[])
 const row={sku:'a',title:'A',price:399},request=detailRequests('opencli.jd.search',row)[0]
 assert.equal(auditDetailEvidence({row,request,expected:request,details:envelope([row])}).status,'limited')
 assert.equal(auditDetailEvidence({row,request,expected:request,details:envelope([{content:'新增评价'}])}).status,'passed')
 assert.equal(auditDetailEvidence({row,request:{...request,input:{sku:'b'}},expected:request,details:envelope([{content:'新增'}])}).status,'failed')
})
test('compiler validates task field/type options without executing tools, old tool-view remains valid',()=>{
 const c=t=>compileCard('<card><tool-view tool="opencli.jd.search" input={{query:"耳机"}} task={'+JSON.stringify(t)+'}/></card>',{final:true,context:{expressionDialect:'js-v1'}})
 assert.equal(c(task).complete,true,JSON.stringify(c(task).diagnostics))
 for(const t of [{bad:true},{where:[{field:'fake',op:'lte',value:5}]},{selection:'object'},{max:21},{aggregate:{op:'sum',field:'shop'}}])assert.equal(c(t).complete,false,JSON.stringify(t))
 assert.equal(compileCard('<card><tool-view tool="opencli.spotify.pause"/></card>',{final:true}).complete,true)
 assert.equal(compileCard('<card><tool-view tool="opencli.jd.search" task={{pin:"same"}}/><tool-view tool="opencli.jd.search" task={{pin:"same"}}/></card>',{final:true}).complete,false)
})
test('detail host deduplicates, discards stale responses and never fires at compile time',async()=>{
 const c=compileCard('<card><tool-view tool="opencli.jd.search" input={{query:"耳机"}} task={{compare:true}}/></card>',{final:true});assert.equal(c.complete,true,JSON.stringify(c.diagnostics))
 let n=0,resolve;const value=envelope(rows);c.spec.prefetched=[{id:'D1',tool:'opencli.jd.search',input:{query:'耳机'},value,updatedAt:'2026-11-02T00:00:00Z'}]
 const s=createCardSession(c.spec,{transport:async req=>{n++;assert.equal(req.tool,'opencli.jd.reviews');return await new Promise(r=>resolve=r)}});s.setActivity({complete:true,visible:true})
 try{assert.equal(n,0);const a=s.readTaskDetails('toolview-1',rows[0]),b=s.readTaskDetails('toolview-1',rows[0]);assert.equal(n,1);const caught=Promise.allSettled([a,b]);s.cancel();resolve({kind:'json',value:envelope([{content:'new'}])});const results=await caught;assert.ok(results.every(r=>r.status==='rejected'));await assert.rejects(s.readTaskDetails('toolview-1',{...rows[0],sku:'invented'}),/STALE/)}finally{s.dispose()}
})
test('switching detail entities rejects a late first result and retains the latest identity',async()=>{
 const c=compileCard('<card><tool-view tool="opencli.jd.search" input={{query:"耳机"}} task={{}}/></card>',{final:true});const pending=[]
 c.spec.prefetched=[{id:'D1',tool:'opencli.jd.search',input:{query:'耳机'},value:envelope(rows),updatedAt:'2026-11-02T00:00:00Z'}]
 const s=createCardSession(c.spec,{transport:(req)=>new Promise(resolve=>pending.push({req,resolve}))});s.setActivity({complete:true,visible:true})
 try{const a=s.readTaskDetails('toolview-1',rows[0]),b=s.readTaskDetails('toolview-1',rows[1]),all=Promise.allSettled([a,b]);pending[1].resolve({kind:'json',value:envelope([{content:'仅属于B的新增内容'}])});pending[0].resolve({kind:'json',value:envelope([{content:'仅属于A的旧内容'}])});const r=await all;assert.equal(r[0].status,'rejected');assert.equal(r[1].status,'fulfilled');assert.equal(r[1].value.request.input.sku,'b');assert.equal(r[1].value.audit.status,'passed')}finally{s.dispose()}
})
test('missing detail IDs and conflicting task modes fail before any external calls',async()=>{
 const c=compileCard('<card><tool-view tool="opencli.jd.search" input={{query:"耳机"}} task={{}}/></card>',{final:true}),raw={title:'缺ID',price:100};let calls=0
 c.spec.prefetched=[{id:'D1',tool:'opencli.jd.search',input:{query:'耳机'},value:envelope([raw]),updatedAt:'2026-11-02T00:00:00Z'}]
 const s=createCardSession(c.spec,{transport:async()=>{calls++}});s.setActivity({complete:true,visible:true})
 try{await assert.rejects(s.readTaskDetails('toolview-1',envelope([raw]).items[0]),/UNAVAILABLE/);assert.equal(calls,0)}finally{s.dispose()}
 assert.throws(()=>validateTask({pin:'温度',compare:true}),/compare needs multiple/)
 assert.throws(()=>validateTask({selection:'single',compare:true}),/compare needs multiple/)
})
test('repair cannot quietly remove a budget or comparison, but may rename and relayout',()=>{
 const spec=(where,extra='')=>compileCard('<card><region role="content"><tool-view '+extra+' tool="opencli.jd.search" input={{query:"耳机"}} task={'+JSON.stringify({where,compare:true})+'}/></region></card>',{final:true}).spec
 const capabilities=s=>repairCapabilities(s,['opencli.jd.search'])
 const before=capabilities(spec(task.where)),renamed=capabilities(spec(task.where,'id="newName"'))
 assert.equal(lostRepairCapabilities(before,renamed).length,0)
 assert.ok(lostRepairCapabilities(before,capabilities(spec([]))).some(d=>d.code==='repair_capability_lost'))
})
