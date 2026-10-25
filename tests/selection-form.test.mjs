import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
import {evaluate,parseExpression} from '../shared/cardspec/expression.mjs'
import {handleCardSpec} from '../server/cardspec/handler.mjs'
import {TOOLS} from '../shared/cardspec/tools.mjs'

const binding='<binding id="results" tool="opencli.douban.search" input={{keyword:state.query,type:"movie"}} initial={{items:[],source:"",fetchedAt:"",truncated:false}} load="manual"/>'
const form=(disabled='state.query==""')=>`<card>${binding}<state id="query" type="string" initial=""/><action id="search"><invoke binding="results"/></action><button onPress="search" disabled={${disabled}}>搜索</button></card>`
const selection=(predicate='item.id==entry.rowKey',id='entry.rowKey')=>`<card actionMode="snapshot">${binding}<state id="query" type="string" initial="科幻"/><state id="picks" type="array" initial={[]}/><derive id="rows" value={bindings.results.value.items}/><each items={derived.rows} as="entry" itemKey={entry.rowKey}><pressable onPress="pick" args={{id:${id},title:entry.title}} selected={count(state.picks,${predicate})>0}><text>{entry.title}</text></pressable></each><action id="pick"><append target="picks" when={count(state.picks,item.id==args.id)==0} value={{id:args.id,title:args.title}}/><remove target="picks" key={args.id} when={count(state.picks,item.id==args.id)>0}/></action></card>`
const compile=source=>compileCard(source,{final:true})

test('disabled empty search form is valid; dispatch still validates current input',()=>{
 const c=compile(form());assert.equal(c.complete,true,JSON.stringify(c.diagnostics))
 const store=createStore();makeScope(c.spec,store);const effects=[]
 assert.throws(()=>executeAction(c.spec,store,'search',{effects}),/string length/)
 assert.equal(effects.length,0)
 store.values.query='星际'
 executeAction(c.spec,store,'search',{effects})
 assert.equal(effects[0].input.keyword,'星际')
 assert.equal(compile(form('false')).complete,false)
})

test('disabled events still receive structural and scope validation',()=>{
 assert.equal(compile('<card><button disabled onPress="missing">按钮</button></card>').complete,false)
 assert.equal(compile('<card><state id="q" type="string" initial=""/><action id="bad"><set target="q" value={unknown.x}/></action><button disabled onPress="bad">按钮</button></card>').complete,false)
})

test('self-comparison is detected before empty selection receives its first item',()=>{
 const c=compile(selection('item.id==item.id','entry.id'))
 assert.ok(c.diagnostics.some(d=>d.code==='collection_predicate'))
 assert.ok(c.diagnostics.some(d=>d.code==='tool_selection_identity'))
 assert.equal(compile(selection()).complete,true)
 // Local data comparisons remain supported without the OpenCLI row contract.
 assert.equal(compile(selection('item.id==entry.id','entry.id').replace('bindings.results.value.items','[]')).complete,true)
})

test('selection IDs cannot silently become duplicate titles or missing URLs',()=>{
 for(const field of ['title','url','id'])assert.ok(compile(selection(`item.id==entry.${field}`,`entry.${field}`)).diagnostics.some(d=>d.code==='tool_selection_identity'))
})

test('same-title rows remain independently selectable across domains',()=>{
 const c=compile(selection())
 for(const domain of ['film','product','course']){
  const store=createStore();makeScope(c.spec,store)
  const rows=[{rowKey:domain+'-a',title:'同名',id:null},{rowKey:domain+'-b',title:'同名',id:null}]
  const selected=row=>evaluate(parseExpression('count(state.picks,item.id==entry.rowKey)>0'),{...makeScope(c.spec,store),entry:row})
  const click=row=>executeAction(c.spec,store,'pick',{args:{id:row.rowKey,title:row.title}})
  click(rows[0]);assert.deepEqual(rows.map(selected),[true,false])
  click(rows[1]);assert.deepEqual(rows.map(selected),[true,true])
  click(rows[0]);assert.deepEqual(rows.map(selected),[false,true])
 }
})

test('existing single repair gets actionable selection diagnostics without a planning call',async()=>{
 const res=new EventEmitter(),frames=[];res.writeHead=()=>{};res.flushHeaders=()=>{}
 res.write=text=>{const body=text.slice(6).trim();if(body!=='[DONE]')frames.push(JSON.parse(body))};res.end=()=>{res.writableEnded=true}
 let calls=0
 await handleCardSpec({},res,{mode:'direct',messages:[{role:'user',content:'周末观影，科幻片'}]},{keyLoaded:true,model:'fixture',photo:async()=>null,toolCatalog:async()=>[{...TOOLS['opencli.douban.search'],available:true}],streamUpstream:async(messages,{onPiece})=>{
  if(++calls===1)onPiece({content:selection('item.id==item.id','entry.id')})
  else {assert.match(messages.at(-1).content,/collection_predicate/);assert.match(messages.at(-1).content,/tool_selection_identity/);onPiece({content:selection()})}
 }})
 assert.equal(calls,2);assert.equal(frames.find(f=>f.type==='message_stream_complete')?.status,'succeeded')
})
