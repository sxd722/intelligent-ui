import {existsSync} from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {parseExpression} from '../shared/cardspec/expression.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
const context={expressionDialect:'js-v1',input:{n:3}}
function ready(body,mode='snapshot'){
 const r=compileCard(`<card actionMode="${mode}">${body}<text>ready</text></card>`,{final:true,context})
 assert.equal(r.complete,true,JSON.stringify(r.diagnostics));return r.spec
}
test('pure derived graph is computed once per scope and refreshed in a new scope',()=>{
 const s=ready('<data id="input" value={context.input.n}/><derive id="double" value={data.input*2}/><derive id="many" value={derived.double+derived.double+derived.double}/>')
 let reads=0,n=3;Object.defineProperty(s.context,'input',{get(){reads++;return {n}}})
 const store=createStore(),scope=makeScope(s,store)
 assert.equal(scope.derived.many,18);assert.equal(scope.derived.double,6);assert.equal(scope.data.input,3);assert.equal(reads,1)
 n=5;assert.equal(makeScope(s,store).derived.many,30);assert.equal(reads,2)
})
test('legacy sequential steps invalidate cache; snapshot reads and next remain distinct',()=>{
 for(const mode of ['sequential','snapshot']){
  const s=ready('<state id="n" type="number" initial={1}/><state id="before" type="number" initial={0}/><state id="after" type="number" initial={0}/><state id="nextN" type="number" initial={0}/><derive id="double" value={state.n*2}/><action id="go"><set target="before" value={derived.double}/><set target="n" value={3}/><set target="after" value={derived.double}/><set target="nextN" value={next.n}/></action>',mode)
  const store=createStore();makeScope(s,store);executeAction(s,store,'go')
  assert.deepEqual({...store.values},{n:3,before:2,after:mode==='snapshot'?2:6,nextN:3})
 }
})
test('state initialization cannot freeze a later declaration in the cache',()=>{
 const s=ready('<data id="base" value={state.seed??1}/><state id="n" type="number" initial={data.base}/><state id="seed" type="number" initial={2}/>')
 const store=createStore(),scope=makeScope(s,store)
 assert.equal(store.values.n,1);assert.equal(scope.data.base,2)
})
test('cycles, failed computations and genuinely expensive expressions retain their guards',()=>{
 const s=ready('<derive id="a" value={1}/><derive id="b" value={2}/>')
 const parse=value=>parseExpression(value,{dialect:'js-v1'})
 s.derived.a=parse('derived.b');s.derived.b=parse('derived.a')
 assert.throws(()=>makeScope(s,createStore()).derived.a,/cyclic/)
 s.derived.a=parse('context.rows.map(x=>context.rows.filter(y=>y===x).length)');delete s.derived.b;s.context.rows=Array.from({length:200},(_,i)=>i)
 assert.throws(()=>makeScope(s,createStore()).derived.a,/budget exceeded/)
 const s2=ready('<derive id="a" value={context.input.n}/>');let fails=true
 Object.defineProperty(s2.context,'input',{get(){if(fails)throw Error('temporary');return {n:7}}})
 const scope=makeScope(s2,createStore());assert.throws(()=>scope.derived.a,/temporary/);fails=false;assert.equal(scope.derived.a,7)
})
test('immutable R14 small-data graph compiles without raising operation limits',{skip: ["artifacts/javascript-upgrade/deep-baselines-r14/sentiment.json"].every(existsSync) ? false : "Private historical replay artifacts excluded from source export"}, ()=>{
 const r=JSON.parse(readFileSync('artifacts/javascript-upgrade/deep-baselines-r14/sentiment.json','utf8'))
 const source=r.trace.filter(x=>x.type==='diagnostics').at(-1).source
 const result=compileCard(source,{final:true,context:{...context,datasets:Object.fromEntries(r.records.map(x=>[x.id,x.value]))}})
 assert.equal(result.complete,true,JSON.stringify(result.diagnostics))
 const scope=makeScope(result.spec,createStore());assert.equal(scope.derived.total,3)
 assert.equal(scope.derived.counts.length,6)
})
