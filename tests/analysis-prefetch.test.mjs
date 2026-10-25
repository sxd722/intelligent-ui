import test from 'node:test'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {prefetchedInvocation,liveDatasetContext} from '../shared/cardspec/prefetch.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {newPage,createCardSession} from '../src/cardspec/tool-session.mjs'
const rows=[{id:'a',rowKey:'a',title:'A',content:'喜欢这个设计'}],instruction='按原句分类',updatedAt='2026-10-21T00:00:00Z'
const raw={id:'D1',tool:'opencli.douban.top250',input:{limit:1},value:{items:rows,source:'test',fetchedAt:updatedAt,truncated:false},updatedAt}
const value={...raw.value,items:[{...rows[0],analysisLabel:'正面',analysisQuote:'喜欢这个设计'}],analysis:{dataset:{id:'D1'}}}
const old={id:'D2',tool:'dataset_analyze',input:{dataset:'D1',instruction},value,updatedAt}
function spec(records,query=instruction){
 const source=`<card><binding id="analysis" tool="dataset.analyze" input={{items:bindings.raw.value.items,instruction:${JSON.stringify(query)}}} initial={{items:[],source:"",fetchedAt:"",truncated:false}}/><binding id="raw" tool="opencli.douban.top250" load="visible" input={{limit:1}} initial={{items:[],source:"",fetchedAt:"",truncated:false}}/><text>{bindings.analysis.value.items.length}</text></card>`
 const compiled=compileCard(source,{final:true});assert.equal(compiled.complete,true,JSON.stringify(compiled.diagnostics))
 compiled.spec.prefetched=records;compiled.spec.context.datasets={D1:raw.value,D2:value};return compiled.spec
}
test('legacy analysis prefetch hydrates before source declaration without extra calls',()=>{
 let calls=0;const session=createCardSession(spec([raw,old]),{transport:async()=>{calls++;throw Error('should not invoke')}})
 session.setActivity({visible:true,complete:true});assert.equal(calls,0)
 assert.equal(session.current().bindings.analysis.status,'success')
 assert.deepEqual(session.current().bindings.analysis.value.items,value.items)
 const context=liveDatasetContext(session.current().spec,session.current().bindings);assert.deepEqual(context.datasets.D2.items,value.items)
 session.dispose()
})
test('changed classification instructions or source records cannot reuse old analysis',()=>{
 assert.equal(newPage(spec([raw,old],'different instruction')).bindings.analysis,undefined)
 const changed=structuredClone(raw);changed.value.items[0].content='不同的原文'
 assert.equal(prefetchedInvocation(old,[changed,old]),null)
 assert.equal(newPage(spec([changed,old])).bindings.analysis,undefined)
 assert.equal(prefetchedInvocation(old,[old]),null)
})
test('new generation stores the materialized invocation in the same contract as runtime bindings',async()=>{
 let calls=0
 const tools=createGenerationTools({initialRecords:[raw],budget:{policy:{profile:'adaptive-v1'}},analyze:async()=>{calls++;return {annotations:[{id:'a',label:'正面',quote:'喜欢这个设计'}]}}})
 await tools.execute('dataset_analyze',{dataset:'D1',instruction},new AbortController().signal)
 await tools.execute('dataset_analyze',{dataset:'D1',instruction},new AbortController().signal)
 assert.equal(calls,1)
 const saved=tools.records().at(-1);assert.equal(saved.tool,'dataset.analyze');assert.deepEqual(saved.input,{items:rows,instruction})
 assert.equal(newPage(spec(tools.records())).bindings.analysis.value.items[0].analysisLabel,'正面')
})
