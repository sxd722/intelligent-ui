import test from 'node:test'
import assert from 'node:assert/strict'
import {projectToolRows,resolveSlotEntity,formatSlot,decorateToolRows} from '../shared/cardspec/tool-slots.mjs'
import {collectionFields,collectionFacts,collectionTitle} from '../shared/cardspec/collection.mjs'
import {detailPresentation} from '../shared/cardspec/result-view.mjs'
test('forecast owns labels, units, missing semantics and retains all fields by reference',()=>{
 const raw={date:'2026-11-03',description:'小雨',avgTempC:0,minTempC:-3,maxTempC:null,debug:{secret:'not for display'}}
 const p=projectToolRows('opencli.wttr.forecast',[raw]),r=p.items[0]
 assert.equal(p.ok,true);assert.equal(r.raw,undefined);assert.equal(p.records[r.rawRef],raw)
 const facts=collectionFacts(r,['raw','avgTempC','fake'])
 assert.deepEqual(facts.map(f=>[f.label,f.text]),[['天气','小雨'],['平均温度','0°C'],['最低温度','-3°C'],['最高温度','未提供']])
 assert.equal(r.entityId,null);assert.ok(r.viewKey)
 assert.equal(resolveSlotEntity(p,r).raw,raw)
 assert.throws(()=>resolveSlotEntity(p,{...r,entityId:'fake'}),/STALE/)
})
test('train business ID is never view key or public train code; dates remain in original context',()=>{
 const row={rowKey:'UI1',train_no:'550000G1',code:'G1',start_time:'14:00',arrive_time:'15:00',second_seat:'无'}
 const p=projectToolRows('opencli.12306.trains',[row,{...row,rowKey:'UI2'}])
 assert.equal(p.items[0].entityId,'550000G1');assert.notEqual(p.items[0].viewKey,p.items[1].viewKey)
 assert.deepEqual(collectionFacts(p.items[0]).map(f=>f.text),['14:00','15:00','无'])
 assert.equal(projectToolRows('opencli.12306.trains',[{...row,train_no:null}]).items[0].entityId,null)
})
test('keys survive reorder and distinguish duplicate entities without inventing business identifiers',()=>{
 const a={dimension:'A',score:0},b={dimension:'B',score:-1}
 const x=projectToolRows('opencli.dongchedi.score',[a,b]),y=projectToolRows('opencli.dongchedi.score',[b,a])
 assert.equal(x.items[0].viewKey,y.items[1].viewKey);assert.equal(x.items[0].entityId,null)
 assert.equal(new Set(projectToolRows('opencli.dongchedi.score',[a,a]).items.map(x=>x.viewKey)).size,2)
})
test('field drift and invalid numeric types are explicit; no fuzzy correction or fabricated zero',()=>{
 assert.equal(projectToolRows('unknown',[]).ok,false)
 assert.equal(projectToolRows('unknown',[{status:'ok'}],{fields:[]}).code,'SLOTS_UNMAPPED')
 assert.equal(projectToolRows('opencli.wttr.forecast',[{renamed:'today'}]).code,'SLOTS_TITLE')
 const p=projectToolRows('opencli.wttr.forecast',[{date:'today',avgTempC:'18 F'}])
 assert.equal(p.diagnostics[0].code,'SLOT_TYPE');assert.equal(formatSlot(p.items[0].$display.fields[1]),'格式待核对')
})
test('default and explicit candidate fields do not leak nested raw objects or technical references',()=>{
 const rows=[{id:'1',title:'A',rating:0,raw:{id:'sensitive'},rawRef:'ref',viewKey:'v',entityId:'entity',details:{a:1}}]
 assert.deepEqual(collectionFields(rows),['rating'])
 assert.deepEqual(collectionFields(rows,['raw','rawRef','details','bogus','rating']),['rating'])
 assert.equal(collectionFacts(rows[0],['rating'])[0].text,'0')
 const model=detailPresentation(rows[0]);assert.equal(model.facts.some(f=>f.key==='raw'),false)
})
test('decorating projected rows is idempotent and raw action fields remain unchanged',()=>{
 const raw={rowKey:'ui',id:'movie-id',title:'A',rating:8,year:2026,genres:'科幻'}
 const projected=projectToolRows('opencli.douban.top250',[raw]).items
 assert.deepEqual(decorateToolRows('opencli.douban.top250',projected),projected)
 const decorated=decorateToolRows('opencli.douban.top250',[raw])[0]
 assert.equal(decorated.id,raw.id);assert.equal(decorated.rowKey,raw.rowKey)
 assert.equal(decorated.$display.entityId,raw.id)
 const metric=decorateToolRows('opencli.dongchedi.score',[{rowKey:'UI',dimension:'舒适性',score:4}])[0]
 assert.equal(collectionTitle(metric),'舒适性')
 assert.equal(projectToolRows('__proto__',[]).ok,false)
})
