import test from 'node:test'
import assert from 'node:assert/strict'
import {validateJson} from '../shared/cardspec/tools.mjs'
import {rowId,compactRows,insightRequest,validateInsight,attitudeStats,coordinates,mapLayout} from '../src/baseline/insights.mjs'
import {insightFixture} from '../src/baseline/insight-fixtures.mjs'
const rows=[{id:'a',source:'微博反馈',title:'我很满意车辆的表现',time:'2026-10-19'},{id:'b',source:'微博反馈',title:'我对车辆售后不满意',time:'2026-10-20'},{id:'c',source:'微博反馈',title:'信息不足',time:'未知'}]
test('bounded contexts and actual numeric source fields survive summarization',()=>{
 const r=insightRequest('overview',Array.from({length:100},(_,i)=>({id:String(i),title:'x'.repeat(1000),content:'长'.repeat(3000),start_time:'13:20',second_seat:'有'})))
 assert.equal(r.context.rows.length,24);assert.equal(r.context.rows[0].body.length,480);assert.equal(r.context.rows[0].facts.start_time,'13:20');assert.ok(JSON.stringify(r).length<24000)
})
test('model labels require exact evidence and unique valid refs; news cannot become an opinion',()=>{
 const value=insightFixture('sentiment',rows),input=insightRequest('sentiment',rows)
 validateJson(value,input.schema);validateInsight('sentiment',value,rows)
 for(const mutate of [v=>v.labels.push(v.labels[0]),v=>v.labels[0].ref='invented',v=>v.labels[0].quote='编造的引文']){const v=structuredClone(value);mutate(v);assert.throws(()=>validateInsight('sentiment',v,rows))}
 const news={id:'n',source:'新闻检索',title:'车辆报道'}
 assert.throws(()=>validateInsight('sentiment',{labels:[{ref:rowId(news),attitude:'负向',quote:'车辆报道'}]},[news]),/新闻/)
})
test('counts and daily distributions come from labels, leave missing dates and labels explicit',()=>{
 const value=validateInsight('sentiment',insightFixture('sentiment',rows),rows)
 const stats=attitudeStats([...rows,{id:'n',source:'新闻检索'},{id:'s',source:'微博反馈',stale:true},{id:'z',source:'微博反馈'}],value)
 assert.equal(stats.total,4);assert.equal(stats.counts.正向,1);assert.equal(stats.counts.负向,1);assert.equal(stats.counts.未分析,1);assert.equal(stats.unknownDates,2);assert.equal(stats.days.length,2)
})
test('family planner must cover exactly selected POIs, no duplicate slots or invented places',()=>{
 const selected=rows.slice(0,2),v=insightFixture('family',selected)
 validateJson(v,insightRequest('family',selected).schema);validateInsight('family',v,selected)
 assert.throws(()=>validateInsight('family',{...v,slots:v.slots.slice(0,1)},selected),/全部/)
 assert.throws(()=>validateInsight('family',{...v,slots:v.slots.map(s=>({...s,period:0}))},selected),/重复/)
})
test('map does not invent missing/invalid coordinates, bounds mapped points and tile count',()=>{
 assert.equal(coordinates({lat:null,lon:120}),null);assert.equal(coordinates({lat:100,lon:120}),null)
 const r=mapLayout([{id:'a',lat:30.15,lon:120.24},{id:'b',lat:30.19,lon:120.28},{id:'none'}]);assert.equal(r.missing,1);assert.equal(r.points.length,2);assert.ok(r.tiles.length<=6)
 for(const p of r.points){assert.ok(p.x>0&&p.x<340);assert.ok(p.y>0&&p.y<160)}
})
