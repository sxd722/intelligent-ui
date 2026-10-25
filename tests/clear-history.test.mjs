import test from 'node:test'
import assert from 'node:assert/strict'
import {clearConversation,readConversation,saveConversation} from '../src/cardspec/session-storage.mjs'
import {createCardSession} from '../src/cardspec/tool-session.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {FIXTURES} from '../shared/cardspec/fixtures.mjs'
function storage(){const data=new Map();return {get length(){return data.size},key:i=>[...data.keys()][i],getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}}
test('clear removes conversation and page stacks, preserving unrelated settings and other tabs',()=>{
  const a=storage(),b=storage()
  for(const s of [a,b]){saveConversation(s,[{role:'user',content:'hello'}],true);s.setItem('cardspec:pages:old','{}');s.setItem('cards:display:size:v1','auto');s.setItem('cardspec:lab:tools','keep')}
  assert.equal(clearConversation(a),'')
  assert.deepEqual(readConversation(a).messages,[]);assert.equal(a.getItem('cardspec:pages:old'),null)
  assert.equal(a.getItem('cards:display:size:v1'),'auto');assert.equal(a.getItem('cardspec:lab:tools'),'keep')
  assert.equal(readConversation(b).messages.length,1)
})
test('late page disposal cannot resurrect cleared history; new sessions can still save',()=>{
  const s=storage(),spec=compileCard(FIXTURES.counter,{final:true,cardId:'root'}).spec
  const old=createCardSession(spec,{storage:s,persistenceKey:'cardspec:pages:root'})
  old.save();assert.ok(s.getItem('cardspec:pages:root'))
  clearConversation(s);old.saveView({top:20});old.dispose()
  assert.equal(s.getItem('cardspec:pages:root'),null)
  const fresh=createCardSession(spec,{storage:s,persistenceKey:'cardspec:pages:root'});fresh.save();fresh.dispose()
  assert.ok(s.getItem('cardspec:pages:root'))
})
test('storage cleanup failure is visible',()=>{
  assert.match(clearConversation({get length(){throw Error('blocked')}}),/清理失败/)
})
