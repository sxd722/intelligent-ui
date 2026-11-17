import test from 'node:test'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {generationLayout} from '../shared/cardspec/generation-layout.mjs'
import {generationSettings} from '../shared/cardspec/generation-settings.mjs'
import {activeBindings} from '../shared/cardspec/binding-schedule.mjs'
import {createStore,makeScope} from '../shared/cardspec/store.mjs'
import {createCardSession} from '../src/cardspec/tool-session.mjs'
import {diagramWindow} from '../shared/cardspec/diagram-window.mjs'
import {diagramLayout} from '../shared/cardspec/widgets.mjs'
import {selectionRelationDiagnostics} from '../shared/cardspec/task-behavior.mjs'
import {mapToolPresentation} from '../shared/cardspec/tool-presentations.mjs'
const source='<card><state id="query" type="string" initial="青牛精"/><binding id="evidence" tool="opencli.weread.book-search" input={{book:"西游记",query:state.query,limit:3}} load="visible"/><region id="case" overflow="destination" label="案例"><text>解读</text><region id="proof" overflow="destination" label="证据"><tool-view binding="evidence"/></region></region><action id="change"><set target="query" value="白骨精"/></action></card>'
const compile=()=>{const c=compileCard(source,{final:true,context:{expressionDialect:'js-v1'}});assert.ok(c.complete,JSON.stringify(c.diagnostics));return c.spec}
test('content organization survives settings and overrides full-page unfolding without changing source capacity',()=>{
 assert.equal(generationSettings({contentMode:'guided'}).contentMode,'guided');assert.equal(generationSettings({contentMode:'evil'}).contentMode,undefined)
 const layout=generationLayout('full','page',{contentMode:'guided'})
 assert.match(layout.instruction,/destination/);assert.doesNotMatch(layout.instruction,/不用segmented/)
 assert.equal(layout.maxSourceCharacters,generationLayout('full').maxSourceCharacters)
})
test('nested destination consumers wait for entry and pause when another destination is current',()=>{
 const spec=compile(),scope=makeScope(spec,createStore())
 for(const regions of [{},{case:true,$destination:'case'},{case:true,proof:true,$destination:'case'}])assert.equal(activeBindings(spec,scope,regions).has('evidence'),false)
 assert.equal(activeBindings(spec,scope,{case:true,proof:true,$destination:'proof'}).has('evidence'),true)
})
test('selection-dependent evidence cancels stale request and accepts only latest result',async()=>{
 const pending=[],s=createCardSession(compile(),{transport:(payload,signal)=>new Promise(resolve=>pending.push({payload,signal,resolve}))})
 try{s.setActivity({visible:true,complete:true});assert.equal(pending.length,0)
 s.setRegionVisibility('case',true);s.setRegionVisibility('$destination','proof');s.setRegionVisibility('proof',true)
 await new Promise(r=>setTimeout(r,5));assert.equal(pending.length,1);assert.equal(pending[0].payload.input.query,'青牛精')
 s.fire('change');s.tick();await new Promise(r=>setTimeout(r,5));assert.equal(pending.length,2);assert.equal(pending[0].signal.aborted,true)
 const result=title=>({kind:'json',value:{items:[{title}],source:'test',fetchedAt:new Date().toISOString(),truncated:false}})
 pending[1].resolve(result('新证据'));await new Promise(r=>setTimeout(r,5));pending[0].resolve(result('旧证据'));await new Promise(r=>setTimeout(r,5))
 assert.equal(s.current().bindings.evidence.value.items[0].title,'新证据')
 }finally{s.dispose()}
})
test('graph focus preserves neighbors and edges, all nodes stay in source for overview',()=>{
 const nodes=Array.from({length:11},(_,i)=>({id:String(i),label:'节点'+i})),edges=[{from:'0',to:'1'},{from:'2',to:'3'},{from:'2',to:'4'},{from:'5',to:'6'}]
 const focused=diagramWindow('flowchart',nodes,edges,'2',true)
 assert.deepEqual(focused.nodes.map(n=>n.id),['2','3','4']);assert.equal(focused.edges.length,2)
 assert.equal(diagramWindow('flowchart',nodes,edges,'2',false).nodes.length,11)
 assert.ok(diagramLayout('flowchart',nodes,edges,'vertical',{width:280,height:160}).width<=280)
})
test('evidence slots preserve actual snippets without inventing missing chapter titles',()=>{
 const view=mapToolPresentation('opencli.weread.book-search',{items:[{book_id:'1',chapter_title:null,snippet:'原始检索片段'}]})
 assert.ok(view.ok);assert.equal(view.items[0].summary,'原始检索片段');assert.equal(view.items[0].title,'结果 1')
})
test('selection relation honors data-only guarded assignment, but does not waive state-dependent guards',()=>{
 const prefix='<card><data id="cases" value={[{id:"a",title:"A"}]}/><state id="s" type="string" initial="a"/><state id="on" type="boolean" initial={false}/><derive id="cur" value={data.cases.find(x=>x.id===state.s)??data.cases[0]}/><flowchart nodes={[{id:"a",label:"A"},{id:"group",label:"Group"}]} edges={[]} onSelect="pick"/><text>{derived.cur.title}</text><action id="pick"><set target="s" value={event.id}'
 for(const [guard,errors] of [[' when={data.cases.some(x=>x.id===event.id)}',0],['',1],[' when={state.on}',1]]){
  const r=compileCard(prefix+guard+'/></action></card>',{final:true,context:{expressionDialect:'js-v1'}})
  assert.equal(selectionRelationDiagnostics(r.spec).length,errors)
 }
})
