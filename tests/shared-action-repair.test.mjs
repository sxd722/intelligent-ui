import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createConvergenceGuard} from '../server/cardspec/debug-convergence.mjs'
import {createDebugSession} from '../server/cardspec/debug-session.mjs'
const source=field=>`<card><state id="sel" type="string" initial="a"/><collection id="rows" items={[{id:"a",title:"A"},{id:"b",title:"B"}]} onSelect="pick"/><button args={{id:"b"}} onPress="pick">跳转</button><text>{state.sel}</text><action id="pick"><set target="sel" value={${field}}/></action></card>`
test('both directions disclose all callers; split actions compile without changing event semantics',()=>{
 for(const field of ['event.id','args.id']){const r=compileCard(source(field),{final:true});const d=r.diagnostics.find(x=>x.code==='shared_action_payload');assert.ok(d);assert.equal(d.action,'pick');assert.deepEqual(new Set(d.callers.map(x=>x.type)),new Set(['collection','button']))}
 const fixed=source('event.id').replace('args={{id:"b"}} onPress="pick"','args={{id:"b"}} onPress="jump"').replace('</card>','<action id="jump"><set target="sel" value={args.id}/></action></card>')
 assert.equal(compileCard(fixed,{final:true}).complete,true)
 const normalized=source('args.id ?? event.id');assert.equal(compileCard(normalized,{final:true}).complete,true)
})
test('A B A stops; real progress breaks the cycle',()=>{
 const record=message=>({status:'failed',diagnostics:[{code:'binding',severity:'error',message}]})
 const c=createConvergenceGuard();assert.equal(c.observe(record('A')).stopped,false);assert.equal(c.observe(record('B')).stopped,false);assert.equal(c.observe(record('A')).cycle,true)
 const p=createConvergenceGuard();p.observe(record('A'));p.observe({...record('B'),progress:{improved:true}});assert.equal(p.observe(record('A')).stopped,false)
})
test('outer final validations count as progress attempts and halt without a usable candidate',async()=>{
 const artifactRoot=await mkdtemp(join(tmpdir(),'shared-action-qa-'))
 const d=createDebugSession({artifactRoot,context:()=>({extendedGeneration:true}),runner:()=>{throw Error('invalid DSL must not reach browser')}})
 for(const field of ['event.id','args.id','event.id'])await d.test({source:source(field)},{final:true})
 assert.equal(d.snapshot().progress.observations,3)
 assert.equal(d.snapshot().tests.at(-1).convergence.cycle,true)
 assert.ok(d.stopResult());assert.equal(d.stopResult().source,undefined)
 assert.throws(()=>d.repair(),/stopped/)
})
