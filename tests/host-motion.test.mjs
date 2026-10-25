import test from 'node:test'
import assert from 'node:assert/strict'
import {attachContentMotion,MOTION_FRAMES} from '../src/cardspec/host-motion.js'
test('host motion animates in place, cancels on reduced motion/hidden, and cleans up',()=>{
 const original=Object.fromEntries(['matchMedia','MutationObserver','IntersectionObserver','requestAnimationFrame','cancelAnimationFrame','document'].map(k=>[k,globalThis[k]]))
 let observe,flush,change,visibility,disconnected=false,played=0,cancelled=0
 const preference={matches:false,addEventListener:(_,f)=>{change=f},removeEventListener(){}}
 const element={isConnected:true,dataset:{motion:'slide'},closest:()=>null,animate(frames){assert.deepEqual(frames,MOTION_FRAMES.slide);played++;return {cancel(){cancelled++}}}}
 try{
  globalThis.matchMedia=()=>preference
  globalThis.document={hidden:false,addEventListener:(_,f)=>{visibility=f},removeEventListener(){}}
  globalThis.MutationObserver=class{constructor(fn){observe=fn}observe(){}disconnect(){disconnected=true}}
  globalThis.requestAnimationFrame=f=>{flush=f;return 1};globalThis.cancelAnimationFrame=()=>{}
  globalThis.IntersectionObserver=class{constructor(fn){this.fn=fn}observe(){this.fn([{isIntersecting:true}])}disconnect(){}}
  const stop=attachContentMotion({dataset:{},hasAttribute:()=>false,addEventListener(){},removeEventListener(){}})
  observe([{type:'attributes',attributeName:'data-motion-key',target:element}]);flush();assert.equal(played,1)
  preference.matches=true;change();assert.equal(cancelled,1)
  observe([{type:'attributes',attributeName:'data-motion-key',target:element}]);assert.equal(played,1)
  preference.matches=false;observe([{type:'attributes',attributeName:'data-motion-key',target:element}]);flush();document.hidden=true;visibility();assert.equal(cancelled,2)
  stop();assert.equal(disconnected,true)
 }finally{for(const [k,v]of Object.entries(original))if(v===undefined)delete globalThis[k];else globalThis[k]=v}
})
