import test from 'node:test'
import assert from 'node:assert/strict'
import {matchRecordedSnapshot,RECORDED_REPLAY_MODE} from '../shared/cardspec/recorded-replay.mjs'
import {createDebugTransport} from '../shared/cardspec/debug-fixtures.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {TOOLS} from '../shared/cardspec/tools.mjs'

const metadata={replay:{mode:'ordered-prefix-v1',limitField:'limit',itemsPath:['items'],truncatedPath:['truncated'],returnedPath:['coverage','returned'],completePath:['coverage','complete']}}
const fixture=(tool='test.documents')=>({tool,input:{query:'amber',language:'en',sort:'rank',page:1,limit:4},metadata:structuredClone(metadata),value:{items:[{id:'r1'},{id:'r2'},{id:'r3'},{id:'r4'}],truncated:true,source:'recorded-source',fetchedAt:'2026-11-17T00:00:00Z',coverage:{complete:false,total:20,matched:20,returned:4}}})
const request=(record,input={})=>({tool:record.tool,input:{...record.input,...input},target:'binding'})
test('exact replay stays exact; prefix permission is explicit and never inferred from numbers or names',()=>{
 const record=fixture(),copy=structuredClone(record)
 assert.equal(matchRecordedSnapshot([record],request(record)).match,'exact')
 assert.equal(matchRecordedSnapshot([record],request(record,{limit:2})),null)
 assert.equal(matchRecordedSnapshot([{...record,metadata:undefined}],request(record,{limit:2}),{allowPrefix:true}),null)
 for(const input of [{query:'opal',limit:2},{language:'zh',limit:2},{sort:'date',limit:2},{page:2,limit:2},{offset:1,limit:2},{limit:'2'},{limit:0}])assert.equal(matchRecordedSnapshot([record],request(record,input),{allowPrefix:true}),null)
 assert.deepEqual(record,copy)
})
test('authorized smaller and larger limits return only the real known ordered prefix and explicit incomplete coverage',()=>{
 const record=fixture(),copy=structuredClone(record)
 const small=matchRecordedSnapshot([record],request(record,{limit:2}),{allowPrefix:true})
 assert.deepEqual(small.value.items,[{id:'r1'},{id:'r2'}]);assert.equal(small.value.truncated,true);assert.equal(small.value.coverage.returned,2)
 const larger=matchRecordedSnapshot([record],request(record,{limit:6}),{allowPrefix:true})
 assert.deepEqual(larger.value.items,record.value.items);assert.equal(larger.value.truncated,true)
 assert.deepEqual(larger.snapshotCoverage,{requested:6,returned:4,complete:false,mode:'recorded-live',recordedLimit:4,available:4})
 small.value.items[0].id='mutated';assert.deepEqual(record,copy)
})
test('known complete capture can remain complete, while slicing marks incomplete; unsafe/missing semantic paths do not match',()=>{
 const record=fixture();record.value.truncated=false;record.value.coverage.complete=true
 assert.equal(matchRecordedSnapshot([record],request(record,{limit:6}),{allowPrefix:true}).snapshotCoverage.complete,true)
 const small=matchRecordedSnapshot([record],request(record,{limit:2}),{allowPrefix:true});assert.equal(small.value.coverage.complete,false)
 for(const patch of [{itemsPath:['missing']},{truncatedPath:['missing']},{limitField:'page'},{itemsPath:['__proto__']},{mode:'guessed'}]){
  const r=structuredClone(record);Object.assign(r.metadata.replay,patch)
  assert.equal(matchRecordedSnapshot([r],request(record,{limit:2}),{allowPrefix:true}),null)
 }
})
const actual=()=>{
 const record=fixture('opencli.douban.movie-hot');record.input={limit:4};return record
}
test('strict debug replay never fabricates normal responses; explicit faults stay separate and legacy stays synthetic',async()=>{
 const record=actual(),calls=[],coverage=[]
 const transport=createDebugTransport({snapshots:[record],calls,coverage,replayMode:RECORDED_REPLAY_MODE})
 const matched=await transport(request(record,{limit:6}));assert.deepEqual(matched.value.items,record.value.items);assert.equal(matched.snapshotCoverage.complete,false);assert.equal(calls[0].match,'ordered-prefix')
 await assert.rejects(createDebugTransport({replayMode:RECORDED_REPLAY_MODE})(request(record)),e=>e.code==='DEBUG_REPLAY_MISS')
 // Frozen r3 originally asserted DEBUG_REPLAY_MISS here even with a matching
 // snapshot. r3-fault-audit.json preserves that failure and its independent
 // reproduction: explicit fault injection is not a normal synthetic fallback.
 const faultCalls=[]
 const empty=await createDebugTransport({snapshots:[record],scenario:'empty',calls:faultCalls,replayMode:RECORDED_REPLAY_MODE})(request(record))
 assert.deepEqual(empty.value.items,[]);assert.equal(empty.dataMode,'simulated-empty');assert.equal(faultCalls[0].mode,'simulated-empty')
 await assert.rejects(createDebugTransport({snapshots:[record],scenario:'failure',calls:faultCalls,replayMode:RECORDED_REPLAY_MODE})(request(record)),e=>e.code==='PROVIDER_ERROR'&&e.message==='DEBUG_SIMULATED_FAILURE'&&e.mode==='simulated-failure')
 assert.equal(faultCalls[1].mode,'simulated-failure')
 for(const scenario of ['empty','failure'])await assert.rejects(createDebugTransport({scenario,replayMode:RECORDED_REPLAY_MODE})(request(record)),e=>e.code==='DEBUG_REPLAY_MISS')
 const old=await createDebugTransport()(request(record));assert.equal(old.value.source,'DEBUG_MOCK_NOT_EVIDENCE')
})
test('generation read and debug receive identical replay values; partial snapshot coverage reaches model summary and saved records',async()=>{
 const record=actual(),payload=request(record,{limit:6}),match=matchRecordedSnapshot([record],payload,{allowPrefix:true})
 const generation=createGenerationTools({catalog:[{...TOOLS[record.tool],available:true}],enabled:true,goal:'Read candidates',allowPlanning:false,invoke:async p=>{const m=matchRecordedSnapshot([record],p,{allowPrefix:true});return {kind:'json',value:m.value,snapshotCoverage:m.snapshotCoverage}}})
 const result=await generation.execute('cli_read',{id:record.tool,input:payload.input},new AbortController().signal)
 assert.deepEqual(result.snapshotCoverage,match.snapshotCoverage)
 assert.deepEqual(generation.records()[0].value,match.value)
 assert.deepEqual(generation.records()[0].snapshotCoverage,match.snapshotCoverage)
 const replay=await createDebugTransport({snapshots:[record],replayMode:RECORDED_REPLAY_MODE})(payload)
 assert.deepEqual(replay.value,generation.records()[0].value)
})
