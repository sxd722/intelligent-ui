import test from 'node:test'
import assert from 'node:assert/strict'
import {createCardSizePreference,CARD_SIZE_KEY} from '../src/card-size.mjs'
test('card size persists, synchronizes mounted cards and handles blocked storage',()=>{
  const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}
  const preference=createCardSizePreference(storage)
  let updates=0;const stop=preference.subscribe(()=>updates++)
  assert.equal(preference.getSnapshot(),'square')
  preference.set('auto');assert.equal(updates,1)
  assert.equal(createCardSizePreference(storage).getSnapshot(),'auto')
  preference.set('square');assert.equal(preference.getSnapshot(),'square');stop()
  const blocked=createCardSizePreference({getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}})
  blocked.set('auto');assert.equal(blocked.getSnapshot(),'auto')
})
test('another tab changing or clearing the setting updates subscribers',()=>{
  const target=new EventTarget(),preference=createCardSizePreference(null,target)
  let changes=0;const stop=preference.subscribe(()=>changes++)
  const send=(key,newValue)=>target.dispatchEvent(Object.assign(new Event('storage'),{key,newValue}))
  send(CARD_SIZE_KEY,'auto');assert.equal(preference.getSnapshot(),'auto')
  send('unrelated','square');assert.equal(changes,1)
  send(null,null);assert.equal(preference.getSnapshot(),'square')
  send(CARD_SIZE_KEY,'invalid');assert.equal(preference.getSnapshot(),'square')
  stop();send(CARD_SIZE_KEY,'auto');assert.equal(changes,3)
})
