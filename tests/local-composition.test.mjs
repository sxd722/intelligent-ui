import test from 'node:test'
import assert from 'node:assert/strict'
import {localComposition,statPresentation} from '../src/cardspec/local-composition.mjs'
import {factChanges,validateEditorial} from '../shared/cardspec/editorial.mjs'
test('local visual peers share rows without overlapping subsequent content',()=>{
 const items=[{kind:'other'},{kind:'graphic',minimum:180},{kind:'choices',minimum:140},{kind:'facts'},{kind:'other'}]
 const p=localComposition(items,400)
 assert.equal(p.kind,'visual-facts')
 assert.deepEqual(p.cells.map(c=>c.row),['1','2 / span 2','2','3','4'])
 assert.equal(localComposition(items,320),null)
 assert.equal(localComposition([{kind:'graphic',minimum:300},{kind:'choices'}],400),null)
 assert.equal(localComposition([{kind:'graphic'},{kind:'other'},{kind:'facts'}],600),null)
})
test('choice detail stays in source order and narrow layouts remain linear',()=>{
 const items=[{kind:'other'},{kind:'choices',count:4,minimum:180},{kind:'detail'},{kind:'other'}]
 assert.deepEqual(localComposition(items,408).cells.map(c=>c.row),['1','2','2','3'])
 assert.equal(localComposition(items,300),null)
 assert.equal(localComposition([{kind:'choices',count:12},{kind:'detail'}],600),null)
})
test('metadata is compact without changing KPI values or explicit intent',()=>{
 assert.equal(statPresentation('2026-11-13'),'meta')
 assert.equal(statPresentation('09:00–11:00'),'meta')
 assert.equal(statPresentation('改革'),'meta')
 assert.equal(statPresentation('42%'),'primary')
 assert.equal(statPresentation(120),'primary')
 assert.equal(statPresentation('2026-11-13','primary'),'primary')
})
test('history uses explicit before/after only and never infers null as zero',()=>{
 const items=[{label:'现金',before:100,after:80},{label:'政策',before:'甲',after:'甲'},{label:'未知',before:null,after:0},{label:'旧文案',value:'100 → 80'}]
 validateEditorial('facts',{items})
 const h=factChanges(items)
 assert.equal(h.changed.length,2);assert.equal(h.unchanged,1);assert.equal(h.ordinary.length,1)
 assert.throws(()=>validateEditorial('facts',{items:[{label:'缺失',before:1}]}))
 assert.throws(()=>validateEditorial('facts',{items:[{label:'对象',before:{x:1},after:2}]}))
 assert.throws(()=>validateEditorial('facts',{items:[{label:'非数',value:NaN}]}))
})
