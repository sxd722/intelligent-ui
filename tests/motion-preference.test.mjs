import test from 'node:test'
import assert from 'node:assert/strict'
import {createMotionPreference,effectiveMotion,MOTION_KEY} from '../src/motion-preference.mjs'
test('motion preference survives storage failure and supports storage events',()=>{
 let listener,updates=0
 const p=createMotionPreference({getItem(){throw Error()},setItem(){throw Error()}},{addEventListener(_,f){listener=f},removeEventListener(){listener=null}})
 assert.equal(p.getSnapshot(),'full');const stop=p.subscribe(()=>updates++)
 p.set('off');assert.equal(p.getSnapshot(),'off');listener({key:MOTION_KEY,newValue:'light'});assert.equal(p.getSnapshot(),'light')
 listener({key:null,newValue:null});assert.equal(p.getSnapshot(),'full');assert.equal(updates,3);stop();assert.equal(listener,null)
})
test('system reduced motion overrides full and light',()=>{
 for(const v of ['full','light','off'])assert.equal(effectiveMotion(v,true),'off')
 assert.equal(effectiveMotion('light',false),'light');assert.equal(effectiveMotion('invalid',false),'full')
})
