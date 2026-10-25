import test from 'node:test'
import assert from 'node:assert/strict'
import {collectSentiment,normalizeVideoComments} from '../src/baseline/sentiment-sources.mjs'
import {attitudeStats,isFeedback,validateInsight} from '../src/baseline/insights.mjs'
import {isoDay} from '../src/baseline/core.mjs'
const video={title:'相关讨论',url:'https://www.bilibili.com/video/BVexample1',rowKey:'video'}
const body={rpid:'123',text:'不认可这辆车的制动表现',time:'2026-10-19 20:30',rowKey:'comment'}
test('empty/failed Weibo and XHS login wall fall back to bounded Bilibili comments',async()=>{
 const calls=[],call=async(t,input)=>{calls.push([t,input]);if(t.includes('weibo'))return {items:[]};if(t.includes('xiaohongshu'))throw Error('来源需要登录');if(t.endsWith('search'))return {items:[video]};return {items:[body]}}
 const result=await collectSentiment({query:'车辆 制动',sources:['微博反馈'],call})
 assert.deepEqual(calls.map(c=>c[0]),['opencli.weibo.search','opencli.xiaohongshu.search','opencli.bilibili.search','opencli.bilibili.comments'])
 assert.equal(result.records.filter(isFeedback).length,1);assert.equal(attitudeStats(result.records).total,1)
 assert.equal(result.records.find(isFeedback).parentTitle,video.title)
 assert.equal(result.records.find(isFeedback).url,video.url)
 assert.ok(result.coverage.some(r=>r.reason.includes('自动换源')))
})
test('XHS headline-only results never count as attitudes or stop fallback',async()=>{
 const result=await collectSentiment({query:'q',sources:['小红书线索'],call:async(t)=>t.includes('xiaohongshu')?{items:[{title:'喜欢某车',published_at:'2026-10-19',url:'https://example.com/n'}]}:t.includes('weibo')?{items:[]}:t.endsWith('search')?{items:[video]}:{items:[body]}})
 assert.equal(result.records.filter(isFeedback).length,1)
 const clue=result.records.find(r=>r.source==='小红书线索')
 assert.equal(clue.date,undefined);assert.match(clue.dateEvidence,/推算/)
 assert.throws(()=>validateInsight('sentiment',{labels:[{ref:clue.url,attitude:'正向',quote:clue.title}]},[clue]),/线索/)
})
test('working primary source, news-only and explicit opt-out do not invoke fallback',async()=>{
 for(const [sources,fallback,items]of [[['微博反馈'],true,[{id:'p',title:'正文'}]],[['新闻检索'],true,[]],[['微博反馈'],false,[]]]){
  const calls=[];await collectSentiment({query:'q',sources,fallback,call:async t=>{calls.push(t);return {items}}});assert.equal(calls.length,1)
 }
})
test('at most three videos; partial comment failures keep successes and visible coverage',async()=>{
 const calls=[],result=await collectSentiment({query:'q',sources:['B站评论'],call:async(t,input)=>{calls.push([t,input]);if(t.endsWith('search'))return {items:Array.from({length:6},(_,i)=>({...video,url:video.url+i,rowKey:'video'+i}))};if(input.bvid.endsWith('1'))throw Error('来源不可用');return {items:[body]}}})
 assert.equal(calls.length,4);assert.equal(result.records.filter(isFeedback).length,2)
 assert.equal(result.coverage.filter(c=>c.error).length,1)
 assert.match(result.coverage.at(-1).status,/非完整或随机/)
})
test('cancel aborts the chain; stale-only evidence cannot suppress fallback',async()=>{
 let calls=0;await assert.rejects(collectSentiment({query:'q',sources:['微博反馈'],call:async()=>{calls++;throw new DOMException('cancelled','AbortError')}}),{name:'AbortError'});assert.equal(calls,1)
 const result=await collectSentiment({query:'q',previousQuery:'q',previous:[{source:'微博反馈',rowKey:'old',title:'旧正文'}],sources:['微博反馈'],call:async t=>{if(t.includes('weibo'))throw Error('失败');if(t.includes('xiaohongshu'))return {items:[]};return {items:t.endsWith('search')?[video]:[body]}}})
 assert.equal(result.records.find(r=>r.rowKey==='old').stale,true);assert.equal(attitudeStats(result.records).total,1)
})
test('comment times retain true source day and duplicates do not inflate samples',async()=>{
 const normalized=normalizeVideoComments(video,[body]);assert.equal(isoDay(normalized[0].time),'2026-10-20')
 const result=await collectSentiment({query:'q',sources:['B站评论','B站评论'],call:async t=>({items:t.endsWith('search')?[video]:[body,body]})})
 assert.equal(result.records.filter(isFeedback).length,1)
})
test('comment endpoint failure retains old evidence as stale, never in fresh counts',async()=>{
 const prior=normalizeVideoComments(video,[body])
 const r=await collectSentiment({query:'q',previousQuery:'q',previous:prior,sources:['B站评论'],fallback:false,call:async t=>{if(t.endsWith('search'))return {items:[video]};throw Error('API failed')}})
 assert.equal(r.records.find(isFeedback).stale,true);assert.equal(attitudeStats(r.records).total,0)
})
