import {existsSync} from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {canonicalInput,liveDatasetContext} from '../shared/cardspec/prefetch.mjs'
import {createStore,makeScope} from '../shared/cardspec/store.mjs'

const envelope=content=>({items:[{rowKey:'same-id',content}],source:'fixture',fetchedAt:'2026-10-21T00:00:00Z'})
function fixture(){
 const raw=envelope('Old'),input={items:raw.items,instruction:'classify'},analysis={...raw,items:raw.items.map(r=>({...r,analysisLabel:'positive',analysisQuote:'Old'})),analysis:{dataset:{id:'D1'},classified:1}}
 return {context:{datasets:{D1:raw,D2:analysis}},bindings:{feed:{tool:'read.fixture'},analyze:{tool:'dataset.analyze'}},prefetched:[{id:'D2',tool:'dataset.analyze',input,value:analysis},{id:'D1',tool:'read.fixture',input:{q:'x'},value:raw}]}
}
const committed=(value,input,status='success')=>({value,valueInputKey:canonicalInput(input),updatedAt:'2026-10-21T01:00:00Z',status})

test('changed content with the same ID invalidates annotations, independent of record order',()=>{
 const spec=fixture(),before=JSON.stringify(spec),ctx=liveDatasetContext(spec,{feed:committed(envelope('New'),{q:'x'})})
 assert.equal(ctx.datasets.D1.items[0].content,'New')
 assert.deepEqual(ctx.datasets.D2.items,[])
 assert.equal(ctx.datasets.D2.analysis.status,'stale')
 assert.equal(JSON.stringify(spec),before)
})
test('unchanged rows, other queries and failed initial refresh retain original analysis',()=>{
 const spec=fixture()
 for(const bindings of [{feed:committed(envelope('Old'),{q:'x'})},{feed:committed(envelope('Other query'),{q:'y'})},{feed:{status:'error',error:'offline'}}]){
  assert.equal(liveDatasetContext(spec,bindings).datasets.D2.items[0].analysisLabel,'positive')
 }
})
test('only analysis of the current exact rows restores annotations; failed refresh retains last committed current result',()=>{
 const spec=fixture(),fresh=envelope('New'),result={...fresh,items:fresh.items.map(r=>({...r,analysisLabel:'negative',analysisQuote:'New'}))}
 const feed=committed(fresh,{q:'x'})
 for(const status of ['success','error','loading']){
  const analyze=committed(result,{items:fresh.items,instruction:'classify'},status)
  assert.deepEqual(liveDatasetContext(spec,{feed,analyze}).datasets.D2,result)
 }
 const wrong=committed(result,{items:fresh.items,instruction:'another analysis'})
 assert.equal(liveDatasetContext(spec,{feed,analyze:wrong}).datasets.D2.analysis.status,'stale')
})
test('missing or mismatched provenance is not guessed from row IDs',()=>{
 const spec=fixture();spec.prefetched[0].value.analysis.dataset.id='unknown'
 assert.equal(liveDatasetContext(spec,{feed:committed(envelope('New'),{q:'x'})}).datasets.D2.items.length,1)
})
test('immutable R14 expressions no longer attach stale labels to changed live feedback',{skip: ["artifacts/javascript-upgrade/sentiment-r14-offline.json","artifacts/javascript-upgrade/deep-baselines-r14/sentiment.json"].every(existsSync) ? false : "Private historical replay artifacts excluded from source export"}, ()=>{
 const replay=JSON.parse(readFileSync('artifacts/javascript-upgrade/sentiment-r14-offline.json','utf8'))
 const original=JSON.parse(readFileSync('artifacts/javascript-upgrade/deep-baselines-r14/sentiment.json','utf8'))
 const spec={...replay.spec,prefetched:original.records},record=original.records.find(r=>r.id==='D2')
 const initial=makeScope(spec,createStore()).derived.labeled
 assert.ok(initial.some(r=>r.label!=='未分析'))
 const fresh={...record.value,items:record.value.items.map(r=>({...r,content:'changed source evidence'}))}
 const scope=makeScope(spec,createStore(),{bindings:{fb:committed(fresh,record.input)}})
 assert.equal(scope.derived.total,3)
 assert.ok(scope.derived.labeled.every(r=>r.label==='未分析'&&r.quote===''))
})
