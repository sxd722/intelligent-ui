import test from 'node:test'
import assert from 'node:assert/strict'
import {detailPresentation,detailRequests} from '../shared/cardspec/result-view.mjs'
import {validateToolInput} from '../shared/cardspec/tools.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {DETAIL_FIXTURES} from '../shared/cardspec/detail-fixtures.mjs'
import {collectionTitle} from '../shared/cardspec/collection.mjs'
test('field/value sheets become entity fields, explicit null/zero/false survive and duplicate fields are retained',()=>{
 const m=detailPresentation({name:'A',score:5},{items:[{field:'score',value:null},{field:'models',value:0},{field:'open',value:false},{field:'brand',value:'A'},{field:'brand',value:'B'},{field:'series_id',value:'42'}]})
 assert.equal(m.metrics.find(x=>x.key==='models').value,0);assert.equal(m.facts.find(x=>x.key==='score').value,null);assert.equal(m.facts.find(x=>x.key==='open').value,false)
 assert.deepEqual(m.facts.filter(x=>x.key==='brand').map(x=>x.value),['A','B']);assert.equal(m.technical[0].value,'42');assert.ok(!m.facts.some(x=>['field','value'].includes(x.key)))
})
test('flat movie and restaurant results share grouping, with unknown/nested fields retained',()=>{
 const m=detailPresentation({title:'电影',rating:5},{items:[{rating:8.5,summary:'long'.repeat(80),genres:['科幻'],custom:{nested:'fact'},id:'x',url:'https://example.com'}]})
 assert.equal(m.metrics[0].value,8.5);assert.equal(m.narrative[0].value.length,320);assert.deepEqual(m.facts.find(x=>x.key==='custom').value,{nested:'fact'});assert.equal(m.technical.length,2)
})
test('independent detail records are grouped rather than mixing their scores',()=>{
 const m=detailPresentation({title:'对比'},{items:[{name:'A',score:2},{name:'B',score:4}]})
 assert.equal(m.metrics.length,0);assert.deepEqual(m.records.map(x=>[x.title,x.metrics[0].value]),[['A',2],['B',4]])
})
test('missing details retain list facts; all three fixture contracts compile and detail requests validate',()=>{
 assert.equal(collectionTitle({id:'row:opaque',user:'评价者'}),'评价者')
 assert.equal(detailPresentation({id:'row:opaque',author:'作者',content:'评论',score:0}).title,'作者')
 assert.equal(detailPresentation({title:'A',rating:0},{items:[]}).metrics[0].value,0)
 for(const f of Object.values(DETAIL_FIXTURES))assert.equal(compileCard(f.source,{final:true}).complete,true)
 for(const [tool,row] of [['opencli.dongchedi.search',{series_id:'42'}],['opencli.dianping.search',{shop_id:'demo'}],['opencli.douban.search',{id:'42',type:'book'}]])for(const request of detailRequests(tool,row))validateToolInput(request.tool,request.input)
})
