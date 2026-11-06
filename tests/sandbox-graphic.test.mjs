import test from 'node:test'
import assert from 'node:assert/strict'
import {sandboxGraphic,graphicBudgets} from '../shared/cardspec/sandbox-graphic.mjs'
import {sandboxDocument} from '../src/cardspec/sandbox-document.mjs'
const svg={type:'svg',props:{viewBox:'0 0 200 210'},children:[]}
test('standalone graphic fitting includes clickable SVG and wrapped canvas',()=>{
 assert.deepEqual(sandboxGraphic({...svg,props:{...svg.props,onClick:{handler:'add'}}}),{kind:'svg',depth:0,ratio:200/210})
 assert.deepEqual(sandboxGraphic({type:'div',children:[{type:'canvas',props:{width:600,height:300}}]}),{kind:'canvas',depth:1,ratio:2})
})
test('mixed documents, forms, multiple illustrations and invalid view boxes are not scaled wholesale',()=>{
 for(const tree of [{type:'div',children:[svg,{type:'button',children:['操作']}]},{type:'div',children:['解释',svg]},[svg,svg],{type:'svg',props:{viewBox:'0 0 0 200'}},{type:'svg',props:{}},{type:'button',children:[svg]}])assert.equal(sandboxGraphic(tree),null)
})
test('visual budget reserves other content and shares a constrained viewport fairly',()=>{
 assert.deepEqual(graphicBudgets([310],180),[180])
 assert.deepEqual(graphicBudgets([310],500),[310])
 assert.deepEqual(graphicBudgets([200,200],300),[150,150])
 assert.deepEqual(graphicBudgets([310],0),[96]) // paginate genuinely overfull content, never collapse the visual to nothing
})
test('fit document keeps strict sandbox CSP and does not hide overflow to pass audits',()=>{
 const html=sandboxDocument('', 'graphic-test')
 assert.match(html,/connect-src 'none'/);assert.match(html,/xMidYMid meet/)
 assert.match(html,/data-host-fit-graphic/);assert.match(html,/auditLayout\(document.documentElement\)/)
 assert.doesNotMatch([...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n'),/overflow\s*:\s*hidden/)
})
