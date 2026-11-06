import {decisionDiagnostics} from '../shared/cardspec/decision-diagnostics.mjs';
import {projectDecisionActions} from '../shared/cardspec/decision-profile.mjs';
import test from'node:test';import assert from'node:assert/strict';
import{compileCard}from'../shared/cardspec/compiler.mjs';import{createCardSession}from'../src/cardspec/tool-session.mjs';import{taskDataset}from'../shared/cardspec/task-operations.mjs';import{toolResultDiagnostics}from'../shared/cardspec/tool-result-diagnostics.mjs';import{bindingPlanDiagnostics}from'../server/cardspec/binding-plan.mjs';import{activeBindings}from'../shared/cardspec/binding-schedule.mjs';import{makeScope}from'../shared/cardspec/store.mjs';
const envelope=items=>({items,source:'fixture',fetchedAt:'2026-11-05T00:00:00Z',truncated:false});const rows=[{id:'123',rowKey:'source:123',title:'甲'},{id:'456',rowKey:'source:456',title:'乙'}];
const compile=source=>{const c=compileCard(source,{final:true,context:{expressionDialect:'js-v1'}});assert.equal(c.complete,true,JSON.stringify(c.diagnostics));return c.spec};
const movie=()=>{const s=compile('<card><binding id="b" tool="opencli.douban.movie-hot" input={{limit:10}} load="visible"/><tool-view binding="b"/></card>');s.prefetched=[{tool:'opencli.douban.movie-hot',input:{limit:10},value:envelope(rows),updatedAt:'2026-11-05T00:00:00Z'}];return s};
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
test('native owned destination is deduplicated without removing unique or conditional actions',()=>{
 const s=compile('<card><binding id="b" tool="opencli.12306.trains" input={{from:"杭州",to:"上海",date:"2026-11-06"}}/><tool-view binding="b"/><link url="https://www.12306.cn/index/" label="购票"/><link url="https://example.org" label="另一个入口"/></card>');
 const projected=projectDecisionActions(s.children,s.bindings);assert.equal(projected.length,2);assert.equal(s.children.length,3);assert.equal(projected[1].props.url.value,'https://example.org');
 assert.equal(projectDecisionActions(s.children.slice(1),s.bindings).length,2);
});
test('a filter that only updates a count fails; an actually bound native filter passes',()=>{
 const source='<card><state id="cap" type="number" initial={120}/><binding id="b" tool="opencli.douban.movie-hot" input={{limit:10}}/><derive id="rows" value={(bindings.b.value.items??[]).filter(x=>x.duration&lt;=state.cap)}/><slider label="时长" value={state.cap} min={60} max={180} onChange="change"/><caption>{derived.rows.length}</caption><tool-view binding="b"/><action id="change"><set target="cap" value={event.value}/></action></card>';
 const options={final:true,context:{expressionDialect:'js-v1'}};const bad=compileCard(source,options);assert.ok(bad.diagnostics.some(d=>d.code==='detached_result_filter'));
 const good=compileCard(source.replace('<tool-view binding="b"/>','<tool-view binding="b" task={{where:[{field:"duration",op:"lte",value:state.cap,unit:"分钟"}]}}/>'),options);assert.equal(good.complete,true,JSON.stringify(good.diagnostics));
});
test('paired native bindings compile without execution and count both result consumers/triggers',()=>{
 const s=compile('<card><binding id="out" tool="opencli.12306.trains" input={{from:"杭州",to:"上海",date:"2026-11-06"}} load="visible"/><binding id="back" tool="opencli.12306.trains" input={{from:"上海",to:"杭州",date:"2026-11-08"}} load="visible"/><tool-view bindings={{去程:"out",回程:"back"}}/></card>');
 assert.deepEqual(toolResultDiagnostics(s),[]);assert.deepEqual(bindingPlanDiagnostics(s,[{tool:'opencli.12306.trains',purpose:'刷新去回程',available:true}]),[]);
 const duplicated={...s,children:[...s.children,...s.children]};
 assert.ok(decisionDiagnostics(duplicated).some(d=>d.code==='duplicate_decision_owner'));
 assert.equal(compileCard('<card><tool-view bindings={{去程:"bad",回程:"bad"}}/></card>',{final:true}).complete,false);
 assert.equal(compileCard('<card><tool-view bindings={{a:"x",b:"y"}} tool="opencli.douban.movie-hot"/></card>',{final:true}).complete,false);
});
test('enrichment merges by verified entity; native tags and numeric duration filter actual data',async()=>{
 let calls=0;const s=createCardSession(movie(),{transport:async r=>{calls++;assert.equal(r.input.id,'123');return{kind:'json',value:envelope([{id:'123',type:'movie',genres:['剧情','喜剧'],duration:'98分钟',summary:'新增故事',directors:['导演']}])}}});s.setActivity({visible:true,complete:true});
 try{assert.equal(calls,0);await Promise.all([s.readTaskEntity('b',rows[0]),s.readTaskEntity('b',rows[0])]);assert.equal(calls,1);assert.equal(s.current().bindings.b.value.items[0].summary,undefined);const d=s.taskData('b');assert.equal(d.items[0].summary,'新增故事');const selected=taskDataset('opencli.douban.movie-hot',d,{task:{where:[{field:'duration',op:'lte',value:100,unit:'分钟'},{field:'genres',op:'eq',value:'喜剧'}]}});assert.equal(selected.eligible.length,1);assert.equal(selected.eligible[0].entityId,'123');await s.readTaskEntity('b',rows[0]);assert.equal(calls,1)}finally{s.dispose()}
});
test('successful enrichment and per-view choices survive session serialization without network replay',async()=>{
 const spec=movie(),storage=memory(),options={storage,persistenceKey:'qa',transport:async()=>({kind:'json',value:envelope([{id:'123',duration:110,summary:'持久化'}])})};let s=createCardSession(spec,options);s.setActivity({visible:true,complete:true});await s.readTaskEntity('b',rows[0]);s.saveView({native:{selected:'123'}});s.save();s.dispose();let calls=0;s=createCardSession(spec,{...options,transport:async()=>{calls++;throw Error('must not replay')}});s.setActivity({visible:true,complete:true});try{assert.equal(s.taskData('b').items[0].summary,'持久化');assert.equal(s.current().viewState.native.selected,'123');await s.readTaskEntity('b',rows[0]);assert.equal(calls,0)}finally{s.dispose()}
});
test('cancellation and changed source reject late details, while unrelated state does not discard them',async()=>{
 let resolve;const s=createCardSession(movie(),{transport:()=>new Promise(r=>resolve=r)});s.setActivity({visible:true,complete:true});try{const pending=s.readTaskEntity('b',rows[0]);const checked=assert.rejects(pending,/STALE/);await new Promise(r=>setImmediate(r));s.setActivity({visible:false});resolve({kind:'json',value:envelope([{id:'123',summary:'过期'}])});await checked;assert.equal(s.taskData('b').items[0].summary,undefined);assert.equal(s.taskData('b').items[0]._task.status,'idle');s.setActivity({visible:true});const next=s.readTaskEntity('b',rows[0]);await new Promise(r=>setImmediate(r));s.saveView({unrelated:'input'});resolve({kind:'json',value:envelope([{id:'123',summary:'有效'}])});await next;assert.equal(s.taskData('b').items[0].summary,'有效');s.current().bindings.b.version++;assert.equal(s.taskData('b').items[0].summary,undefined)}finally{s.dispose()}
});
test('mismatched detail entity fails locally and retains the list; failures preserve previous success',async()=>{
 let wrong=false;const s=createCardSession(movie(),{transport:async()=>({kind:'json',value:envelope([{id:wrong?'999':'123',summary:'真实简介'}])})});s.setActivity({visible:true,complete:true});try{await s.readTaskEntity('b',rows[0]);wrong=true;await assert.rejects(s.readTaskEntity('b',rows[0],{force:true}),/MISMATCH/);assert.equal(s.taskData('b').items[0].summary,'真实简介');assert.equal(s.taskData('b').items[0]._task.status,'error');await assert.rejects(s.readTaskEntity('b',{id:'999'}),/STALE_ENTITY/)}finally{s.dispose()}
});
