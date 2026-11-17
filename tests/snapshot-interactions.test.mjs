import test from 'node:test'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {snapshotInteractionDiagnostics} from '../shared/cardspec/snapshot-interactions.mjs'
import {createDebugTransport} from '../shared/cardspec/debug-fixtures.mjs'
const tool='opencli.archive.search',input={query:'nature',limit:3},value={items:[{identifier:'real-id',rowKey:'row:1',title:'Actual'}],source:'archive',fetchedAt:'2026-11-10T01:00:00Z',truncated:false},records=[{tool,input,value}]
const source=field=>`<card><binding id="feed" tool="${tool}" input={${JSON.stringify(input)}} load="visible"/><state id="pick" type="string" initial=""/><each items={bindings.feed.value?.items??[]} as="entry"><button onPress="choose" args={entry}>{entry.title}</button></each><action id="choose"><set target="pick" value={args.${field}}/><invoke binding="feed"/></action></card>`
test('real field shape rejects invented IDs without executing effects or modifying snapshots',()=>{
 const bad=compileCard(source('id'),{final:true,context:{expressionDialect:'js-v1'}}).spec
 assert.equal(snapshotInteractionDiagnostics(bad,records)[0].code,'snapshot_action_invalid')
 const good=compileCard(source('identifier'),{final:true,context:{expressionDialect:'js-v1'}}).spec
 assert.deepEqual(snapshotInteractionDiagnostics(good,records),[]);assert.equal(records[0].value.items[0].id,undefined)
})
test('offline debug replays only exact requests; empty/failure scenarios remain synthetic',async()=>{
 const calls=[],p={tool,input,target:'binding'},r=await createDebugTransport({snapshots:records,calls})(p)
 assert.deepEqual(r.value,value);assert.equal(calls[0].snapshot,true)
 r.value.items[0].identifier='changed';assert.equal(value.items[0].identifier,'real-id')
 const empty=await createDebugTransport({snapshots:records,scenario:'empty'})(p);assert.equal(empty.value.items.length,0)
 const other=await createDebugTransport({snapshots:records})({...p,input:{query:'other',limit:3}});assert.equal(other.value.items[0].id,undefined)
})
