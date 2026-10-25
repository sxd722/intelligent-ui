import test from 'node:test'
import assert from 'node:assert/strict'
import {collectionPage,collectionRows} from '../shared/cardspec/collection.mjs'

test('both card sizes expose every candidate exactly once through paging',()=>{
 const rows=Array.from({length:11},(_,id)=>({id,title:`Item ${id}`}))
 for(const size of ['square','auto']){
  const seen=[],view={pageStart:0}
  for(let i=0;i<20;i++){
   const p=collectionPage(rows.length,view,size);seen.push(...rows.slice(p.start,p.end).map(r=>r.id))
   if(p.page===p.count-1)break
   view.pageStart=p.end
  }
  assert.deepEqual(seen,rows.map(r=>r.id))
 }
})
test('resizing and serialized restoration retain the current row anchor',()=>{
 for(const anchor of [0,2,4,6,8]){
  const view=JSON.parse(JSON.stringify({pageStart:anchor,selected:'saved-id'}))
  for(const size of ['square','auto']){
   const p=collectionPage(11,view,size);assert.ok(p.start<=anchor&&anchor<p.end)
   assert.equal(view.selected,'saved-id');assert.equal(view.pageStart,anchor)
  }
 }
 // Legacy snapshots were four-row pages, even when the saved card was square.
 assert.equal(collectionPage(12,{page:2},'square').start,8)
})
test('smaller/empty filtered results clamp display without destroying saved browsing state',()=>{
 const rows=[{id:'a',title:'Park'},{id:'b',title:'Museum'}],view={pageStart:8,query:'museum',selected:'a'}
 const filtered=collectionRows(rows,view)
 const p=collectionPage(filtered.length,view,'square')
 assert.deepEqual(filtered.map(r=>r.id),['b']);assert.equal(p.start,0)
 assert.equal(collectionPage(0,view,'square').page,0)
 assert.equal(view.pageStart,8);assert.equal(view.selected,'a')
})
