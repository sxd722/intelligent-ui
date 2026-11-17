import test from 'node:test'
import assert from 'node:assert/strict'
import {chartDomain,chartTicks,axisNumber,axisLabel} from '../src/cardspec/chart-layout.mjs'
test('line domain reveals real variation; bars retain zero; flat/empty are finite',()=>{
 assert.deepEqual(chartDomain([{value:100},{value:110}]),{min:99,max:111})
 assert.deepEqual(chartDomain([{value:100},{value:110}],'bar'),{min:0,max:110})
 assert.deepEqual(chartDomain([{value:-5},{value:-10}],'bar'),{min:-10,max:0})
 assert.deepEqual(chartDomain([{value:0}]),{min:-1,max:1})
 assert.deepEqual(chartDomain([]),{min:0,max:1})
})
test('signed stacks accumulate positive and negative values separately',()=>{
 assert.deepEqual(chartDomain([{label:'a',value:5},{label:'a',value:3},{label:'a',value:-4},{label:'a',value:-2}],'stacked'),{min:-6,max:8})
})
test('sparse axis retains endpoints and never discards actual data',()=>{
 const data=Array.from({length:40},(_,i)=>({id:String(i),value:i}))
 for(const w of [180,280,320,432]){const t=chartTicks(data.length,w);assert.equal(t[0],0);assert.equal(t.at(-1),39);assert.ok(t.length<=5);assert.equal(new Set(t).size,t.length)}
 assert.deepEqual(chartTicks(1,320),[0]);assert.deepEqual(chartTicks(0,320),[]);assert.equal(data.length,40)
 assert.equal(axisLabel('2026-11-12T10:00'),'11-12');assert.equal(axisNumber(52486),'52.5k')
})

test("small variations keep distinct axis labels",()=>{assert.notEqual(axisNumber(100.001,.001),axisNumber(100.002,.001))})
