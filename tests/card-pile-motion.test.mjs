import test from 'node:test'
import assert from 'node:assert/strict'
import {exitNavigation,dragNavigation,cancelNavigation} from '../src/cardspec/host-motion.js'
import {motionPreference} from '../src/motion-preference.mjs'

test('pile navigation clears finished transforms and respects motion-off',async()=>{
 const old={document:globalThis.document,matchMedia:globalThis.matchMedia}
 let frames,cancelled=0,plays=0
 const pile={dataset:{},style:{setProperty(){},removeProperty(){}}}
 const root={style:{transform:''},closest:()=>pile,animate(f){frames=f;plays++;return {finished:Promise.resolve(),cancel(){cancelled++}}}}
 try{
  globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}}
  globalThis.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}})
  motionPreference.set('full');dragNavigation(root,-100)
  assert.match(root.style.transform,/-55(?:\.\d+)?px/)
  await exitNavigation(root,1)
  assert.match(frames[0].transform,/-55(?:\.\d+)?px/)
  assert.match(frames[1].transform,/-100%/)
  assert.equal(cancelled,1,'forwards-filled exit cannot remain on the live page')
  cancelNavigation(root);assert.equal(root.style.transform,'');assert.equal(pile.dataset.pilePhase,undefined)
  motionPreference.set('off');await exitNavigation(root,-1);assert.equal(plays,1)
 }finally{motionPreference.set('full');for(const [k,v] of Object.entries(old))if(v===undefined)delete globalThis[k];else globalThis[k]=v}
})
