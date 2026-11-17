import test from 'node:test'
import assert from 'node:assert/strict'
import {createDebugTransport} from '../shared/cardspec/debug-fixtures.mjs'
import {emptyRecordedList,RECORDED_REPLAY_MODE} from '../shared/cardspec/recorded-replay.mjs'

// Handwritten transport-only fixture: no model, recorded run edit, browser or CLI.
const record=()=>({tool:'opencli.douban.movie-hot',input:{limit:4},metadata:{replay:{mode:'ordered-prefix-v1',limitField:'limit',itemsPath:['items'],truncatedPath:['truncated'],returnedPath:['coverage','returned'],completePath:['coverage','complete']}},value:{items:[{id:'alpha',title:'A'},{id:'beta',title:'B'}],source:'fixture-capture',fetchedAt:'2026-11-17T00:00:00Z',truncated:true,coverage:{complete:false,total:10,matched:10,returned:2}}})
const request=(r,limit=4)=>({tool:r.tool,target:'binding',input:{limit}})

test('normal exact and authorized prefix remain real replay; explicit empty clones only list payload and never edits base',async()=>{
 const r=record(),before=structuredClone(r),calls=[],coverage=[]
 for(const limit of [4,8]){
  const normal=await createDebugTransport({snapshots:[r],replayMode:RECORDED_REPLAY_MODE})(request(r,limit))
  assert.deepEqual(normal.value.items,r.value.items);assert.equal(normal.value.truncated,true);assert.equal(normal.dataMode,undefined)
  const empty=await createDebugTransport({snapshots:[r],scenario:'empty',calls,coverage,replayMode:RECORDED_REPLAY_MODE})(request(r,limit))
  assert.deepEqual(empty.value.items,[]);assert.deepEqual(empty.value.coverage,{complete:true,total:0,matched:0,returned:0});assert.equal(empty.value.truncated,false)
  assert.equal(empty.dataMode,'simulated-empty');assert.equal(empty.value.source,r.value.source);assert.equal(empty.value.fetchedAt,r.value.fetchedAt)
  assert.equal(calls.at(-1).mode,'simulated-empty');assert.equal(calls.at(-1).snapshot,undefined);assert.equal(calls.at(-1).baseSnapshot,true)
 }
 assert.deepEqual(r,before);assert.equal(calls[1].match,'ordered-prefix');assert.equal(calls[1].baseSnapshotCoverage.complete,false)
 assert.ok(coverage.every(c=>c.mode==='simulated-empty'))
})

test('intentional failure has distinct mode/code; unknown requests still miss instead of receiving any fault result',async()=>{
 const r=record(),calls=[],coverage=[]
 await assert.rejects(createDebugTransport({snapshots:[r],scenario:'failure',calls,coverage,replayMode:RECORDED_REPLAY_MODE})(request(r)),e=>e.code==='PROVIDER_ERROR'&&e.mode==='simulated-failure'&&e.message==='DEBUG_SIMULATED_FAILURE')
 assert.equal(calls[0].mode,'simulated-failure');assert.equal(coverage[0].reason,'explicit fault injection')
 const unauthorized={...r,metadata:undefined}
 for(const scenario of ['normal','empty','failure'])await assert.rejects(createDebugTransport({snapshots:[unauthorized],scenario,replayMode:RECORDED_REPLAY_MODE})(request(r,8)),e=>e.code==='DEBUG_REPLAY_MISS')
})

test('non-list empty is explicitly unsupported, not a fabricated null/record/number response',()=>{
 for(const value of [{answer:42},{items:null},[],null,42])assert.throws(()=>emptyRecordedList({value}),e=>e.code==='DEBUG_UNSUPPORTED')
})

test('legacy non-strict normal/empty/failure semantics are unchanged',async()=>{
 const r=record(),calls=[]
 const normal=await createDebugTransport({snapshots:[r],calls})(request(r));assert.deepEqual(normal.value,r.value);assert.equal(calls[0].mode,undefined)
 const empty=await createDebugTransport({snapshots:[r],scenario:'empty',calls})(request(r));assert.deepEqual(empty.value.items,[]);assert.equal(empty.value.source,'DEBUG_MOCK_NOT_EVIDENCE');assert.equal(empty.dataMode,undefined)
 await assert.rejects(createDebugTransport({snapshots:[r],scenario:'failure',calls})(request(r)),e=>e.code==='PROVIDER_ERROR'&&e.message==='DEBUG_SIMULATED_FAILURE'&&!e.mode)
})
