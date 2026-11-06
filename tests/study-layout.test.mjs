import test from 'node:test'
import assert from 'node:assert/strict'
import {studyLayout} from '../shared/cardspec/study-layout.mjs'
import {STUDY_FIXTURES} from '../shared/cardspec/study-fixtures.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
test('spread caps natural height and keeps long titles in wider plates',()=>{
 const x=studyLayout({width:400,space:620,size:'auto',count:9,titles:['卡拉马佐夫兄弟','A very long English book title']})
 assert.equal(x.capacity,2);assert.ok(x.height<=410)
 assert.equal(studyLayout({width:400,space:300,count:3,titles:['太阳','星星','世界']}).capacity,3)
 assert.equal(studyLayout({width:280,space:180,count:7}).mode,'focus')
})
test('all entries reachable across width, height and count changes',()=>{
 for(const width of [280,320,400])for(const space of [160,230,300,620])for(const size of ['square','auto'])for(const count of [0,1,2,3,7,9]){
  const first=studyLayout({width,space,size,count}),seen=[]
  for(let page=0;page<first.pages;page++){
   const layout=studyLayout({width,space,size,count,start:page*first.capacity})
   for(let i=layout.start;i<layout.end;i++)seen.push(i)
  }
  assert.deepEqual(seen,Array.from({length:count},(_,i)=>i))
  const last=studyLayout({width,space,size,count,start:999})
  assert.ok(last.page<last.pages)
 }
})
test('study examples use existing valid CardSpec contract',()=>{
 for(const [name,source] of Object.entries(STUDY_FIXTURES)){
  const result=compileCard(source,{final:true,cardId:name})
  assert.deepEqual(result.diagnostics.filter(d=>d.severity==='error'),[],name)
 }
})
