import {existsSync} from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
import {observableContent} from '../shared/cardspec/feedback-diagnostics.mjs'
const context={expressionDialect:'js-v1'}
const compile=source=>compileCard(source,{final:true,context})
const ready=source=>{const result=compile(source);assert.equal(result.complete,true,JSON.stringify(result.diagnostics));return result.spec}

test('JSX map lowers into native each with explicit stable identity and action arguments',()=>{
 const prefix='<card><data id="rows" value={[{rowKey:"a",name:"Alpha"},{rowKey:"b",name:"Beta"}]}/><state id="chosen" type="string" initial=""/>'
 const suffix='<text>{state.chosen}</text><action id="pick"><set target="chosen" value={args.rowKey}/></action></card>'
 const jsx=ready(prefix+'{data.rows.map(row=><button key={row.rowKey} onPress="pick" args={row}>{row.name}</button>)}'+suffix)
 const native=ready(prefix+'<each items={data.rows} as="row" itemKey={row.rowKey}><button onPress="pick" args={row}>{row.name}</button></each>'+suffix)
 assert.equal(jsx.children[0].type,'each');assert.equal(jsx.children[0].props.as.value,'row')
 const a=createStore(),b=createStore();makeScope(jsx,a);makeScope(native,b)
 assert.equal(observableContent(jsx,a),observableContent(native,b))
 executeAction(jsx,a,'pick',{args:{rowKey:'b',name:'Beta'}})
 assert.equal(a.values.chosen,'b')
})

test('nested JSX maps preserve named outer rows, conditionals, fragments and escaped text',()=>{
 const spec=ready(`<card><state id="show" type="boolean" initial={true}/><data id="groups" value={[{id:"g",rows:[{id:"a",name:"A"}]}]}/>
 {state.show ? <><caption>A &amp; B</caption>{data.groups.map(group=><stack key={group.id}>{group.rows.map(row=><text key={row.id}>{group.id+row.name}</text>)}</stack>)}</> : <text>Hidden</text>}
 {state.show && <text>Visible</text>}
 <action id="hide"><set target="show" value={false}/></action></card>`)
 const store=createStore();makeScope(spec,store)
 assert.match(observableContent(spec,store),/gA/);assert.match(observableContent(spec,store),/A & B/)
 executeAction(spec,store,'hide');assert.doesNotMatch(observableContent(spec,store),/gA|Visible/);assert.match(observableContent(spec,store),/Hidden/)
})

test('JSX cannot introduce executable callbacks, arbitrary HTML, data JSX, prop spreads or missing identities',()=>{
 for(const content of [
  '<div>HTML</div>', '<script>fetch("x")</script>', '<UI.Button/>',
  '<button onPress={()=>fetch("x")}>Run</button>', '<button {...state.props}>Run</button>',
  '<text label={<text/>}/>', 'data.rows.map(row=><text>{row.id}</text>)',
  'data.rows.map((row,i)=><text key={i}>{row.id}</text>)',
  'data.rows.map(row=>{return <text key={row.id}/>})',
  'data.rows.forEach(row=><text key={row.id}/>)',
 ]){
  const r=compile('<card><data id="rows" value={[{id:"a"}]}/><state id="props" type="record" initial={{}}/>{'+content+'}</card>')
  assert.equal(r.complete,false,content)
 }
 const legacy=compileCard('<card><data id="rows" value={[{id:"a"}]}/>{data.rows.map(row=><text key={row.id}>{row.id}</text>)}</card>',{final:true})
 assert.equal(legacy.complete,false,'legacy never changes dialect implicitly')
})

test('JSX failures keep following native siblings and report source offsets',()=>{
 const source='<card>\n{[1].map(row=><text>{row}</text>)}\n<text>Preserved sibling</text></card>'
 const result=compile(source)
 assert.ok(result.diagnostics.some(d=>d.code==='jsx'&&d.line===2&&d.message.includes('stable key')))
 assert.match(JSON.stringify(result.spec.children),/Preserved sibling/)
 for(const suffix of ['{rows.map(row=>','{rows.map(row=><text key={row.id}>']){
  const partial=compileCard('<card>'+suffix,{context})
  assert.equal(partial.complete,false)
 }
})

test('actual immutable failed family output passes JSX parsing without rewriting its model source',{skip: ["artifacts/javascript-upgrade/flash-baselines-r10/family.json"].every(existsSync) ? false : "Private historical replay artifacts excluded from source export"}, ()=>{
 const record=JSON.parse(readFileSync('artifacts/javascript-upgrade/flash-baselines-r10/family.json','utf8'))
 const source=record.trace.filter(e=>e.type==='diagnostics').at(-1).source
 const result=compile(source)
 assert.ok(!result.diagnostics.some(d=>['expression','jsx'].includes(d.code)&&d.severity==='error'),JSON.stringify(result.diagnostics))
 // Domain/layout correctness is explicitly not inferred from syntax acceptance.
})
