import test from 'node:test'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
import {taskOutputSnapshot,selectionRelationDiagnostics,taskBehaviorDiagnostics} from '../shared/cardspec/task-behavior.mjs'
import {journeyRequirements,journeyCoverage} from '../server/cardspec/journey-coverage.mjs'
import {createDeckState} from '../src/cardspec/deck-state.mjs'
import {createCardSession} from '../src/cardspec/tool-session.mjs'
import {deckInterface,deckCoverage} from '../server/cardspec/deck-contract.mjs'
import {resolveClickStep} from '../server/cardspec/build-feedback.mjs'
import {summarizeDebugFeedback} from '../server/cardspec/debug-feedback.mjs'
const context={expressionDialect:'js-v1'}
const goal='**关键用户旅程**\nCUJ-1【必需】选择主题→展示对应解释\nCUJ-2【必需】记录并编辑或删除，刷新恢复\nCUJ-3【建议】标记掌握并共享\n\n**内容与构图**\n简洁排版'
test('explicit CUJs retain identity, optionality and CRUD classification; headings are not requirements',()=>{
 const rows=journeyRequirements(goal);assert.equal(rows.length,3);assert.deepEqual(rows.map(r=>[r.id,r.cujId,r.required]),[['R1','CUJ-1',true],['R2','CUJ-2',true],['R3','CUJ-3',false]]);assert.equal(rows[1].kind,'interaction')
 const scoped=journeyCoverage('short sibling',{context:{journeys:rows,journeyIds:['R2']},children:[]},{status:'tested',runs:[]})
 assert.equal(scoped.items[0].status,'other-card');assert.equal(scoped.items[1].id,'R2')
})
const source=scope=>`<card><state id="selected" type="string" initial="a" ${scope?'scope="deck"':''}/><state id="draft" type="string" initial=""/><text>{state.selected}</text><action id="choose"><set target="selected" value={args.id}/></action><action id="fail"><set target="selected" value="bad"/><set target="draft" value={99}/></action></card>`
const spec=(id,shared=true)=>{const r=compileCard(source(shared),{final:true,cardId:id,context});assert.equal(r.complete,true,JSON.stringify(r.diagnostics));return r.spec}
test('shared scope survives sibling unmount and refresh; locals and other decks remain isolated',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)}
 const deck=createDeckState({storage,key:'deck'}),a=createCardSession(spec('a'),{deckState:deck}),b=createCardSession(spec('b'),{deckState:deck}),local=createCardSession(spec('local',false),{deckState:deck})
 a.fire('choose',{args:{id:'b'}});assert.equal(b.scope().state.selected,'b');assert.equal(local.scope().state.selected,'a')
 assert.throws(()=>a.fire('fail'));assert.equal(b.scope().state.selected,'b')
 a.dispose();b.dispose();local.dispose()
 const restored=createCardSession(spec('restored'),{deckState:createDeckState({storage,key:'deck'})});assert.equal(restored.scope().state.selected,'b')
 const other=createCardSession(spec('other'),{deckState:createDeckState()});assert.equal(other.scope().state.selected,'a');restored.dispose();other.dispose()
})
test('siblings receive explicit state interface, not invented types or implicitly shared names',()=>{
 const contract=deckInterface(spec('a'));assert.deepEqual(Object.keys(contract.states),['selected'])
 const r=compileCard('<card><state id="selected" type="number" initial={0} scope="deck"/><text>test</text></card>',{final:true,context:{...context,deckInterface:contract}});assert.equal(r.complete,false)
 const summary=deckCoverage(goal,[{id:'a',spec:{...spec('a'),requirementCoverage:{items:[{id:'R1',status:'checked'}]}}}]);assert.equal(summary.items[0].status,'locally-checked');assert.equal(summary.status,'partial')
})
test('region result detects scoped content changes; text input echo alone does not change output',()=>{
 const r=compileCard('<card><state id="n" type="number" initial={1}/><state id="draft" type="string" initial=""/><region id="result"><input label="输入" value={state.draft} onChange="edit"/><each items={[{id:"x",title:"结果"+state.n}]} as="row" itemKey={row.id}><text>{row.title}</text></each></region><action id="edit"><set target="draft" value={event.value}/></action><action id="inc"><increment target="n"/></action></card>',{final:true,context});assert.equal(r.complete,true,JSON.stringify(r.diagnostics));const store=createStore(),read=()=>taskOutputSnapshot(r.spec,makeScope(r.spec,store)).result
 const before=read();executeAction(r.spec,store,'edit',{event:{value:'echo'}});assert.deepEqual(read(),before);executeAction(r.spec,store,'inc');assert.notDeepEqual(read(),before)
})
test('selectable graph branch without matching detail cannot be hidden by fallback',()=>{
 const r=compileCard('<card><data id="nodes" value={[{id:"root",label:"root"},{id:"a",label:"A",parentId:"root"}]}/><data id="details" value={[{id:"a",text:"A"}]}/><state id="sel" type="string" initial="a"/><derive id="cur" value={data.details.find(x=>x.id===state.sel)??data.details[0]}/><mindmap nodes={data.nodes} label="tree" selectedId={state.sel} onSelect="pick"/><text>{derived.cur.text}</text><action id="pick"><set target="sel" value={event.id}/></action></card>',{final:true,context});assert.ok(selectionRelationDiagnostics(r.spec).some(d=>d.message.includes('root')))
})
test('a click without result change cannot satisfy a CUJ; sibling requirements do not enter local repair',()=>{
 const card={context:{journeys:journeyRequirements(goal),journeyIds:['R1']},children:[]}
 const cujCoverage=journeyCoverage(goal,card,{status:'tested',runs:[{scenario:'normal',width:432,actions:[{ok:true,resultChanged:false,step:{op:'click',requirement:'R1',expect:{text:'unchanged'}},assertion:{passed:true}}]}]})
 assert.equal(cujCoverage.items[0].status,'unverified')
 const feedback=summarizeDebugFeedback({cujCoverage,diagnostics:[]})
 assert.deepEqual(feedback.cuj.remaining.map(x=>x.id),['R1'])
})
test('click resolution uses unique visible labels and actual roles, never ambiguous fragments',()=>{
 const controls=[{name:'今本 明代传本',role:'radio',handle:'b'},{name:'古本 辑佚复原',role:'radio',handle:'a'}]
 assert.equal(resolveClickStep({op:'click',name:'今本',role:'button'},controls).handle,'b')
 assert.equal(resolveClickStep({op:'click',name:'本'},controls).handle,undefined)
 assert.equal(resolveClickStep({op:'click',name:'今本'},[...controls,{name:'今本 其他',role:'radio'}]).handle,undefined)
})
test('an optional empty related collection is not a mismatched primary detail',()=>{
 const r=compileCard('<card><data id="nodes" value={[{id:"root",label:"root"},{id:"a",label:"A"}]}/><data id="quiz" value={[{id:"q1",topic:"a"}]}/><state id="sel" type="string" initial="a"/><derive id="exercise" value={data.quiz.find(x=>x.topic===state.sel)??null}/><mindmap nodes={data.nodes} label="tree" selectedId={state.sel} onSelect="pick"/><if test={derived.exercise}><text>{derived.exercise.id}</text></if><action id="pick"><set target="sel" value={event.id}/></action></card>',{final:true,context})
 assert.deepEqual(selectionRelationDiagnostics(r.spec),[])
})
test('caption content is a real output consumer, unlike an input echo',()=>{
 const r=compileCard('<card><state id="topic" type="string" initial="a"/><segmented label="主题" value={state.topic} options={[{value:"a",label:"A"},{value:"b",label:"B"}]} onChange="pick"/><caption id="explain">{state.topic==="a"?"机制A":"机制B"}</caption><action id="pick"><set target="topic" value={event.value}/></action></card>',{final:true,context})
 assert.deepEqual(taskBehaviorDiagnostics(r.spec),[])
})
test('shared record interfaces preserve entity key domains across parent/child views',()=>{
 const first=compileCard('<card><state id="selected" type="string" initial="a"/><state id="marks" type="record" initial={{}} scope="deck"/><segmented value={state.selected} options={[{value:"a",label:"A"},{value:"b",label:"B"}]} onChange="pick"/><text>{state.marks[state.selected]}</text><action id="pick"><set target="selected" value={event.value}/></action></card>',{final:true,context}).spec
 const contract=deckInterface(first);assert.deepEqual(contract.states.marks.keyDomain,['a','b'])
 const sibling=key=>compileCard(`<card><state id="marks" type="record" initial={{}} scope="deck"/><data id="child" value={{id:"child-1",parentId:"a"}}/><text>{state.marks[data.child.${key}]}</text></card>`,{final:true,context:{...context,deckInterface:contract}}).spec
 assert.ok(taskBehaviorDiagnostics(sibling('id')).some(d=>d.code==='deck_entity_key'))
 assert.deepEqual(taskBehaviorDiagnostics(sibling('parentId')),[])
})
test('shared record status encodings cannot silently change between cards',()=>{
 const first=compileCard('<card><state id="flags" type="record" initial={{}} scope="deck"/><text>{state.flags.a===true}</text><action id="mark"><set target="flags" key="a" value={state.flags.a!==true}/></action></card>',{final:true,context}).spec
 const contract=deckInterface(first);assert.equal(contract.states.flags.valueType,'boolean')
 const sibling=compileCard('<card><state id="flags" type="record" initial={{}} scope="deck"/><text>{state.flags.a==="weak"}</text><action id="mark"><set target="flags" key="a" value="weak"/></action></card>',{final:true,context:{...context,deckInterface:contract}}).spec
 assert.ok(taskBehaviorDiagnostics(sibling).some(d=>d.code==='deck_value_encoding'))
})
