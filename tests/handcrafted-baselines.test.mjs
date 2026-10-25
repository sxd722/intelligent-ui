import test from 'node:test'
import assert from 'node:assert/strict'
import {getQuickJS} from 'quickjs-emscripten'
import {executeLogic} from '../shared/cardspec/logic-engine.mjs'
import {validateLogicView} from '../shared/cardspec/logic-view.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createStore,makeScope} from '../shared/cardspec/store.mjs'
import {validateToolInput,validateJson,TOOLS} from '../shared/cardspec/tools.mjs'
import {BASELINE_CARDS} from '../shared/cardspec/baselines/cards.mjs'
import {SOURCES,SEEDS,FAMILY_SCHEMA} from '../shared/cardspec/baselines/logic.mjs'
import {fixtureValue} from '../shared/cardspec/baselines/fixtures.mjs'
import {compute} from '../src/baseline/core.mjs'
import {validateBusinessIds} from '../shared/cardspec/dataflow.mjs'
const q=await getQuickJS(),compiled=Object.fromEntries(BASELINE_CARDS.map(c=>[c.id,compileCard(c.source,{final:true,context:{localDate:'2026-10-20'}})]));
function harness(id){
 let state=structuredClone(SEEDS[id]),seq=0,response={seq:0};
 const spec=compiled[id].spec,scope=makeScope(spec,createStore()),node=spec.children.find(x=>x.type==='logic');
 function run(type,args={}){
  state=executeLogic(q,{source:SOURCES[id],state,event:{type,args:{},...args},input:{response,today:'2026-10-20',planSchema:FAMILY_SCHEMA}});
  validateLogicView(node.children,{...scope,local:state});return structuredClone(state);
 }
 return {run,get state(){return structuredClone(state)},reply(op,value,input={},ok=true){response={seq:++seq,op,ok,value,input,error:ok?'':'测试来源不可用'};return run('input')},
 call(op,tool){const input=structuredClone(state.request);validateToolInput(tool,input);const value=fixtureValue(tool,input);validateJson(value,tool==='glm.generate'?input.schema:TOOLS[tool].outputSchema);return this.reply(op,value,input)},
 restore(){return run('init')}};
}
test('five standalone CardSpecs compile; no sandbox and no startup tool calls',()=>{
 for(const c of BASELINE_CARDS){assert.equal(compiled[c.id].complete,true,JSON.stringify(compiled[c.id].diagnostics));assert.doesNotMatch(c.source,/<sandbox/);assert.doesNotMatch(c.source,/load="visible"/);harness(c.id).run('init');}
});
test('sentiment excludes news/discovery, validates quotes, computes sample/date counts and excludes stale sources',()=>{
 const h=harness('sentiment');h.run('init');h.run('news');h.call('news','opencli.google.news');assert.equal(h.state.total,0);
 h.run('videos');h.call('videos','opencli.bilibili.search');assert.equal(h.state.total,0);
 h.run('weibo');h.call('weibo','opencli.weibo.search');assert.equal(h.state.total,3);
 h.run('analyze');h.call('analyze','dataset.analyze');assert.equal(h.state.counts.find(x=>x.id==='负向').value,1);assert.equal(h.state.unknown,1);
 h.run('chart',{id:'负向'});assert.equal(h.state.rows.length,1);assert.match(h.state.rows[0].quote,/担心/);
 const labels=h.state.labels;h.reply('analyze',{items:[{rowKey:h.state.rows[0].rowKey,analysisLabel:'负向',analysisQuote:'不存在的引文'}]});assert.deepEqual(h.state.labels,labels);assert.match(h.state.message,/未采纳/);
 h.reply('weibo',null,{},false);assert.equal(h.state.total,0);assert.equal(h.state.sources.weibo.items.length,3);assert.match(h.state.coverage.find(x=>x.id==='weibo').status,/过期/);
});
test('Bili comment drilldown uses returned business ID and does not classify video titles',()=>{
 const h=harness('sentiment');h.run('videos');h.call('videos','opencli.bilibili.search');
 const item=h.state.sources.videos.items[0];h.run('select',{item});h.run('comments');assert.equal(h.state.request.bvid,item.bvid);h.call('comments','opencli.bilibili.comments');
 h.run('analyze');h.call('analyze','dataset.analyze');assert.equal(h.state.total,3);assert.equal(h.state.labels.length,3);
});
test('actual adapter field shapes: BV comes from source URL, comment text/date are normalized, XHS titles remain discovery',()=>{
 const h=harness('sentiment');h.run('videos');h.reply('videos',{items:[{rowKey:'v1',title:'测试视频',url:'https://www.bilibili.com/video/BV1xx411c7mD/'}],fetchedAt:'2026-10-20',truncated:false});
 h.run('select',{item:h.state.sources.videos.items[0]});h.run('comments');assert.equal(h.state.request.bvid,'BV1xx411c7mD');
 h.reply('comments',{items:[{rowKey:'r1',rpid:'1',text:'担心车辆可靠性',time:'2026-10-18 20:30'},{rowKey:'r2',rpid:'2',text:'我想看完整检测报告',time:'2026-10-19 00:30'}],fetchedAt:'2026-10-20',truncated:false});
 assert.equal(h.state.total,2);assert.equal(h.state.sources.comments.items[0].time,'2026-10-18T20:30:00Z');
 h.run('xhs');h.reply('xhs',{items:[{rowKey:'x1',title:'仅有笔记标题',published_at:'2026-10-20'}],fetchedAt:'2026-10-20',truncated:false});assert.equal(h.state.total,2);
 h.run('analyze');assert.match(h.state.request.items[0].content,/可靠性/);assert.equal(h.state.request.items[0].date,'2026-10-19');
});
test('family selections survive reload; planner rejects unknown, duplicate, missing and stale references',()=>{
 const h=harness('family');h.run('search');h.call('search','opencli.ctrip.search');
 for(const item of h.state.rows.slice(0,3)){h.run('focus',{item});h.run('toggle');}
 const selected=h.state.selected;h.run('search');h.call('search','opencli.ctrip.search');assert.deepEqual(h.state.selected,selected);
 h.run('plan');const request=h.state.request;h.call('plan','glm.generate');const plan=h.state.plan;assert.equal(plan.slots.length,3);
 for(const slots of [plan.slots.slice(1),[plan.slots[0],plan.slots[0],plan.slots[2]],[{...plan.slots[0],ref:'invented'},...plan.slots.slice(1)]]){h.reply('plan',{...plan,slots},request);assert.deepEqual(h.state.plan,plan);assert.match(h.state.message,/未采纳/);}
 h.run('field',{args:{name:'age'},value:'7岁'});assert.equal(h.state.plan,null);h.reply('plan',plan,request);assert.equal(h.state.plan,null);
 h.run('check',{args:{key:'水和点心'}});h.restore();assert.equal(h.state.packed['水和点心'],true);
});
test('movies keep full choice through queries, ignore obsolete details and match video request to saved movie',()=>{
 const h=harness('movies');h.run('search');h.call('search','opencli.douban.search');const a=h.state.rows[0],b=h.state.rows[1];
 h.run('select',{item:a});h.run('detail');h.call('detail','opencli.douban.subject');assert.match(h.state.detail.summary,/完整资料/);
 h.run('compare');h.run('choose');const pick=h.state.pick;h.run('hot');h.call('hot','opencli.douban.movie-hot');assert.deepEqual(h.state.pick,pick);
 h.run('select',{item:b});h.reply('detail',fixtureValue('opencli.douban.subject',{id:a.id}),{id:a.id});assert.equal(h.state.detail.id,b.id);
 h.run('videos');h.call('videos','opencli.bilibili.search');assert.ok(h.state.videos.length);h.run('field',{args:{name:'rating'},value:9});assert.ok(h.state.visible.every(x=>x.rating>=9));
 h.run('hot');h.run('tab',{value:'去观看'});h.call('hot','opencli.douban.movie-hot');assert.equal(h.state.tab,'去观看');
 h.restore();assert.deepEqual(h.state.pick,pick);
});
test('movie identity survives different search/detail/hot rowKeys without duplicate comparison entries',()=>{
 const h=harness('movies');
 h.reply('search',{items:[{id:'1292722',rowKey:'row:search',title:'影片',url:'https://movie.douban.com/subject/1292722/'}]});h.run('select',{item:h.state.rows[0]});h.run('compare');
 h.reply('detail',{items:[{id:'1292722',rowKey:'row:detail',title:'影片',summary:'详情'}]},{id:'1292722'});h.run('compare');assert.equal(h.state.chosen.length,0);
 h.reply('hot',{items:[{rowKey:'row:hot',title:'影片',url:'https://movie.douban.com/subject/1292722/'}]});assert.equal(h.state.rows[0].rowKey,'film:1292722');assert.equal(h.state.rows[0].id,'1292722');
});
test('round trip pins use response query snapshot; refresh targets exact train, release time stays user owned',()=>{
 const h=harness('trains');h.run('init');assert.deepEqual(h.state.dates,['2026-10-23','2026-10-25']);
 h.run('search');h.call('search','opencli.12306.trains');h.run('select',{item:h.state.rows[0]});h.run('field',{args:{name:'from'},value:'杭州南'});h.run('pin');
 assert.equal(h.state.tickets[0].from,'杭州东');const first=h.state.tickets[0];
 h.run('leg',{value:1});h.run('search');h.call('search','opencli.12306.trains');h.run('select',{item:h.state.rows[1]});h.run('pin');assert.deepEqual(h.state.tickets[0],first);
 h.run('manage',{args:{leg:0}});h.run('release',{value:'2026-10-21T12:00',args:{leg:0}});h.run('refresh');assert.equal(h.state.request.from,'杭州东');assert.equal(h.state.request.departureBefore,'13:21');h.call('refresh','opencli.12306.trains');assert.equal(h.state.release[0],'2026-10-21T12:00');
 h.restore();assert.equal(h.state.tickets.filter(Boolean).length,2);assert.match(h.state.copy,/杭州东/);
});
test('Transformer all intermediates match H5 math across inputs and both residual settings',()=>{
 const h=harness('transformer');h.run('init');
 for(const sentence of ['我 喜欢 杭州','attention token','甲 乙 丙 丁 戊 己 庚'])for(const delta of [-2,0,1.25])for(const residual of [true,false]){
  h.run('field',{args:{name:'sentence'},value:sentence});h.run('field',{args:{name:'delta'},value:delta});if(h.state.residual!==residual)h.run('residual');
  const expected=compute(sentence,delta,residual);for(let i=0;i<expected.length;i++)for(const k of ['input','attention','a','h','n','z','activation','f','y'])for(let j=0;j<expected[i][k].length;j++)assert.ok(Math.abs(h.state.all[i][k][j]-expected[i][k][j])<1e-10,`${sentence}/${delta}/${residual}/${i}/${k}/${j}`);
 }
 h.run('tab',{value:'FFN显微镜'});h.run('neuron',{rowId:'1',columnId:'3'});assert.ok(Math.abs(h.state.contributions.reduce((n,x)=>n+x.value,0)+h.state.bias-h.state.z)<1e-10);
});
test('isolated failures preserve last state; restored pending requests become manually retryable',()=>{
 for(const id of Object.keys(SEEDS)){const h=harness(id);h.run('init');const before=h.state;assert.throws(()=>h.run('fault'),/隔离测试/);assert.deepEqual(h.state,before);}
 const h=harness('family');h.run('search');h.restore();assert.equal(h.state.pending,'');assert.match(h.state.message,/已中断/);
});
test('source business IDs may equal selection keys; opaque row keys are still rejected',()=>{
 assert.doesNotThrow(()=>validateBusinessIds({id:'1292722'},{films:{value:{items:[{rowKey:'1292722',id:'1292722'}]}}}));
 assert.throws(()=>validateBusinessIds({id:'row:movie:1'},{films:{value:{items:[{rowKey:'row:movie:1',id:'1292722'}]}}}),/rowKey/);
 assert.throws(()=>validateBusinessIds({id:'selection-1'},{films:{value:{items:[{rowKey:'selection-1',id:'1292722'}]}}}),/rowKey/);
 assert.throws(()=>validateBusinessIds({uid:'1292722'},{films:{value:{items:[{rowKey:'1292722',id:'1292722'}]}}}),/rowKey/);
});
