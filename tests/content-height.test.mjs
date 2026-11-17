import test from 'node:test'
import assert from 'node:assert/strict'
import {installContentHeight} from '../src/cardspec/content-height.mjs'

test('content height expands, shrinks, ignores graphic stages and bounds viewport feedback',()=>{
 const original=new Map(['document','ResizeObserver','MutationObserver','addEventListener','setTimeout'].map(k=>[k,globalThis[k]]))
 const events=[],messages=[],timers=[];let resized,mutated,height=2035,width=432
 const html={dataset:{},hasAttribute:()=>false}
 const surface={getBoundingClientRect:()=>({height,width,top:0}),get scrollHeight(){return height},addEventListener:()=>{}}
 try{
  globalThis.document={documentElement:html}
  globalThis.ResizeObserver=class{constructor(fn){resized=fn}observe(){}}
  globalThis.MutationObserver=class{constructor(fn){mutated=fn}observe(){}}
  globalThis.addEventListener=(name,fn)=>events.push(fn)
  globalThis.setTimeout=fn=>{timers.push(fn);return timers.length}
  const flush=()=>{while(timers.length)timers.shift()()}
  const enable=installContentHeight(surface,m=>messages.push(m))
  resized();flush();assert.equal(messages.length,0)
  enable(true);flush();assert.equal(messages.at(-1).height,2035)
  height=720;mutated();flush();assert.equal(messages.at(-1).height,720)
  html.dataset.hostGraphic='true';height=1000;resized();flush();assert.equal(messages.at(-1).height,720)
  html.dataset.hostGraphic='false';mutated();flush()
  const before=messages.length
  for(let i=0;i<20;i++){height+=100;resized();flush()}
  assert.ok(messages.length-before<=6)
  height=900;mutated();flush();assert.equal(messages.at(-1).height,900)
  width=320;height=1300;resized();flush();assert.equal(messages.at(-1).height,1300)
  enable(false);height=700;mutated();flush();assert.equal(messages.at(-1).height,1300)
  enable(true);flush();assert.equal(messages.at(-1).height,700)
  height=Infinity;mutated();flush();assert.equal(messages.at(-1).height,700)
 }finally{for(const [k,v]of original){if(v===undefined)delete globalThis[k];else globalThis[k]=v}}
})
