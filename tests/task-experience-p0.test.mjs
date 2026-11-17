import test from 'node:test'
import assert from 'node:assert/strict'
import {auditResultCoverage,requestedPeriod,TASK_HELPERS,isoDay} from '../shared/cardspec/task-evidence.mjs'
import {taskBehaviorDiagnostics,taskOutputSnapshot,createBehaviorLedger,selectionRelationDiagnostics} from '../shared/cardspec/task-behavior.mjs'
import {parseExpression,evaluate,dateKey} from '../shared/cardspec/expression.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
import {assertSnapshot} from '../shared/cardspec/debug-assertions.mjs'
import {createDebugSession} from '../server/cardspec/debug-session.mjs'

test('coverage never substitutes acquisition date or invents dates',()=>{
 const value={items:[{date:'2026-10-01'},{date:'2026-10-22'},{date:null}],fetchedAt:'2026-11-06T12:00:00Z'}
 const a=auditResultCoverage({goal:'2026.11 法国新闻',value})
 assert.equal(a.status,'mismatch');assert.equal(a.observed.unknown,1);assert.equal(a.observed.within,0)
 assert.equal(auditResultCoverage({goal:'2026年11月新闻',value:{items:[{date:'2026-11-01'},{date:'2026-10-30'}]}}).status,'partial')
 assert.equal(auditResultCoverage({goal:'2026-11新闻',value:{items:[{date:'2026-11-01'}],truncated:true}}).status,'partial')
 assert.equal(requestedPeriod('看2026.10和2026.11的对比'),null)
 assert.equal(isoDay('2026-02-30'),null);assert.equal(isoDay(0),null);assert.equal(dateKey(null),'');assert.equal(dateKey(''),'')
 assert.equal(isoDay('Mon, 19 Oct 2026 07:00:00 GMT'),'2026-10-19')
 assert.equal(auditResultCoverage({goal:'2026.11',value:{items:[{fetchedAt:'2026-11-01'}]}}).status,'unknown')
})
test('host operations conserve unknown groups and replace whole entities',()=>{
 const a=[{id:'a',type:'x',date:'2026-10-02',stay:'old'},{id:'b',type:null,date:null},{id:'c',type:'x',date:'2026-10-01'}]
 const groups=TASK_HELPERS.groupCounts(a,'type');assert.equal(groups.reduce((n,g)=>n+g.value,0),3);assert.equal(groups[1].label,'未知');assert.equal(groups[0].items[1].id,'c')
 assert.deepEqual(TASK_HELPERS.orderBy(a,'date').map(r=>r.id),['c','a','b'])
 assert.deepEqual(TASK_HELPERS.replaceBy(a,'id',{id:'a',stay:'new'})[0],{id:'a',stay:'new'});assert.equal(a[0].stay,'old')
 assert.throws(()=>TASK_HELPERS.replaceBy(a,'id',{id:'missing'}))
 assert.equal(TASK_HELPERS.addMinutes('06:30',42),'07:12');assert.equal(TASK_HELPERS.addMinutes('23:50',20),null);assert.equal(TASK_HELPERS.minutesBetween('07:12','07:00'),-12)
})
test('both dialects use the same pure host operations',()=>{
 for(const dialect of ['legacy','js-v1'])for(const [source,expected]of [['minutesBetween("06:30",addMinutes("06:30",42))',42],['groupCounts([{type:"a"},{type:null}],"type")[1].value',1],['orderBy([{n:2},{n:1}],"n")[0].n',1]])assert.equal(evaluate(parseExpression(source,{dialect}),{}),expected)
})
const source='<card><state id="time" type="string" initial="06:00"/><derive id="arrival" value={addMinutes(state.time,42)}/><input id="depart" label="出发" value={state.time} onChange="change"/><text id="result">{derived.arrival}</text><action id="change"><set target="time" value={event.value}/></action></card>'
test('output assertions reject input echoes and observe actual derived results',()=>{
 const spec=compileCard(source,{final:true}).spec,store=createStore(),scope=makeScope(spec,store)
 const before={state:{...store.values},results:taskOutputSnapshot(spec,scope)}
 executeAction(spec,store,'change',{event:{value:'06:30'}})
 const next=makeScope(spec,store),after={state:store.values,results:taskOutputSnapshot(spec,next),derived:{arrival:next.derived.arrival}}
 assert.equal(assertSnapshot({changedResults:['result'],derived:{arrival:'07:12'}},before,after).passed,true)
 assert.equal(assertSnapshot({changedResults:['depart']},before,after).passed,false)
 assert.equal(assertSnapshot({changedResults:['result']},before,{...after,results:before.results}).passed,false)
 assert.deepEqual(taskBehaviorDiagnostics(spec),[])
 const stale=compileCard(source.replace('addMinutes(state.time,42)','"06:42"'),{final:true}).spec
 assert.equal(taskBehaviorDiagnostics(stale)[0].code,'task_input_unconsumed')
})
test('executable failed assertions are retained; nonexistent locators are not',()=>{
 const ledger=createBehaviorLedger(),steps=[{op:'fill',name:'出发',value:'06:30',expect:{changedResults:['result']}}]
 ledger.observe(steps,{actions:[{ok:false}]});assert.equal(ledger.paths().length,0)
 ledger.observe(steps,{actions:[{ok:true,assertion:{passed:false}}]});assert.equal(ledger.missing([[]]).length,1)
 assert.equal(ledger.missing([steps]).length,0)
})

test('input transactions can invalidate results with literal flags, without copying their input',()=>{
 const body='<card><state id="address" type="string" initial="A"/><state id="dirty" type="boolean" initial={false}/><input label="地址" value={state.address} onChange="edit"/><stat label="到达" value={state.dirty?"待核实":"09:00"}/><action id="edit"><set target="address" value={event.value}/><set target="dirty" value={true}/></action></card>'
 assert.deepEqual(taskBehaviorDiagnostics(compileCard(body,{final:true}).spec),[])
 assert.equal(taskBehaviorDiagnostics(compileCard(body.replace('<set target="dirty" value={true}/>',''),{final:true}).spec)[0].code,'task_input_unconsumed')
})

test('persisted free-text forms do not require artificial result components',()=>{
 const s=compileCard('<card><state id="note" type="string" initial=""/><input label="Note" value={state.note} onChange="edit"/><action id="edit"><set target="note" value={event.value}/></action></card>',{final:true}).spec
 assert.equal(taskBehaviorDiagnostics(s).filter(d=>d.severity==='error').length,0)
})
test('final source cannot pass by deleting a previously failing result test',async()=>{
 const steps=[{op:'fill',name:'出发',value:'06:30',expect:{changedResults:['result']}}],calls=[]
 const runner=async(_spec,{steps})=>{calls.push(steps);return {status:'tested',runs:[{scenario:'normal',initial:{errors:[]},final:{errors:[],controls:[],coverage:[]},pageErrors:[],actions:steps.map(step=>({step,ok:true,changed:true,assertion:{passed:false,failures:['unchanged result']}}))}]}}
 const d=createDebugSession({runner,artifactRoot:'artifacts/task-experience-p0/unit-debug'})
 assert.equal((await d.test({source,steps})).status,'failed')
 assert.equal((await d.test({source:source+' ',steps:[]})).status,'partial')
 assert.throws(()=>d.commit({version:d.snapshot().tests.at(-1).version}),/remain unverified/)
 const final=await d.test({source:source+' '},{final:true});assert.equal(final.status,'failed');assert.deepEqual(calls.at(-1),steps)
})

test('pure JS sort supports normal comparators without mutating shared source',()=>{
 const scope={data:{rows:[{v:3},{v:1},{v:2}]}}
 const result=evaluate(parseExpression('data.rows.sort((a,b)=>a.v-b.v)',{dialect:'js-v1'}),scope)
 assert.deepEqual(result.map(r=>r.v),[1,2,3]);assert.deepEqual(scope.data.rows.map(r=>r.v),[3,1,2])
 assert.deepEqual(evaluate(parseExpression('["b","a"].toSorted()',{dialect:'js-v1'}),{}),['a','b'])
 assert.throws(()=>parseExpression('data.rows.sort((a,b)=>{return a.v-b.v})',{dialect:'js-v1'}),/pure expression/)
 assert.throws(()=>evaluate(parseExpression('[1,2].sort((a,b)=>"x")',{dialect:'js-v1'}),{}),/finite number/)
})

test('compiler accepts both comparator locals and reduce with an implicit accumulator',()=>{
 const r=compileCard('<card><data id="rows" value={[{v:3},{v:1}]}/><derive id="ordered" value={data.rows.sort((rowA,rowB)=>rowA.v-rowB.v)}/><text id="result">{derived.ordered[0].v}</text></card>',{final:true,context:{expressionDialect:'js-v1'}})
 assert.deepEqual(r.diagnostics.filter(d=>d.severity==='error'),[])
 assert.equal(makeScope(r.spec,createStore()).derived.ordered[0].v,1)
 assert.equal(evaluate(parseExpression('[1,2,3].reduce((total,n)=>total+n)',{dialect:'js-v1'}),{}),6)
 assert.throws(()=>evaluate(parseExpression('[].reduce((total,n)=>total+n)',{dialect:'js-v1'}),{}))
})

test('selection joins reject group IDs used as entity IDs, but allow actual category joins',()=>{
 const compile=(field)=>compileCard(`<card><data id="rows" value={[{id:"a",category:"good"},{id:"b",category:"good"}]}/><state id="pick" type="string" initial=""/><derive id="shown" value={filter(data.rows,item.${field}==state.pick)}/><chart id="chart" kind="bar" data={[{id:"good",label:"Good",value:2}]} onSelect="pick"/><action id="pick"><set target="pick" value={event.id}/></action></card>`,{final:true}).spec
 assert.equal(selectionRelationDiagnostics(compile('id'))[0].code,'selection_relation_mismatch')
 assert.deepEqual(selectionRelationDiagnostics(compile('category')),[])
})
