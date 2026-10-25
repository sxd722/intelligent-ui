import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { compileCard } from '../shared/cardspec/compiler.mjs'
import { createStore, makeScope, executeAction } from '../shared/cardspec/store.mjs'
import { handleCardSpec } from '../server/cardspec/handler.mjs'
import { RESOURCE_CARD, BROKEN_RESOURCE_CARD } from './repair-fixture.mjs'

test('expression and closing-tag errors do not hide later independent diagnostics', () => {
  const result=compileCard(BROKEN_RESOURCE_CARD,{final:true})
  assert.equal(result.complete,false)
  for(const code of ['expression','syntax','type','interpolation']) assert.ok(result.diagnostics.some(d=>d.code===code),code)
  assert.ok(!result.diagnostics.some(d=>d.code==='binding'))
  assert.ok(result.diagnostics.every(d=>d.line>0 && d.offset>=0))
  const fixed=compileCard(RESOURCE_CARD,{final:true})
  assert.equal(fixed.complete,true,JSON.stringify(fixed.diagnostics))
  const store=createStore(); makeScope(fixed.spec,store)
  for(let i=0;i<8;i++) executeAction(fixed.spec,store,'replenish')
  assert.equal(store.values.capacity,10)
  assert.equal(store.values.available,10)
  assert.equal(new Set(store.values.entries.map(e=>e.id)).size,8)
})

test('incomplete expressions stay pending until balanced and unsafe calls remain rejected', () => {
  const incomplete=compileCard('<card><state id="n" type="number" initial={min(1,')
  assert.ok(incomplete.diagnostics.some(d=>d.severity==='pending'))
  assert.ok(!incomplete.diagnostics.some(d=>d.severity==='error'))
  for(const expr of ['state.entries.push(1)','globalThis.alert(1)','state.constructor(1)']) {
    const result=compileCard(`<card><text id="text">{${expr}}</text></card>`,{final:true})
    assert.equal(result.complete,false)
    assert.ok(result.diagnostics.some(d=>d.code==='expression'))
  }
})

test('missing attribute brace reports its origin and preserves later diagnostics', () => {
  const source='<card>\n<data id="items" value={[{"id":"a","text":"literal /> is safe"}]/>\n<region id="body" role="supporting"><text id="t">hello</text></region></card>'
  const result=compileCard(source,{final:true})
  assert.equal(result.complete,false)
  const missing=result.diagnostics.find(d=>d.code==='expression')
  assert.match(missing.message,/missing }/)
  assert.equal(missing.line,2)
  assert.equal(missing.offset,source.indexOf('{'))
  assert.ok(result.diagnostics.some(d=>d.code==='presentation_default'))
  assert.ok(!result.diagnostics.some(d=>d.code==='binding'))
  const fixed=source.replace('}]/>','}]}/>').replace('role="supporting"','role="content"')
  assert.equal(compileCard(fixed,{final:true}).complete,true)
  const unfinished=compileCard('<card>\n<data id="items" value={[1,2]',{final:true})
  assert.equal(unfinished.diagnostics.find(d=>d.code==='incomplete').line,2)
})

for(const fails of [false,true]) test(`repair publishes only a complete validated candidate (${fails?'failure':'success'})`, async()=>{
  const res=new EventEmitter(),frames=[]
  res.writeHead=()=>{};res.flushHeaders=()=>{}
  res.write=s=>{const data=s.slice(6).trim();if(data!=='[DONE]')frames.push(JSON.parse(data))}
  res.end=()=>{res.writableEnded=true}
  let calls=0, duringRepair=0
  const specs=()=>frames.flatMap(f=>f.o==='patch'?f.v:[]).filter(op=>op.v?.card_spec).map(op=>op.v.card_spec)
  await handleCardSpec({},res,{mode:'direct',messages:[{role:'user',content:'资源分配'}]}, {
    keyLoaded:true,model:'fixture',photo:async()=>null,
    streamUpstream:async(messages,{onPiece})=>{
      if(++calls===1) {onPiece({content:BROKEN_RESOURCE_CARD});return}
      for(const code of ['expression','syntax','type','interpolation']) assert.ok(messages.at(-1).content.includes(`"code":"${code}"`))
      const source=fails?BROKEN_RESOURCE_CARD:RESOURCE_CARD
      const split=source.indexOf('<region id="footer"'), before=specs().length
      onPiece({content:source.slice(0,split)})
      await new Promise(r=>setTimeout(r,110))
      duringRepair=specs().length-before
      onPiece({content:source.slice(split)})
    },
  })
  assert.equal(calls,2)
  assert.equal(duringRepair,0)
  assert.equal(frames.find(f=>f.type==='message_stream_complete').status,fails?'failed':'succeeded')
  assert.equal(specs().length,fails?0:1)
  if(!fails) assert.ok(specs()[0].children.some(n=>n.id==='footer'))
})
