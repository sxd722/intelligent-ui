import test from 'node:test'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import {logicLifecycleIssue} from '../server/cardspec/logic-diagnostics.mjs'
import {generateCard} from '../server/cardspec/generation.mjs'
import {TOOLS} from '../shared/cardspec/tools.mjs'
import {repairCapabilities,lostRepairCapabilities} from '../server/cardspec/repair-capabilities.mjs'

const tool='opencli.douban.top250',catalog=[{...TOOLS[tool],available:true}]
const binding=(id='rows')=>`<binding id="${id}" tool="${tool}" load="visible" input={{limit:5}} initial={{items:[],source:"",fetchedAt:"",truncated:false}}/>`
const card=(body)=>`<card>${body}</card>`
const compile=(s,dialect='legacy')=>compileCard(dialect==='js-v1'?s.replaceAll(/len\((bindings\.rows(?:\.value)?\.items)\)/g,'$1.length').replaceAll('string(local.n)','String(local.n)'):s,{final:true,context:{expressionDialect:dialect}})

test('binding envelope errors identify exact path in derives, hidden views and actions in both dialects',()=>{
 for(const dialect of ['legacy','js-v1'])for(const use of [
  '<derive id="n" value={len(bindings.rows.items)}/><text>{derived.n}</text>',
  '<if test={false}><text>{bindings["rows"]["items"]}</text></if>',
  '<state id="n" type="number" initial={0}/><action id="a"><set target="n" value={len(bindings.rows.items)}/></action>'
 ]){
  const r=compile(card(binding()+'\n'+use),dialect)
  assert.equal(r.complete,false)
  const issue=r.diagnostics.find(x=>x.code==='binding_result_path')
  assert.ok(issue,JSON.stringify(r.diagnostics));assert.match(issue.message,/bindings.rows.value.items/);assert.ok(issue.line>=2)
  assert.ok(!r.diagnostics.some(x=>x.message.includes('expected collection')))
 }
 for(const dialect of ['legacy','js-v1'])assert.equal(compile(card(binding()+'<text>{len(bindings.rows.value.items)} · {bindings.rows.status} · {bindings.rows.error} · {bindings.rows.updatedAt}</text>'),dialect).complete,true)
})

const logic=(source,body,extra='')=>`<logic id="m" reactive={true} initial={{n:0,rows:[]}} source={${JSON.stringify(source)}} ${extra}>${body}</logic>`
test('hidden input-only modules are diagnosed without evaluating unavailable hidden inputs',async()=>{
 const bad='function update(s,e,input){var rows=input.rows||[];if(e.type==="input"){s.rows=rows;}return s}'
 assert.ok(logicLifecycleIssue(bad))
 const r=compile(card('<if test={false}>'+logic(bad,'<text>{len(local.rows)}</text>','input={{rows:state.missing}}')+'</if>'))
 // Missing state is correctly a compiler error; use an existing empty state to
 // prove the lifecycle check also sees an initially unreachable module.
 const valid=compile(card('<state id="rows" type="array" initial={[]}/><if test={false}>'+logic(bad,'<text>{len(local.rows)}</text>','input={{rows:state.rows}}')+'</if>'))
 assert.equal(r.complete,false);assert.equal(valid.complete,true)
 await validateRichContent(r);assert.ok(r.diagnostics.some(d=>d.code==='logic_initialization'),'independent initialization diagnosis survives compile errors')
 await validateRichContent(valid);assert.equal(valid.complete,false);assert.match(valid.diagnostics.at(-1).message,/initial selections are ignored/)
 for(const source of [
  'function update(s,e,input){if(e.type==="init"||e.type==="input")s.rows=input.rows;return s}',
  'function update(s,e,input){s.rows=input.rows;if(e.type==="input")s.n++;return s}',
  'function update(s,e,input){if(e.type==="init")return s;if(e.type==="input")s.rows=input.rows;return s}',
 ])assert.equal(logicLifecycleIssue(source),null)
})

test('legacy and JS checks catch string selection corrupting numeric stages, without coercion',async()=>{
 const body='<segmented label="Stage" options={[{value:"0",label:"First"},{value:"1",label:"Next"}]} value={string(local.n)} onChange="pick"/><text>{local.n+1}</text><if test={local.n==1}><text>Second stage</text></if>'
 for(const dialect of ['legacy','js-v1']){
  const broken=compile(card(logic('function update(s,e){if(e.type==="pick")s.n=e.value;return s}',body)),dialect)
  assert.equal(broken.complete,true,JSON.stringify(broken.diagnostics));await validateRichContent(broken)
  assert.equal(broken.complete,false);assert.match(broken.diagnostics.at(-1).message,/local.n changed from number to string/)
  const good=compile(card(logic('function update(s,e){if(e.type==="pick")s.n=Number(e.value);return s}',body)),dialect)
  await validateRichContent(good);assert.equal(good.complete,true,JSON.stringify(good.diagnostics));assert.ok(good.logicProbes[0].probes>=2)
 }
 const union=compile(card(logic('function update(s,e){if(e.type==="pick")s.n="selected";return s}','<button onPress="pick">Choose</button><text>{local.n}</text>')))
 await validateRichContent(union);assert.equal(union.complete,true)
})

test('nonreactive logic is not given a fake init event by validation',async()=>{
 const r=compile(card('<logic id="m" initial={{n:0}} source={"function update(s,e){if(e.type===\'init\')throw Error(\'unexpected init\');s.n++;return s}"}><button onPress="next">Next</button><text>{local.n}</text></logic>'))
 await validateRichContent(r);assert.equal(r.complete,true,JSON.stringify(r.diagnostics))
})

test('explicit local metrics cannot start blank, but intentional unknown placeholders remain valid',async()=>{
 const source='function update(s,e){s.values=[42];return s}'
 const make=body=>card(`<logic id="metrics" initial={{values:[]}} source={${JSON.stringify(source)}}>${body}<button onPress="calculate">Calculate</button></logic>`)
 const bad=compile(make('<stat label="Total" value={local.values[0]}/>'))
 assert.equal(bad.complete,true);await validateRichContent(bad);assert.equal(bad.complete,false);assert.match(bad.diagnostics.at(-1).message,/local.values.0/)
 for(const text of [make('<stat label="Total" value={local.values[0]??"Not calculated"}/>'),make('<stat label="Total" value={local.values[0]}/>').replace('initial={{values:[]}}','reactive={true} initial={{values:[]}}')]){
  const r=compile(text);await validateRichContent(r);assert.equal(r.complete,true,JSON.stringify(r.diagnostics))
 }
})

test('repair ledger follows enabled tool and invocation kind, allowing ID changes but rejecting dropped refresh',()=>{
 const source=card(binding()+'<button onPress="refresh">Refresh</button><action id="refresh"><invoke binding="rows"/></action>')
 const before=repairCapabilities(compile(source).spec,[tool])
 assert.equal(lostRepairCapabilities(before,repairCapabilities(compile(source.replaceAll('rows','renamed')).spec,[tool])).length,0)
 assert.equal(lostRepairCapabilities(before,repairCapabilities(compile(card(binding())).spec,[tool])).length,1)
 assert.equal(repairCapabilities(compile(source).spec,[]).length,0)
})

test('verified matching prefetch can replace first load, but literals or unrelated inputs cannot',()=>{
 const record={id:'D1',tool,input:{limit:5},value:{items:[],source:'fixture',fetchedAt:'',truncated:false}}
 const source=card(binding().replace('load="visible"','load="manual"')+'<data id="rows" value={context.datasets.D1.items}/><collection items={data.rows}/>')
 const spec=compileCard(source,{final:true,context:{datasets:{D1:record.value}}}).spec
 assert.ok(repairCapabilities(spec,[tool],[record]).some(c=>c.kind==='automatic load'))
 assert.ok(!repairCapabilities(spec,[tool],[{...record,input:{limit:9}}]).some(c=>c.kind==='automatic load'))
 const staticSpec=compile(card(binding().replace('load="visible"','load="manual"')+'<text>Copied summary</text>')).spec
 assert.ok(!repairCapabilities(staticSpec,[tool],[record]).some(c=>c.kind==='automatic load'))
 const invalid=compile(card(binding()+'<action id="show"><invoke binding="rows" target="slot:detail"/></action>')).spec
 const corrected=compile(card(binding()+'<action id="show"><invoke binding="rows"/></action>')).spec
 assert.deepEqual(lostRepairCapabilities(repairCapabilities(invalid,[tool]),repairCapabilities(corrected,[tool])),[])
})

test('one-repair generation cannot silently replace live tools with static text, and retains raw failure',async()=>{
 const frames=[];let calls=0,published=0,messages
 const bad=card(binding()+'<text>{len(bindings.rows.items)}</text>')
 const options={input:{prompt:'Live results'},view:{generationMode:'direct'},catalog,signal:new AbortController().signal,emit:e=>frames.push(e),onValidated:()=>published++,streamUpstream:async(m,o)=>{messages=m;calls++;o.onPiece({content:calls===1?bad:card('<text>Static summary</text>')})}}
 await assert.rejects(generateCard(options),/repair_capability_lost/)
 assert.equal(calls,2);assert.equal(published,0);assert.equal(frames.filter(f=>f.type==='diagnostics').length,2)
 assert.ok(messages.at(-1).content.includes('automatic load'));assert.equal(frames.find(f=>f.type==='diagnostics').source,bad)
 calls=0
 const good=await generateCard({...options,streamUpstream:async(_,o)=>{calls++;o.onPiece({content:calls===1?bad:bad.replaceAll('bindings.rows.items','bindings.rows.value.items')})}})
 assert.equal(calls,2);assert.equal(good.repairCount,1);assert.deepEqual(good.spec.repairAudit.lost,[])
})
