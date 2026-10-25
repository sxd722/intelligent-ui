import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { compileCard } from '../shared/cardspec/compiler.mjs'
import { handleCardSpec } from '../server/cardspec/handler.mjs'
import { createStore, makeScope, executeAction } from '../shared/cardspec/store.mjs'

const compile = source => compileCard(source, { final: true })

test('one complete card tolerates plain envelope commentary but not ambiguity or executable markup',()=>{
 const card='<card><text>answer</text></card>'
 const result=compile('测试通过，输出最终卡片。\n'+card+'\n结束。')
 assert.equal(result.complete,true);assert.equal(result.diagnostics.filter(d=>d.code==='envelope_prose_ignored').length,2)
 for(const source of [card+card,card+'<card>','<script>bad</script>'+card,'{state.x}'+card,'note <card><text>unfinished'])assert.equal(compile(source).complete,false,source)
 assert.ok(compileCard('note '+card).diagnostics.some(d=>d.code==='structure'))
})

test('literal click aliases and rich clickable rows preserve actions and arguments',()=>{
 const source='<card><state id="n" type="number" initial={0}/><list><list-item id="choice" onClick="pick" args={{n:2}}><stack><strong>Two</strong><caption>Choose two</caption></stack></list-item></list><button onClick="pick" args={{n:3}}><stack><text>Three</text></stack></button><action id="pick"><set target="n" value={args.n}/></action></card>'
 const result=compile(source);assert.equal(result.complete,true,JSON.stringify(result.diagnostics))
 assert.equal(result.diagnostics.filter(d=>d.code==='event_alias').length,2)
 const row=result.spec.children[0].children[0],store=createStore();makeScope(result.spec,store)
 executeAction(result.spec,store,row.props.onPress.value,{args:{n:2}});assert.equal(store.values.n,2)
 for(const edit of [source.replace('onClick="pick"','onClick="pick" onPress="pick"'),source.replace('onClick="pick"','onClick="missing"'),source.replace('<strong>Two</strong>','<button onPress="pick">Nested</button>'),source.replace('<strong>Two</strong>','<link url="https://example.com">Nested link</link>')])assert.equal(compile(edit).complete,false)
 assert.equal(compile('<card><text onClick="x">text</text></card>').complete,false)
 const callback=compileCard('<card><button onClick={() => 1}>bad</button></card>',{final:true,context:{expressionDialect:'js-v1'}})
 assert.equal(callback.complete,false)
})

test('declarations without UI fail final validation and enter normal repair',async()=>{
  const source='<card><state id="n" type="number" initial={0}/></card>'
  assert.ok(!compileCard(source).diagnostics.some(d=>d.severity==='error'))
  assert.equal(compile(source).complete,false)
  assert.match(compile(source).diagnostics.find(d=>d.code==='structure').message,/visible UI/)
  const res=new EventEmitter(),frames=[];let calls=0
  res.writeHead=()=>{};res.flushHeaders=()=>{};res.end=()=>{res.writableEnded=true}
  res.write=s=>{const data=s.slice(6).trim();if(data!=='[DONE]')frames.push(JSON.parse(data))}
  await handleCardSpec({},res,{mode:'direct',messages:[{role:'user',content:'counter'}]}, {
    keyLoaded:true,model:'fixture',photo:async()=>null,
    streamUpstream:async(messages,{onPiece})=>{
      if(++calls===2)assert.match(messages.at(-1).content,/visible UI/)
      onPiece({content:calls===1?source:source.replace('</card>','<text>{state.n}</text></card>')})
    },
  })
  assert.equal(calls,2);assert.equal(frames.find(f=>f.type==='message_stream_complete').status,'succeeded')
})
test('typographic attribute quotes preserve content and stream safely', () => {
  const source = '<intro>“标题”不改写</intro><card schemaVersion=“1” theme=“soft” palette=‘a’><text label="unused">ignore</text></card>'
    .replace('<text label="unused">ignore', '<text>“中文”与 don’t，{\'a “quote”\'}')
  assert.equal(compile(source).complete, true)
  assert.equal(compile(source).spec.intro, '“标题”不改写')
  assert.equal(compile(source).spec.children[0].children[0].value.value, '“中文”与 don’t，')
  for (let i = 0; i <= source.length; i++) {
    assert.ok(!compileCard(source.slice(0,i)).diagnostics.some(d => d.code === 'syntax'), `prefix ${i}`)
  }
  const bad = compile('<intro>ok</intro>\n<card theme=soft><text>hello</text></card>')
  assert.ok(bad.diagnostics.some(d => d.code === 'syntax' && d.line === 2))
  assert.ok(!bad.diagnostics.some(d => d.message === 'missing card'))
  assert.ok(compile('<intro>ok</intro>').diagnostics.some(d => d.message === 'missing card'))
  assert.equal(compile('<card theme=“soft"><text>x</text></card>').complete, false)
})

test('host assigns stable template IDs; explicit IDs and declarations stay strict', () => {
  const prefix = '<card><state id="n" type="number" initial={0}/><action id="inc"><increment target="n" value={1}/></action><row><text>{state.n}</text><button onPress="inc">+</button></row>'
  const a = compileCard(prefix), b = compile(prefix+'<text id="auto-1">tail</text></card>')
  assert.equal(b.complete, true, JSON.stringify(b.diagnostics))
  assert.deepEqual(a.spec.children[0], b.spec.children[0])
  const store = createStore(); makeScope(a.spec,store); executeAction(a.spec,store,'inc'); makeScope(b.spec,store)
  assert.equal(store.values.n,1)
  const each = compile('<card><data id="rows" value={[{id:"a"},{id:"b"}]}/><each items={data.rows} itemKey={item.id}><row><strong>{item.id}</strong></row></each></card>')
  assert.equal(each.complete,true,JSON.stringify(each.diagnostics))
  for (const src of ['<card><text id="x"/><text id="x"/></card>','<card><text id={"dynamic"}/></card>'.replace('{"dynamic"}','{state.x}'),'<card><state type="number" initial={0}/></card>','<card><text id="@auto-1"/></card>']) assert.equal(compile(src).complete,false)
})

test('flat diagram data gets actionable tree diagnosis, never invented edges', () => {
  const source = '<card schemaVersion=“1” theme=“soft”><data id="nodes" value={[{id:"orion",label:"猎户座"},{id:"taurus",label:"金牛座"}]}/><mindmap label="星座" nodes={data.nodes}/></card>'
  const invalid=compile(source)
  assert.ok(invalid.diagnostics.some(d=>/exactly one root.*found 2.*parentId/.test(d.message)))
  assert.ok(!invalid.diagnostics.some(d=>d.code==='syntax'))
  assert.equal(compile(source.replace('id:"taurus",label:"金牛座"','id:"taurus",label:"金牛座",parentId:"orion"')).complete,true)
})

for(const invalidRepair of [false,true]) test(`structural repair replaces preview only when valid (${invalidRepair})`,async()=>{
  const res=new EventEmitter(),frames=[]
  res.writeHead=()=>{};res.flushHeaders=()=>{}
  res.write=s=>{const data=s.slice(6).trim();if(data!=='[DONE]')frames.push(JSON.parse(data))}
  res.end=()=>{res.writableEnded=true}
  let calls=0
  await handleCardSpec({},res,{mode:'direct',messages:[{role:'user',content:'card'}]}, {
    keyLoaded:true,model:'fixture',photo:async()=>null,
    streamUpstream:async(messages,{onPiece})=>{
      if(++calls===1){onPiece({content:'<card><state id="v" type="number" initial={0}/><text id="preview">Preview</text>'});await new Promise(r=>setTimeout(r,110));onPiece({content:'<unknown/></card>'})}
      else onPiece({content:`<card><state id="v" type="string" initial="new"/><row id="replacement"><text id="body">Ready</text>${invalidRepair?'<unknown/>':''}</row></card>`})
    },
  })
  const specs=frames.flatMap(f=>f.o==='patch'?f.v:[]).filter(op=>op.v?.card_spec).map(op=>op.v.card_spec)
  assert.ok(specs.length>=1)
  assert.equal(frames.find(f=>f.type==='message_stream_complete').status,invalidRepair?'failed':'succeeded')
  if(invalidRepair) assert.ok(specs.every(s=>s.children[0].id==='preview'))
  else {assert.notEqual(specs.at(-1).cardId,specs[0].cardId);assert.equal(specs.at(-1).state.v.type,'string');assert.equal(specs.at(-1).revision,1)}
})
