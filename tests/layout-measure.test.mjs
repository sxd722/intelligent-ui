import {test} from 'node:test'
import assert from 'node:assert/strict'
import {blockBox,naturalCompositionHeight} from '../src/cardspec/layout-measure.js'

test('natural height converges with fractional padding and text (433/434 regression)',()=>{
  const content=128+87.578125+6,chrome=211.734375
  let height=433.59375
  const results=[]
  for(let i=0;i<100;i++){
    const body=height-chrome
    height=naturalCompositionHeight(content,height-body,780)
    results.push(height)
    assert.ok(height-chrome+1/64>=content,'all content fits without phantom paging')
  }
  assert.deepEqual([...new Set(results)],[434])
  assert.equal(naturalCompositionHeight(900,chrome,640),640)
  assert.equal(naturalCompositionHeight(20,100,780),280)
  assert.ok(naturalCompositionHeight(content+60,chrome,780)>height,'real content changes still resize')
})

test('layout measurement ignores animations and retains border/content box precision',t=>{
  const original=globalThis.getComputedStyle
  globalThis.getComputedStyle=el=>el.css
  t.after(()=>{if(original)globalThis.getComputedStyle=original;else delete globalThis.getComputedStyle})
  const node={css:{height:'221.859375px',boxSizing:'border-box',paddingTop:'0px',paddingBottom:'0px',borderTopWidth:'0px',borderBottomWidth:'0px',marginTop:'1.25px',marginBottom:'2.5px'},getBoundingClientRect(){throw Error('transformed geometry must not set layout budget')}}
  assert.deepEqual(blockBox(node),{height:221.859375,content:221.859375,outer:225.609375})
  node.css={...node.css,boxSizing:'content-box',paddingTop:'4.5px',paddingBottom:'3.25px',borderTopWidth:'1px'}
  assert.deepEqual(blockBox(node),{height:230.609375,content:221.859375,outer:234.359375})
})

test('parent-sized visual widgets receive a fixed budget instead of recursive auto sizing',()=>{
  for(const childHeight of [120,440,447,450,454,451,900])
    assert.equal(naturalCompositionHeight(childHeight,210,696,true),696)
  assert.equal(naturalCompositionHeight(450,210,500,true),500,'viewport resize establishes a new budget')
})
