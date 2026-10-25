import {test} from 'node:test'
import assert from 'node:assert/strict'
import {selectTrainRows,validateTrainWindow} from '../server/tools/12306-query.mjs'
import {normalizeOpenCli,openCliInput} from '../server/tools/opencli.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createBoundBrowser} from '../server/tools/opencli-bound.mjs'
const route={from:'杭州东',to:'上海南',date:'2026-10-14',departureAfter:'12:00',departureBefore:'18:00',limit:2}
const station={code:'HGH'},destination={code:'SNH'}
const row=(start_time,other={})=>({train_no:'same',code:'G1',from_code:'HGH',to_code:'SNH',from_station:'杭州东',to_station:'上海南',departure_date:route.date,start_time,second_seat:'无',available:true,...other})
test('station and half-open time filters run before limit over the complete response',()=>{
 const rows=[...Array.from({length:120},()=>row('11:30')),row('12:00',{to_code:'AOH'}),row('12:00'),row('13:00'),row('17:59'),row('18:00')]
 const r=selectTrainRows(rows,route,station,destination)
 assert.deepEqual(r.rows.map(x=>x.start_time),['12:00','13:00']);assert.equal(r.coverage.matched,3);assert.equal(r.truncated,true)
 const all=selectTrainRows(rows,{...route,limit:100},station,destination);assert.equal(all.rows.length,3);assert.equal(all.truncated,false)
 const empty=selectTrainRows(rows,{...route,departureAfter:'20:00',departureBefore:'24:00'},station,destination);assert.equal(empty.coverage.matched,0);assert.equal(empty.coverage.complete,true)
 assert.equal(selectTrainRows(rows,{...route,exactStations:false,limit:100},station,destination).rows.length,4)
})
test('time validation rejects malformed or reversed ranges before dispatch',()=>{
 for(const r of [{departureAfter:'9:00'},{departureBefore:'25:00'},{departureAfter:'18:00',departureBefore:'12:00'}])assert.throws(()=>validateTrainWindow(r))
 assert.equal(openCliInput('opencli.12306.trains',{...route,limit:100}).limit,100)
 assert.throws(()=>openCliInput('opencli.12306.trains',{...route,limit:101}))
})
test('composite result identity survives reorder and seat updates, separates route and date',()=>{
 const a=row('12:00'),b=row('12:00',{to_station:'上海虹桥'}),c=row('12:00',{departure_date:'2026-10-15'})
 const original=normalizeOpenCli('opencli.12306.trains',[a,b,c]).items
 const changed=normalizeOpenCli('opencli.12306.trains',[c,{...b,second_seat:'有'},a]).items
 assert.equal(new Set(original.map(r=>r.rowKey)).size,3)
 assert.deepEqual(original.map(r=>r.rowKey),changed.reverse().map(r=>r.rowKey))
 assert.equal(original[0].available,true);assert.equal(original[0].second_seat,'无')
 assert.equal(normalizeOpenCli('opencli.12306.trains',[{...a,hard_seat:''}]).items[0].hard_seat,null)
})
test('coverage differentiates proven empty from capped upstream data across tools',()=>{
 assert.equal(normalizeOpenCli('opencli.steam.search',[{id:'1'},{id:'2'}],{limit:2}).truncated,true)
 const r=normalizeOpenCli('opencli.12306.trains',selectTrainRows([row('12:00')],route,station,destination),route)
 assert.equal(r.coverage.matched,1);assert.equal(r.truncated,false)
})
test('compiler catches tool identities through filtered aliases despite empty initial arrays',()=>{
 for(const tool of ['opencli.12306.trains','opencli.steam.search','opencli.apple-podcasts.search']){
 const input=tool.endsWith('trains')?'from:"杭州东",to:"上海南",date:"2026-10-14"':'query:"test"'
 const source=`<card schemaVersion="1"><binding id="q" tool="${tool}" input={{${input}}} initial={{items:[],source:"",fetchedAt:"",truncated:false}}/><derive id="rows" value={filter(bindings.q.value.items,true)}/><each items={derived.rows} as="r" itemKey={r.id}><text>{r.title}</text></each></card>`
 const normalized=compileCard(source,{final:true})
 assert.equal(normalized.complete,true)
 assert.ok(normalized.diagnostics.some(d=>d.code==='tool_identity_normalized'))
 const interactive=compileCard(source.replace('<text>{r.title}</text>','<button onPress="pick" args={{id:r.id}}>{r.title}</button>').replace('</card>','<state id="pick" type="string" initial=""/><action id="pick"><set target="pick" value="yes"/></action></card>'),{final:true})
 assert.equal(interactive.complete,true)
 assert.ok(interactive.diagnostics.some(d=>d.code==='tool_identity_normalized'))
 assert.equal(interactive.spec.children[0].children[0].props.args.entries[0][1].key.value,'id')
 assert.equal(compileCard(source.replace('itemKey={r.id}','itemKey={r.rowKey}'),{final:true}).complete,true)
 }
 const local='<card schemaVersion="1"><data id="rows" value={[{id:"a"}]}/><each items={data.rows} itemKey={item.id}><text>A</text></each></card>'
 assert.equal(compileCard(local,{final:true}).complete,true)
})
test('handoff restores only a verified existing lease without binding or navigation',async()=>{
 const calls=[],host=createBoundBrowser(async(op,lease)=>{calls.push(op);assert.equal(lease.page,'original')})
 const saved={session:'cardspec-bound-test',profile:'p',daemonPid:42,page:'original'}
 await host.restore(saved);assert.deepEqual(calls,['check']);assert.equal(host.status({profile:'p',daemonPid:42}).bound,true)
 const broken=createBoundBrowser(async()=>{throw Error('stale daemon')});await assert.rejects(()=>broken.restore(saved),/stale daemon/);assert.equal(broken.status({}).bound,false)
})
test('harness reports late filters and raw boolean display together before live data arrives',()=>{
 const source='<card schemaVersion="1"><binding id="q" tool="opencli.12306.trains" input={{from:"杭州东",to:"上海南",date:"2026-10-14"}} initial={{items:[],source:"",fetchedAt:"",truncated:false}}/><derive id="rows" value={filter(bindings.q.value.items,item.start_time>="12:00")}/><derive id="selected" value={find(bindings.q.value.items,true) ?? {}}/><each items={derived.rows} itemKey={item.rowKey}><caption>余票：{item.available==null?"未知":item.available}</caption></each><text>{derived.selected.available}</text></card>'
 const r=compileCard(source,{final:true});assert.ok(r.diagnostics.some(d=>d.code==='tool_filter'));assert.ok(r.diagnostics.some(d=>d.code==='tool_field_type'))
 const good=source.replace('date:"2026-10-14"','date:"2026-10-14",departureAfter:"12:00",departureBefore:"18:00"').replaceAll('.available','.second_seat')
 assert.equal(compileCard(good,{final:true}).complete,true)
 const flag=good.replace('余票：{item.second_seat==null?"未知":item.second_seat}','预订入口：{item.bookable?"开放":"关闭"}')
 assert.equal(compileCard(flag,{final:true}).complete,true)
})
test('harness catches a search identity used to locate another tool detail result',()=>{
 const source='<card schemaVersion="1"><binding id="search" tool="opencli.steam.search" input={{query:"a"}} initial={{items:[],source:"",fetchedAt:"",truncated:false}}/><binding id="detail" tool="opencli.steam.app" input={{id:"1"}} initial={{items:[],source:"",fetchedAt:"",truncated:false}}/><state id="pick" type="string" initial=""/><action id="pick"><set target="pick" value={args.key}/></action><derive id="detail" value={find(bindings.detail.value.items,item.rowKey==state.pick) ?? null}/><each items={bindings.search.value.items} itemKey={item.rowKey}><button onPress="pick" args={{key:item.rowKey}}>选择</button></each></card>'
 assert.ok(compileCard(source,{final:true}).diagnostics.some(d=>d.code==='tool_identity_scope'))
 assert.ok(!compileCard(source.replace('find(bindings.detail.value.items,item.rowKey==state.pick)','bindings.detail.value.items[0]'),{final:true}).diagnostics.some(d=>d.code==='tool_identity_scope'))
})
