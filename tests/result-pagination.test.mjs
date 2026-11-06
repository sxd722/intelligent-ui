import test from 'node:test'
import assert from 'node:assert/strict'
import {resultPage,resultCoverage,assertResultRows} from '../shared/cardspec/result-pagination.mjs'
import {normalizeOpenCli} from '../server/tools/opencli.mjs'
import {normalizeFeed} from '../server/tools/autocli.mjs'
import {selectTrainRows} from '../server/tools/12306-query.mjs'
import {mapToolPresentation} from '../shared/cardspec/tool-presentations.mjs'
import {projectToolRows} from '../shared/cardspec/tool-slots.mjs'

test('host pagination traverses every returned row exactly once including the last short page',()=>{
 const rows=Array.from({length:139},(_,i)=>({id:String(i)})),seen=[]
 for(let p=0;p<resultPage(rows,0,3).pages;p++)seen.push(...resultPage(rows,p,3).items)
 assert.deepEqual(seen,rows)
 assert.equal(resultPage(rows,100,3).page,46)
 assert.equal(resultPage(rows,100,3).items.length,1)
 assert.deepEqual(resultPage([],9,3),{page:0,pages:1,items:[]})
})

test('rail filtering and normalization keep late matches beyond the former 8 and 100 caps',()=>{
 const rows=Array.from({length:139},(_,i)=>({code:'G'+i,train_no:'n'+i,start_time:i===138?'17:59':'12:00',from_code:'A',to_code:'B'}))
 const input={from:'A',to:'B',date:'2026-11-06',limit:8,departureAfter:'12:00',departureBefore:'18:00'}
 const selected=selectTrainRows(rows,input,{code:'A'},{code:'B'})
 const result=normalizeOpenCli('opencli.12306.trains',selected,input)
 assert.equal(result.items.length,139);assert.equal(result.items.at(-1).start_time,'17:59')
 assert.equal(result.coverage.returned,139);assert.equal(resultCoverage(result).partial,false)
 assert.equal(new Set(result.items.map(r=>r.rowKey)).size,139)
})

test('non-rail collections preserve all returned rows without pretending capped sources are complete',()=>{
 const rows=Array.from({length:130},(_,i)=>({id:String(i),title:'Item '+i,url:'https://example.org/'+i}))
 const search=normalizeOpenCli('opencli.steam.search',rows,{limit:20})
 assert.equal(search.items.length,130);assert.equal(resultCoverage(search).partial,true)
 assert.equal(normalizeFeed('autocli.hackernews.top',rows).items.length,130)
 assert.equal(resultCoverage({items:[],coverage:{complete:true,matched:0}}).partial,false)
 assert.equal(resultCoverage({items:rows,coverage:{complete:true,matched:150}}).partial,true)
 assert.throws(()=>assertResultRows(Array(5001)),/not silently discarded/)
})

test('display and task projections share the transport collection capacity',()=>{
 const rows=Array.from({length:601},(_,i)=>({id:String(i),title:'Movie '+i,rating:8,year:'2025'}))
 const value=normalizeOpenCli('opencli.douban.movie-hot',rows,{limit:20})
 const display=mapToolPresentation('opencli.douban.movie-hot',value),slots=projectToolRows('opencli.douban.movie-hot',value.items)
 assert.equal(display.ok,true);assert.equal(display.items.length,601)
 assert.equal(slots.ok,true);assert.equal(slots.items.length,601)
})
