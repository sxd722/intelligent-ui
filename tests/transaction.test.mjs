import test from 'node:test'
import assert from 'node:assert/strict'
import { compileCard } from '../shared/cardspec/compiler.mjs'
import { createStore, makeScope, executeAction } from '../shared/cardspec/store.mjs'
import { fragmentProse } from '../shared/cardspec/prose.mjs'
import { diagramLayout } from '../shared/cardspec/widgets.mjs'
const prepare=(body,mode='snapshot')=>{
 const result=compileCard(`<card${mode?` actionMode="${mode}"`:''}>${body}<text>test</text></card>`,{final:true})
 assert.equal(result.complete,true,JSON.stringify(result.diagnostics))
 const store=createStore();makeScope(result.spec,store);return {spec:result.spec,store,run:(id,extra)=>executeAction(result.spec,store,id,extra)}
}
test('same damage expressions use entry snapshot: no premature victory or repeated loss',()=>{
 const body='<state id="hp" type="number" initial={10}/><state id="won" type="boolean" initial={false}/><action id="hit"><set target="hp" value={max(0,state.hp-3)}/><set target="won" value={state.hp-3<=0}/></action>'
 const game=prepare(body)
 for(const hp of [7,4,1,0]){game.run('hit');assert.equal(game.store.values.hp,hp);assert.equal(game.store.values.won,hp===0)}
 const legacy=prepare(body,'');for(let i=0;i<3;i++)legacy.run('hit')
 assert.equal(legacy.store.values.hp,1);assert.equal(legacy.store.values.won,true) // legacy contract is deliberate
})
test('next expresses dependent writes; state and derived retain transaction entry values',()=>{
 const flow=prepare('<state id="capacity" type="number" initial={5}/><state id="available" type="number" initial={0}/><state id="old" type="number" initial={0}/><derive id="double" value={state.capacity*2}/><action id="fill"><set target="capacity" value={state.capacity+1}/><set target="available" value={next.capacity}/><set target="old" value={derived.double}/></action>')
 flow.run('fill');assert.deepEqual({...flow.store.values},{capacity:6,available:6,old:10})
 assert.equal(makeScope(flow.spec,flow.store).derived.double,12)
})
test('checkout snapshot survives clearing collection first and future edits',()=>{
 const flow=prepare('<state id="items" type="array" initial={[{id:"a",amount:22}]}/><state id="receipt" type="record" initial={{}}/><derive id="total" value={sum(state.items,item.amount)}/><action id="pay"><set target="items" value={[]}/><set target="receipt" value={{items:state.items,total:derived.total,paid:derived.total>=20?derived.total-5:derived.total}}/></action><action id="add"><append target="items" value={{id:"new",amount:3}}/></action>')
 flow.run('pay');assert.equal(flow.store.values.receipt.paid,17);assert.equal(flow.store.values.receipt.items.length,1);assert.equal(flow.store.values.items.length,0)
 flow.run('add');assert.equal(flow.store.values.receipt.total,22)
})
test('transfer, quiz and final-round boundaries read one coherent snapshot',()=>{
 const flow=prepare('<state id="from" type="number" initial={8}/><state id="to" type="number" initial={2}/><state id="score" type="number" initial={0}/><state id="turn" type="number" initial={1}/><state id="over" type="boolean" initial={false}/><action id="move"><set target="from" value={state.from-2}/><set target="to" value={state.to+2}/></action><action id="answer"><set target="score" value={state.score+1}/><set target="turn" value={min(state.turn+1,3)}/><set target="over" value={state.turn>=3}/></action>')
 flow.run('move');assert.equal(flow.store.values.from+flow.store.values.to,10)
 for(let i=1;i<=3;i++){flow.run('answer');assert.equal(flow.store.values.score,i);assert.equal(flow.store.values.over,i===3)}
})
test('failed dependent writes roll back; unknown next fields are compile errors',()=>{
 const flow=prepare('<state id="n" type="number" initial={1}/><state id="label" type="string" initial="ok"/><action id="bad"><set target="n" value={state.n+1}/><set target="label" value={next.n}/></action>')
 assert.throws(()=>flow.run('bad'),/state type violation/);assert.equal(flow.store.values.n,1)
 const result=compileCard('<card actionMode="snapshot"><text>{next.missing}</text></card>',{final:true});assert.equal(result.complete,false)
})
test('prose fragmentation preserves all text including CJK, punctuation and whitespace',()=>{
 for(const text of ['中文。'.repeat(150),'English sentence. Next one!\n'.repeat(60),'A very long unbroken paragraph without punctuation'.repeat(20),'“中文”、English 1.25元。下一段。']) assert.equal(fragmentProse(text).join(''),text)
})

test('derived getters stay at entry even when referencing next explicitly',()=>{
 const flow=prepare('<state id="n" type="number" initial={1}/><state id="old" type="number" initial={0}/><derive id="before" value={next.n}/><action id="go"><set target="n" value={3}/><set target="old" value={derived.before}/></action>')
 flow.run('go');assert.equal(flow.store.values.old,1);assert.equal(makeScope(flow.spec,flow.store).derived.before,3)
})

test('guarded writes preserve collections and share snapshot/next semantics',()=>{
 const flow=prepare('<state id="amount" type="number" initial={2}/><state id="seq" type="number" initial={0}/><state id="items" type="array" initial={[]}/><action id="add"><increment target="seq" when={state.amount>0}/><append target="items" when={state.amount>0} value={{id:next.seq,amount:state.amount}}/><set target="amount" value={0}/></action><action id="refill"><set target="amount" value={3}/></action><action id="skip"><set target="amount" when={false} value={1/0}/></action><action id="bad"><set target="amount" value={4}/><set target="seq" when={next.amount} value={100}/></action>')
 flow.run('add');flow.run('add');flow.run('refill');flow.run('add');flow.run('skip')
 assert.deepEqual(flow.store.values.items,[{id:1,amount:2},{id:2,amount:3}]);assert.equal(flow.store.values.seq,2)
 assert.throws(()=>flow.run('bad'),/when must evaluate to boolean/);assert.equal(flow.store.values.amount,0)
})

test('compact diagrams use both axes without losing nodes or relationships',()=>{
 for(const nodes of [
  [{id:'root',label:'Root'},{id:'a',label:'Read',parentId:'root'},{id:'b',label:'Practice',parentId:'root'},{id:'c',label:'Notes',parentId:'a'}],
  [{id:'root',label:'Root'},...Array.from({length:6},(_,i)=>({id:String(i),label:'Branch '+i,parentId:'root'}))],
 ]){
  const graph=diagramLayout('mindmap',nodes,[],'horizontal',{width:272,height:196})
  assert.ok(Math.min(272/graph.width,196/graph.height)>=.85)
  assert.equal(graph.nodes.length,nodes.length);assert.equal(graph.edges.length,nodes.length-1)
  for(let i=0;i<graph.nodes.length;i++)for(let j=i+1;j<graph.nodes.length;j++)assert.ok(Math.abs(graph.nodes[i].x-graph.nodes[j].x)>=graph.nodeWidth||Math.abs(graph.nodes[i].y-graph.nodes[j].y)>=graph.nodeHeight)
 }
})
