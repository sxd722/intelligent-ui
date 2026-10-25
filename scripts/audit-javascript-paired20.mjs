// Requirement assertions against immutable model artifacts. This is NOT a UI
// renderer or a repair pass; geometry, gestures and real media need browser QA.
import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {getQuickJS} from 'quickjs-emscripten'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {evaluate} from '../shared/cardspec/expression.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
import {executeLogic} from '../shared/cardspec/logic-engine.mjs'
const root='artifacts/javascript-upgrade/paired20-r2',summary=JSON.parse(await readFile(root+'/summary.json','utf8')),QuickJS=await getQuickJS(),results=[]
const outputPath=process.argv.find(a=>a.startsWith('--out='))?.slice(6)||root+'/interaction-audit.json'
for(const row of summary.filter(r=>r.expressionDialect==='js-v1')){
 const record=JSON.parse(await readFile(`${root}/adaptive-v1/js-v1/r1/${row.id}-cardspec.json`,'utf8'))
 const compiled=compileCard(record.source,{final:true,context:{expressionDialect:'js-v1',localDate:'2026-10-21',timeZone:'Asia/Shanghai'}}),spec=compiled.spec,store=createStore(),checks=[],events=[]
 const scope=()=>makeScope(spec,store),state=()=>structuredClone(store.values),derived=id=>scope().derived[id],data=id=>scope().data[id]
 const fire=(action,event={},args={})=>{executeAction(spec,store,action,{event,args});events.push({action,event,args,state:state()})}
 const check=(name,run)=>{try{run();checks.push({name,passed:true})}catch(e){checks.push({name,passed:false,error:e.message})}}
 const nodes=(baseScope=scope())=>{const out=[];function walk(list,s){for(const n of list||[]){if(n.type==='run'){out.push({type:'run',value:evaluate(n.value,s)});continue}const p=Object.fromEntries(Object.entries(n.props||{}).filter(([k])=>k!=='args'&&k!=='itemKey').map(([k,v])=>[k,evaluate(v,s)]));if(p.visible===false||n.type==='if'&&!p.test)continue;if(n.type==='each'){for(const [index,item] of p.items.entries())walk(n.children,{...s,[p.as||'item']:item,index});continue}out.push({type:n.type,p});if(n.type!=='logic')walk(n.children,s)}}walk(spec.children,baseScope);return out}
 const text=(s)=>nodes(s).filter(n=>n.type==='run').map(n=>n.value??'').join(' ')
 const byType=t=>nodes().filter(n=>n.type===t)
 check('final source compiles under current JS contract',()=>assert.equal(compiled.complete,true,JSON.stringify(compiled.diagnostics)))
 if(!compiled.complete){results.push({id:row.id,checks});continue}
 scope()
 switch(row.id){
 case '01-counter':
  check('decrement stops at zero; reset preserves note',()=>{fire('dec');assert.equal(state().n,0);fire('inc');fire('inc');fire('setNote',{value:'retain'});fire('reset');assert.equal(state().n,0);assert.equal(state().note,'retain')});break
 case '02-water':
  check('eight-cup bound, undo and reset',()=>{for(let i=0;i<10;i++)fire('add');assert.equal(state().cups,8);fire('undo');assert.equal(state().cups,7);fire('reset');fire('undo');assert.equal(state().cups,0)});break
 case '03-checklist':
  check('checks survive paging; totals and reset',()=>{fire('toggleTask',{},'t1');fire('nextPage');fire('toggleTask',{},'t20');assert.equal(derived('doneCount'),2);assert.equal(derived('pageDone'),1);fire('prevPage');assert.equal(state().done.t1,true);fire('resetAll');assert.equal(derived('doneCount'),0)});break
 case '04-filter':
  check('filter/search retain selection and empty matches',()=>{fire('toggle',{},data('items')[0]);fire('setCat',{value:'电子'});assert.equal(derived('visible').length,2);assert.equal(derived('done'),1);fire('setQ',{value:'不存在'});assert.equal(derived('visible').length,0);fire('setQ',{value:''});fire('setCat',{value:'全部'});assert.equal(state().checked.passport,true)});break
 case '05-expenses':{
  const add=()=>{fire('setName',{value:'午餐'});fire('setAmount',{value:12.5});fire('add')}
  check('add, sum and remove one expense',()=>{add();add();assert.equal(derived('total'),25);fire('remove',{},state().items[0]);assert.equal(derived('total'),12.5)})
  check('delete then re-add identical expense preserves unique row identity',()=>{add();const ids=state().items.map(x=>x.id);assert.equal(new Set(ids).size,ids.length,'generated length-based ID collides after deletion');fire('remove',{},state().items[0]);assert.equal(state().items.length,1)});break}
 case '06-calculator':
  check('amount/rate/people update result; zero people clamped',()=>{fire('setTotal',{value:200});fire('setRate',{value:15});fire('setPeople',{value:4});assert.ok(Math.abs(derived('per')-57.5)<1e-9);fire('setPeople',{value:0});assert.equal(state().people,1);assert.ok(Number.isFinite(derived('per')))});break
 case '07-form':
  check('form gates submission and preserves edits after return',()=>{assert.equal(byType('button').find(x=>x.p.onPress==='submit').p.disabled,true);fire('setName',{value:'测试'});fire('setAgree',{checked:true});fire('setSlot',{value:'下午'});assert.equal(byType('button').find(x=>x.p.onPress==='submit').p.disabled,false);fire('submit');assert.equal(state().done,true);fire('back');assert.equal(state().name,'测试');assert.equal(state().slot,'下午')});break
 case '08-calendar':
  check('leap-day and empty-date details; month navigation',()=>{fire('pick',{date:'2028-02-29'});assert.equal(derived('sel').title,'闰日读书会');fire('pick',{date:'2028-02-28'});assert.equal(derived('sel'),null);fire('nextMonth');assert.equal(state().month,'2028-03');fire('prevMonth');assert.equal(state().month,'2028-02')});break
 case '09-carousel':
  check('step selection and independent notes',()=>{fire('note',{value:'first'},'grind');fire('go',{index:1});fire('note',{value:'second'},'pour');fire('go',{index:0});assert.deepEqual(state().notes,{grind:'first',pour:'second',taste:''})});break
 case '10-chart':
  check('negative/zero chart data retained and selection updates',()=>{const chart=byType('chart')[0];assert.deepEqual(chart.p.data.map(x=>x.value),[20,-10,0,35]);fire('pick',{id:'tue',label:'周二',value:-10});assert.match(text(),/周二.*-10/)})
  check('detail changes for different selected bars',()=>{fire('pick',{id:'mon',label:'周一',value:20});assert.match(text(),/周一.*20/,'detail must reflect Monday instead of hard-coded Tuesday')});break
 case '11-mindmap':
  check('relationships and project-node explanation',()=>{const graph=byType('mindmap')[0].p;assert.equal(graph.nodes.find(n=>n.id==='proj').parentId,'act');fire('pick',{id:'proj'});assert.match(text(),/做一个小作品检验理解/)});break
 case '12-flowchart':
  check('back edge and node-specific detail',()=>{const graph=byType('flowchart')[0].p;assert.ok(graph.edges.some(e=>e.from==='review'&&e.to==='fill'&&e.label==='修改'));for(const [id,label]of [['fill','填写材料'],['review','审核'],['done','完成']]){fire('pick',{id});assert.equal(byType('stat')[0].p.value,label)}});break
 case '13-reading':
  check('eight full paragraphs retained with completion switch',()=>{assert.equal(byType('list-item').length,8);assert.equal(byType('region')[0].p.overflow,'scroll');assert.ok(!nodes().some(n=>n.p?.clamp));fire('markRead');assert.equal(state().readAll,true);fire('markRead');assert.equal(state().readAll,false)});break
 case '14-quiz':
  check('single score per question, correct final score and reset',()=>{for(const answer of ['4','CO2','火星']){fire('pick',{},answer);const score=state().score;fire('pick',{},answer);assert.equal(state().score,score);fire('next')}assert.equal(state().score,2);assert.equal(derived('done'),true);fire('restart');assert.equal(state().idx,0);assert.equal(state().score,0);assert.equal(state().picked,'')});break
 case '15-resource-game':
  check('three expensive meals settle only after resources consumed',()=>{for(let i=0;i<3;i++){assert.equal(derived('over'),false);fire('cook',{}, {deltaF:-2,deltaH:2,label:'精致餐'});assert.equal(state().food,4-2*i);if(i<2)fire('nextRound')}assert.equal(derived('over'),true);assert.equal(state().happy,9);fire('restart');assert.equal(state().food,6)})
  check('five cheap meals reach turn limit',()=>{for(let i=0;i<5;i++){fire('cook',{}, {deltaF:-1,deltaH:-1});fire('nextRound')}assert.equal(derived('over'),true);assert.equal(state().food,1)});break
 case '16-delayed-story':
  check('delayed branching, seven-day terminal and reset',()=>{for(let day=1;day<=7;day++){assert.equal(state().day,day);if(day===4)assert.equal(derived('cur').adoptFor,true);fire('pick',{},derived('cur').choices[0]);assert.equal(state().phase,'result');for(const k of ['decay','happy','aff'])assert.ok(state()[k]>=0&&state()[k]<=10);fire('advance');assert.equal(state().phase,day===7?'end':'choose')}assert.ok(derived('ending').length>0);fire('restart');assert.equal(state().adopted,false);for(let day=1;day<4;day++){fire('pick',{},derived('cur').choices[1]);fire('advance')}assert.equal(derived('cur').adoptFor,false)});break
 case '17-card-battle':{
  const logic=spec.children.find(n=>n.type==='logic'),source=evaluate(logic.props.source,scope()),initial=evaluate(logic.props.initial,scope());let s=initial
  const act=type=>{s=executeLogic(QuickJS,{source,state:s,event:{type}});events.push({logicEvent:type,state:s});return s}
  check('no premature win, one fire per turn, terminal freeze and reset',()=>{for(let i=0;i<4;i++){act('fire');assert.equal(s.ehp,Math.max(0,10-3*(i+1)));assert.equal(s.over,i===3);if(i<3){const hp=s.ehp;act('fire');assert.equal(s.ehp,hp);act('end')}}const terminal=JSON.stringify(s);act('end');assert.equal(JSON.stringify(s),terminal);act('reset');assert.deepEqual(s,initial)})
  check('loss path and serialization restore',()=>{for(let i=0;i<5;i++){s=JSON.parse(JSON.stringify(s));act('end')}assert.equal(s.php,0);assert.equal(s.over,true);assert.match(s.msg,/击败/)});break}
 case '18-chronicle':
  check('era change resets selected event without stale detail',()=>{fire('pickEra',{value:'40K'});assert.equal(derived('current').id,'40k-1');fire('pickEvent',{}, {id:'40k-2'});assert.equal(derived('current').title,'不屈远征');fire('pickEra',{value:'中古'});assert.equal(derived('current').id,'fantasy-1')});break
 case '19-media':
  check('independent counters and declared image roles',()=>{fire('toggleFav',{},'bird');fire('toggleFav',{},'bird');assert.equal(state().fav.bird,2);assert.equal(state().fav.leaf,0);fire('toggleFav',{},'leaf');assert.equal(state().fav.leaf,1);assert.ok(byType('image').some(n=>n.p.mediaRole==='hero'));assert.equal(byType('image').filter(n=>n.p.mediaRole==='thumbnail').length,2)});break
 case '20-cart':
  check('discount boundary, snapshot immutability and second checkout',()=>{fire('dec',{}, {id:'apple'});assert.equal(state().qty.apple,0);fire('inc',{}, {id:'milk'});fire('inc',{}, {id:'milk'});assert.equal(derived('pay'),16);fire('inc',{}, {id:'bread'});assert.equal(derived('pay'),16);fire('checkout');const order=state().lastOrder;assert.deepEqual([order.total,order.discount,order.paid],[21,5,16]);assert.equal(derived('count'),0);fire('inc',{}, {id:'apple'});assert.deepEqual(state().lastOrder,order);fire('checkout');assert.equal(state().lastOrder.no,2);assert.equal(state().lastOrder.paid,3)});break
 }
 check('serialized state retains derived values and visible content',()=>{const before=text(),copy=createStore();copy.values=JSON.parse(JSON.stringify(store.values));const restored=makeScope(spec,copy);for(const id of Object.keys(spec.derived))assert.deepEqual(restored.derived[id],derived(id));assert.equal(text(restored),before)})
 results.push({id:row.id,sourceHash:createHash('sha256').update(record.source).digest('hex'),checks,events,browserVerified:false})
}
const output={at:new Date().toISOString(),scope:'Headless action/reducer and visible-expression assertions. Does not establish DOM layout, gestures, media loading or live tool success.',generation:summary.reduce((out,r)=>{const d=out[r.expressionDialect]||={total:0,first:0,final:0};d.total++;d.first+=Number(r.firstPass);d.final+=Number(r.status==='succeeded');return out},{}),results}
await writeFile(outputPath,JSON.stringify(output,null,2))
console.log(JSON.stringify({cases:results.length,passingCases:results.filter(r=>r.checks.every(c=>c.passed)).length,checks:results.flatMap(r=>r.checks).length,failures:results.flatMap(r=>r.checks.filter(c=>!c.passed).map(c=>({id:r.id,...c})))},null,2))


