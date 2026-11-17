import test from 'node:test'
import assert from 'node:assert/strict'
import {contentColumns,valueFontSize,editorialSpans,isCompactDecision} from '../src/cardspec/content-fit.mjs'
test('rich content gives up columns before readability; short choices keep columns',()=>{
 assert.equal(contentColumns(408,2,[260,240],12),1)
 assert.equal(contentColumns(620,2,[260,240],12),2)
 assert.equal(contentColumns(300,2,[132,132],8),2)
 assert.equal(contentColumns(250,2,[132,132],8),1)
 assert.equal(contentColumns(374,3,[150,146,150],8),2)
 assert.equal(contentColumns(408,3,[76,76,95],8),3)
 assert.equal(contentColumns(432,1,[76,76],8),1)
})
test('editorial rows pair peers only when readable, without splitting complex widgets',()=>{
 const prose={kind:'prose',minimum:240},stat={kind:'stat',minimum:90},widget={minimum:260}
 assert.deepEqual(editorialSpans(380,[widget,prose,widget,stat,stat]),[12,12,12,6,6])
 assert.deepEqual(editorialSpans(280,[prose,prose]),[12,12])
 assert.deepEqual(editorialSpans(620,[widget,prose,prose]),[12,6,6])
 assert.deepEqual(editorialSpans(380,[stat,prose,stat]),[12,12,12])
 assert.deepEqual(editorialSpans(380,[widget,widget]),[12,12])
})
test('numeric fit respects readable minimum and restores shorter values',()=>{
 assert.equal(valueFontSize(120,180,30),19.6)
 assert.equal(valueFontSize(30,180,30),14)
 assert.equal(valueFontSize(200,80,30),30)
 assert.equal(valueFontSize(120,180,12),12)
})

test('compact decisions exclude forms, long articles and multiple actions',()=>{
 const title={kind:'title',length:12},copy={kind:'copy',length:45},action={kind:'action',length:8}
 assert.equal(isCompactDecision([title,copy,action]),true)
 assert.equal(isCompactDecision([title,copy,copy,action]),true)
 assert.equal(isCompactDecision([title,{kind:'copy',length:181},action]),false)
 assert.equal(isCompactDecision([title,{kind:'other',length:10},action]),false)
 assert.equal(isCompactDecision([title,copy,action,action]),false)
 assert.equal(isCompactDecision([copy,copy,action]),false)
})
