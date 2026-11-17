import test from 'node:test'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
import {expandExperimentalBehaviors,mapExpansionOffset,BEHAVIOR_REVISION} from '../shared/cardspec/experimental-behaviors.mjs'
import {MECHANISMS,executableMechanismMaterial} from '../shared/cardspec/experimental-mechanisms.mjs'

const context={expressionDialect:'js-v1'}
const envelope=inner=>`<card schemaVersion="1" actionMode="snapshot"><data id="records" value={[{id:"a",label:"one",note:"first"},{id:2,label:"two",note:"second"}]}/>${inner}<text id="selection">{state.inspect_selected}</text><button onPress="inspect_open" args={{id:"a"}}>Inspect</button><button onPress="inspect_back">Return</button></card>`
const macro='<behavior id="inspect" kind="inspect-return" items={data.records} keyField="id"/>'
function compile(source){const result=compileCard(source,{final:true,context});assert.deepEqual(result.diagnostics.filter(d=>d.severity==='error'),[]);assert.equal(result.complete,true);return result.spec}
function start(spec){const store=createStore();makeScope(spec,store);return store}
function current(spec,store){return makeScope(spec,store).derived.inspect_current}

test('C1 is byte-preserving when disabled and never changes ordinary source',()=>{
 const source=envelope(macro)
 assert.equal(expandExperimentalBehaviors(source).source,source)
 assert.equal(expandExperimentalBehaviors(source).applied,false)
 assert.ok(compileCard(source,{final:true,context}).diagnostics.some(d=>d.severity==='error'))
 const plain='<card><text>Plain</text></card>'
 assert.equal(expandExperimentalBehaviors(plain,{enabled:true}).source,plain)
})

test('inspect-return expands only to current declarations, preserves selection and restores it',()=>{
 const result=expandExperimentalBehaviors(envelope(macro),{enabled:true})
 assert.equal(result.revision,BEHAVIOR_REVISION)
 assert.equal(result.source.includes('<behavior'),false)
 const spec=compile(result.source),store=start(spec),effects=[]
 assert.equal(current(spec,store),null)
 executeAction(spec,store,'inspect_open',{args:{id:2},effects})
 assert.deepEqual(store.values,{inspect_selected:'2',inspect_view:'detail'})
 assert.equal(current(spec,store).note,'second')
 executeAction(spec,store,'inspect_back',{effects})
 assert.deepEqual(store.values,{inspect_selected:'2',inspect_view:'list'})
 const restored=JSON.parse(JSON.stringify(store));makeScope(spec,restored)
 assert.equal(current(spec,restored).note,'second')
 executeAction(spec,restored,'inspect_open',{args:{id:'a'},effects})
 assert.equal(current(spec,restored).note,'first')
 assert.deepEqual(effects,[])
})

test('C1 cannot invent an entity on missing, invalid or empty source input',()=>{
 const spec=compile(expandExperimentalBehaviors(envelope(macro),{enabled:true}).source),store=start(spec)
 for(const args of [{},{id:null},{id:'unknown'}])executeAction(spec,store,'inspect_open',{args})
 assert.deepEqual(store.values,{inspect_selected:'',inspect_view:'list'})
 const empty=compile(expandExperimentalBehaviors(envelope(macro.replace('data.records','null')),{enabled:true}).source),emptyStore=start(empty)
 executeAction(empty,emptyStore,'inspect_open',{args:{id:'a'}})
 assert.equal(current(empty,emptyStore),null)
 assert.equal(emptyStore.values.inspect_view,'list')
})

test('C1 is equivalent to manually authored CardSpec state/actions, not a runtime implementation',()=>{
 const expanded=compile(expandExperimentalBehaviors(envelope(macro),{enabled:true}).source)
 const manual=compile(envelope(`<state id="inspect_selected" type="string" initial=""/><state id="inspect_view" type="string" initial="list"/>
<derive id="inspect_current" value={data.records.find(x=>String(x.id)===state.inspect_selected)??null}/>
<action id="inspect_open"><set target="inspect_selected" value={String(args.id)} when={args.id!=null && data.records.some(x=>String(x.id)===String(args.id))}/><set target="inspect_view" value="detail" when={args.id!=null && data.records.some(x=>String(x.id)===String(args.id))}/></action>
<action id="inspect_back"><set target="inspect_view" value="list"/></action>`))
 const a=start(expanded),b=start(manual)
 for(const [action,args] of [['inspect_open',{id:'a'}],['inspect_back',{}],['inspect_open',{id:2}],['inspect_open',{id:'missing'}],['inspect_back',{}]]){
  executeAction(expanded,a,action,{args});executeAction(manual,b,action,{args})
  assert.deepEqual(a.values,b.values);assert.deepEqual(current(expanded,a),current(manual,b))
 }
})

test('C1 validates placement, names and collision without changing baseline compiler',()=>{
 for(const source of [envelope(macro.replace('keyField="id"','keyField="constructor"')),envelope(macro+'<state id="inspect_selected" type="string" initial=""/>'),envelope('<stack>'+macro+'</stack>'),envelope(macro.replace('/>',' extra="no"/>'))])assert.throws(()=>expandExperimentalBehaviors(source,{enabled:true}))
 assert.throws(()=>expandExperimentalBehaviors(envelope(macro),{enabled:true,dialect:'legacy'}),/js-v1/)
})

test('C1 uses parsed spans, maps generated diagnostics and preserves fenced offsets',()=>{
 const source='```xml\n'+envelope(macro)+'\n```',result=expandExperimentalBehaviors(source,{enabled:true})
 const span=result.sourceMap[0]
 assert.equal(source.slice(span.originalStart,span.originalEnd),macro)
 assert.equal(result.source.slice(span.expandedStart,span.expandedStart+7),'<state ')
 assert.deepEqual(mapExpansionOffset(span.expandedStart+12,result),{offset:span.originalStart,behaviorId:'inspect',generated:true})
 const tail=result.source.indexOf('<text id="selection">')
 assert.equal(mapExpansionOffset(tail,result).offset,source.indexOf('<text id="selection">'))
 compile(result.source)
 const embedded='<card><data id="literal" value={"<behavior id=\\\"never\\\"/>"}/><text>Literal</text></card>'
 const untouched=expandExperimentalBehaviors(embedded,{enabled:true});assert.equal(untouched.source,embedded);assert.equal(untouched.applied,false)
})

test('S2 fixed examples execute both distinct selection branches and snapshot next',()=>{
 assert.equal(executableMechanismMaterial().prompt,'')
 assert.deepEqual(executableMechanismMaterial({enabled:true}).ids,['inspect-return','snapshot-next'])
 const inspect=compile(MECHANISMS[0].source),s=start(inspect)
 executeAction(inspect,s,'open',{args:{id:'b'}});assert.equal(makeScope(inspect,s).derived.current.note,'圆点疏密')
 executeAction(inspect,s,'back');assert.equal(s.values.selected,'b');assert.equal(s.values.detail,false)
 const restored=JSON.parse(JSON.stringify(s));makeScope(inspect,restored);assert.equal(restored.values.selected,'b')
 executeAction(inspect,restored,'open',{args:{id:'a'}});assert.equal(makeScope(inspect,restored).derived.current.note,'细线交错')
 const next=compile(MECHANISMS[1].source),n=start(next)
 executeAction(next,n,'advance');assert.deepEqual(n.values,{n:3,doubled:6})
 executeAction(next,n,'advance');assert.deepEqual(n.values,{n:4,doubled:8})
})
