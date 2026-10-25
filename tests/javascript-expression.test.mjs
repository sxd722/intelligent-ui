import test from 'node:test'
import assert from 'node:assert/strict'
import {parseExpression,evaluate} from '../shared/cardspec/expression.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
import {expressionReads,bindingDependencies} from '../shared/cardspec/dataflow.mjs'
import {collectionBindings} from '../shared/cardspec/tool-collection-state.mjs'

const parse=s=>parseExpression(s,{dialect:'js-v1'})
const run=(s,scope={})=>evaluate(parse(s),scope)
const compile=body=>compileCard(`<card actionMode="snapshot">${body}</card>`,{final:true,context:{expressionDialect:'js-v1'}})
test('familiar math, methods, templates, spreads and computed properties',()=>{
 assert.equal(run('Math.round(12.35 * 10) / 10'),12.4)
 assert.deepEqual(run('[...data.rows, 4].filter(n => n % 2 === 0).map((n, i) => ({id: String(n), label: `${i}: ${n}`}))',{data:{rows:[1,2,3]}}),[{id:'2',label:'0: 2'},{id:'4',label:'1: 4'}])
 assert.equal(run('"  Train G1  ".trim().toLowerCase().replace("g1", "g2")'),'train g2')
 assert.deepEqual(run('({...state, [event.id]: event.value})',{state:{a:1},event:{id:'b',value:2}}),{a:1,b:2})
 assert.equal(run('[1,2,3].reduce((sum, n) => sum + n, 0)'),6)
 assert.equal(run('[1,2,3].some(n => n > 2)'),true)
 assert.equal(run('[1,2,3].every(n => n > 0)'),true)
 assert.equal(run('[1,2,3].findIndex(n => n === 2)'),1)
 assert.deepEqual(run('Object.fromEntries(Object.entries({a:1,b:2}).filter(pair => pair[1]>1))'),{b:2})
})
test('nested arrow bindings capture lexically and may shadow host root names',()=>{
 assert.deepEqual(run('data.rows.map(row => row.values.map(value => value + row.offset + state.bias))',{data:{rows:[{offset:10,values:[1,2]},{offset:20,values:[3]}]},state:{bias:100}}),[[111,112],[123]])
 assert.deepEqual(run('[1,2].map(x => [3,4].map(x => x * 2))'),[[6,8],[6,8]])
 assert.deepEqual(run('[1,2].map(state => state + 1)',{state:{unused:true}}),[2,3])
 const result=compile('<data id="rows" value={[1,2]}/><text>{data.rows.map(state => state + 1).join(",")}</text>')
 assert.equal(result.complete,true,JSON.stringify(result.diagnostics))
})
test('JS semantics are versioned and survive AST serialization',()=>{
 assert.equal(evaluate(parseExpression('1/0'),{}),0)
 assert.equal(run('1/0'),Infinity)
 assert.equal(evaluate(parseExpression('"1" == 1'),{}),false)
 assert.equal(run('"1" == 1'),true)
 assert.equal(run('String(null)'),'null')
 assert.equal(run('Number("bad")'),NaN)
 assert.equal(run('Number.isNaN(NaN)'),true)
 assert.equal(evaluate(JSON.parse(JSON.stringify(parse('Infinity'))),{}),Infinity)
 assert.equal(evaluate(parseExpression('data.missing'),{data:{}}),null)
 assert.equal(run('data.missing',{data:{}}),undefined)
 assert.equal(run('[1].find(x => x > 3)'),undefined)
})
test('optional chains short circuit exactly across member/method chains',()=>{
 assert.equal(run('data.value?.name.toUpperCase() ?? "unknown"',{data:{value:null}}),'unknown')
 assert.equal(run('data.value?.map(x => x.n) ?? []',{data:{value:null}}).length,0)
 assert.throws(()=>run('(data.value?.name).length',{data:{value:null}}),/null or undefined/)
 assert.throws(()=>run('data.value?.name.length',{data:{value:{}}}),/null or undefined/)
 assert.equal(run('data.value?.name?.length ?? 0',{data:{value:{}}}),0)
})
test('markup boundary supports nested templates, comments and escaped entities',()=>{
 for(const expr of ['`a } ${state.n} ${`b ${state.n + 1}`} c`','state.n /* } */ + 1','state.n &gt; 1 ? &quot;} yes&quot; : &quot;no&quot;']){
  const result=compile(`<state id="n" type="number" initial={2}/><text>{${expr}}</text><text>after</text>`)
  assert.equal(result.complete,true,JSON.stringify(result.diagnostics));assert.equal(result.spec.children.length,2)
 }
 const bad=compile('<text>{Math.round(1); fetch("x")}</text>');assert.equal(bad.complete,false)
 const logic=compile('<logic id="counterLogic" initial={{n:0}} source={`function update(state,event,input) {\nif(event.type === "add") state.n++;\nreturn state;\n}`}><stat label="n" value={local.n}/><button onPress="add">Add</button></logic>')
 assert.equal(logic.complete,true,JSON.stringify(logic.diagnostics))
})
test('pure subset denies host access, mutation, unsafe keys and disguised calls',()=>{
 for(const s of ['fetch("https://example.com")','Date.now()','Math.random()','state.n++','state.n = 2','new Date()','(()=>1)()','data.rows.sort()','data.rows.map(x => { return x })','data.rows.map(async x => x)','data.rows.map(({x}) => x)','data.constructor','({__proto__: {}})','Object.getPrototypeOf(data)','data["constructor"]','data.rows[method](x => x)'])assert.throws(()=>parse(s),undefined,s)
 assert.throws(()=>run('data[key]',{data:{},key:'constructor'}),/forbidden/)
 assert.throws(()=>run('Object.fromEntries([["__proto__", {}]])'),/safe key/)
 assert.throws(()=>run('({[key]:1})',{key:'constructor'}),/forbidden/)
})
test('work and output limits cover callbacks and large results',()=>{
 const rows=Array.from({length:300},(_,i)=>i)
 assert.throws(()=>run('data.rows.map(a => data.rows.map(b => a+b))',{data:{rows}}),/budget/)
 assert.throws(()=>run('data.rows.concat(data.rows)',{data:{rows:Array(600).fill(0)}}),/limit/)
 assert.throws(()=>run('"abc".replaceAll("", data.text)',{data:{text:'x'.repeat(20000)}}),/limit/)
 assert.throws(()=>evaluate(parse('1+1'),{}, {remaining:0}),/budget/)
})
test('static host dependencies remain visible through nested callbacks and optional access',()=>{
 const ast=parse('bindings.feed.value?.items.filter(row => row.score >= state.min).map(row => ({id:row.id, value:derived.factor * row.score})) ?? []')
 const spec={derived:{factor:parse('bindings.factor.value.amount')},bindings:{result:{input:ast}}}
 assert.deepEqual(new Set(bindingDependencies(spec,'result')),new Set(['feed','factor']))
 assert.deepEqual(expressionReads(spec,ast,'state'),['min'])
 assert.deepEqual(collectionBindings(spec,ast),['feed'])
 assert.deepEqual(expressionReads({},parse('[1].map(state => state + 1)'),'state'),[])
 const invalid=compile('<text>{[].map(x => state.missing + x)}</text>');assert.equal(invalid.complete,false);assert.ok(invalid.diagnostics.some(d=>d.message.includes('unknown state.missing')))
})
test('JS actions preserve snapshot/next semantics and fail atomically',()=>{
 const result=compile('<state id="balance" type="number" initial={10}/><state id="receipt" type="record" initial={{}}/><action id="pay"><set target="balance" value={Math.max(0,state.balance-3)}/><set target="receipt" value={{before:state.balance,after:next.balance}}/></action><action id="bad"><set target="balance" value={state.balance+1}/><set target="receipt" value={{bad:1/0}}/></action><button onPress="pay">Pay</button>')
 assert.equal(result.complete,true,JSON.stringify(result.diagnostics))
 const store=createStore();makeScope(result.spec,store);executeAction(result.spec,store,'pay')
 assert.equal(store.values.balance,7);assert.deepEqual(store.values.receipt,{before:10,after:7})
 assert.throws(()=>executeAction(result.spec,store,'bad'));assert.equal(store.values.balance,7)
})

test('optional object fields are omitted at JSON commit; required scalar and invalid array values still roll back',()=>{
 const result=compile('<state id="saved" type="record" initial={{}}/><state id="items" type="array" initial={[]}/><state id="n" type="number" initial={0}/><action id="save"><set target="saved" value={{id:args.id,year:args.year,nested:{known:1,missing:args.missing}}}/><append target="items" value={{id:args.id,year:args.year}}/></action><action id="bad"><increment target="n" value={1}/><set target="items" value={[args.missing]}/></action><action id="badScalar"><set target="n" value={args.missing}/></action><text>Save</text>')
 assert.equal(result.complete,true,JSON.stringify(result.diagnostics))
 const store=createStore();makeScope(result.spec,store);executeAction(result.spec,store,'save',{args:{id:'a'}})
 assert.deepEqual(store.values.saved,{id:'a',nested:{known:1}});assert.deepEqual(store.values.items,[{id:'a'}])
 assert.deepEqual(store.values,JSON.parse(JSON.stringify(store.values)))
 assert.throws(()=>executeAction(result.spec,store,'bad',{args:{}}));assert.equal(store.values.n,0);assert.deepEqual(store.values.items,[{id:'a'}])
 assert.throws(()=>executeAction(result.spec,store,'badScalar',{args:{}}));assert.equal(store.values.n,0)
})

test('event.args is a lexical-safe alias with preserved action dataflow',()=>{
 const ast=parse('event.args?.id ?? args.fallback')
 assert.equal(evaluate(ast,{event:{},args:{id:'a'}}),'a')
 assert.deepEqual(expressionReads({},ast,'args'),['id','fallback'])
 assert.deepEqual(run('[{args:{id:"inner"}}].map(event=>event.args.id)',{args:{id:'outer'}}),['inner'])
 const result=compile('<state id="done" type="record" initial={{}}/><checkbox label="Task" args={{id:"a"}} checked={state.done.a===true} onChange="toggle"/><action id="toggle"><set target="done" key={event.args.id} value={event.checked}/></action>')
 assert.equal(result.complete,true,JSON.stringify(result.diagnostics))
 const store=createStore();makeScope(result.spec,store);executeAction(result.spec,store,'toggle',{event:{checked:true},args:{id:'a'}});assert.deepEqual(store.values.done,{a:true})
})
test('unique read namespace compatibility never rewrites writes, next or ambiguous names',()=>{
 const result=compile('<state id="n" type="number" initial={1}/><state id="old" type="number" initial={0}/><derive id="twice" value={state.n*2}/><text>{state.twice}</text><button onPress="go">Go</button><action id="go"><set target="n" value={state.n+1}/><set target="old" value={state.twice}/></action>')
 assert.equal(result.complete,true,JSON.stringify(result.diagnostics));assert.ok(result.diagnostics.some(d=>d.code==='binding_namespace_normalized'))
 const store=createStore();makeScope(result.spec,store);executeAction(result.spec,store,'go');assert.equal(store.values.old,2);assert.equal(store.values.n,2)
 assert.equal(compile('<data id="x" value={1}/><derive id="x" value={2}/><text>{state.x}</text>').complete,false)
 assert.equal(compile('<derive id="x" value={2}/><text>{next.x}</text>').complete,false)
 assert.equal(compile('<derive id="x" value={2}/><button onPress="go">Go</button><action id="go"><set target="x" value={3}/></action>').complete,false)
 const legacy=compileCard('<card><derive id="x" value={2}/><text>{state.x}</text></card>',{final:true});assert.equal(legacy.complete,false)
})

test('unique declaration names act like variables with lexical locals taking precedence',()=>{
 const result=compile('<data id="items" value={[1,2]}/><state id="n" type="number" initial={3}/><state id="before" type="number" initial={0}/><derive id="total" value={items.reduce((sum,n)=>sum+n,0)+n}/><text>{total}</text><button onPress="go">Go</button><action id="go"><set target="n" value={n+1}/><set target="before" value={total}/></action>')
 assert.equal(result.complete,true,JSON.stringify(result.diagnostics))
 assert.deepEqual(expressionReads(result.spec,result.spec.derived.total,'state'),['n'])
 const store=createStore(),scope=makeScope(result.spec,store);assert.equal(scope.derived.total,6);executeAction(result.spec,store,'go');assert.equal(store.values.n,4);assert.equal(store.values.before,6)
 const ambiguous=compile('<data id="x" value={1}/><state id="x" type="number" initial={2}/><text>{x}</text>');assert.equal(ambiguous.complete,false)
 const lexical=compile('<data id="entry" value={99}/><each items={[{id:"a",value:4}]} as="entry" itemKey={entry.id}><text>{entry.value}</text></each>');assert.equal(lexical.complete,true,JSON.stringify(lexical.diagnostics))
})
