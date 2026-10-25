import test from 'node:test'
import assert from 'node:assert/strict'
import {clippedBox,measureVisualViewports} from '../src/cardspec/experience-metrics.js'

test('nested scroll clipping measures the visible primary region, not just outer-card overflow',()=>{
 const map={left:10,right:210,top:20,bottom:220}
 const smallBody={left:0,right:220,top:20,bottom:50}
 const first=clippedBox(map,smallBody)
 assert.equal(first.bottom-first.top,30)
 const outer={left:0,right:180,top:0,bottom:320}
 assert.deepEqual(clippedBox(first,outer),{left:10,right:180,top:20,bottom:50})
 assert.deepEqual(clippedBox(map,smallBody,{x:true,y:false}),map,'horizontal scroll does not clip vertical content')
 const below=clippedBox(map,{left:0,right:300,top:250,bottom:300})
 assert.equal(below.bottom-below.top,0,'offscreen visuals never yield negative sizes')
})

test('candidate lists and tables report collapsed inner viewports even when the outer card fits',()=>{
 const old=globalThis.getComputedStyle
 const rect=(top,height)=>({left:0,right:320,top,bottom:top+height,width:320,height})
 const stage={getBoundingClientRect:()=>rect(0,360),parentElement:null}
 const body={getBoundingClientRect:()=>rect(100,48),parentElement:stage,scroll:true}
 const list={getBoundingClientRect:()=>rect(100,200),parentElement:body,classList:['cs-collection-items']}
 stage.querySelectorAll=selector=>{for(const name of ['.cs-collection-items','.cs-table-pan','.cs-experience-results','.cs-carousel-track'])assert.ok(selector.includes(name));return [list]}
 globalThis.getComputedStyle=element=>({visibility:'visible',display:'block',overflowX:'visible',overflowY:element.scroll?'auto':'visible'})
 try{const [v]=measureVisualViewports(stage);assert.equal(v.visibleHeight,48);assert.equal(v.cramped,true)}finally{globalThis.getComputedStyle=old}
})
