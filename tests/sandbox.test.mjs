import test from 'node:test'
import assert from 'node:assert/strict'
import {getQuickJS} from 'quickjs-emscripten'
import {compileSandbox,generateSandbox} from '../server/cardspec/sandbox.mjs'
import {createSandboxVM} from '../shared/cardspec/sandbox-engine.mjs'
import {validateSandboxTree,SANDBOX_CAPABILITY,sandboxOwnershipDiagnostics} from '../shared/cardspec/sandbox-policy.mjs'
import {sandboxDocument} from '../src/cardspec/sandbox-document.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
import {generateCard} from '../server/cardspec/generation.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {SANDBOX_FIXTURE,SANDBOX_PURE,SANDBOX_REACT} from '../shared/cardspec/sandbox-fixtures.mjs'
const inline=s=>s.replace('<sandbox ', '<sandbox source={'+JSON.stringify(SANDBOX_REACT)+'} ')
const signal=new AbortController().signal
const find=(t,text)=>Array.isArray(t)?t.map(n=>find(n,text)).find(Boolean):t&&typeof t==='object'?(t.type==='button'&&t.children.includes(text)?t:t.children.map(n=>find(n,text)).find(Boolean)):null

test('inert SVG metadata and known spellings normalize without a model repair; warnings stay observable',async()=>{
 const source=`export default function App({state,setState}){return <div class="visual" data-phase="preview"><svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewbox="0 0 100 100"><circle cx={50} cy={50} r={20} stroke-width={2}/></svg><button onClick={()=>setState(s=>({...s,n:(s.n||0)+1}))}>Advance</button></div>}`
 let calls=0;const events=[]
 const result=await generateSandbox({signal,input:{prompt:'visual'},view:{renderMode:'hybrid'},emit:e=>events.push(e),streamUpstream:async(_m,o)=>{calls++;o.onPiece({content:source})}})
 assert.equal(calls,1);assert.equal(result.repairCount,0);assert.ok(events.some(e=>e.type==='sandbox-compatibility'))
 assert.ok(result.module.diagnostics.some(d=>d.attribute==='xmlns'))
 const Q=await getQuickJS(),vm=createSandboxVM(Q,{code:result.module.code})
 let snapshot=vm.snapshot(),svg=snapshot.tree.children[0]
 assert.equal(snapshot.tree.props.className,'visual');assert.equal(snapshot.tree.props['data-phase'],'preview')
 assert.equal(svg.props.xmlns,undefined);assert.equal(svg.props.xmlnsXlink,undefined);assert.equal(svg.props.viewBox,'0 0 100 100');assert.equal(svg.children[0].props.strokeWidth,2)
 snapshot=vm.event(find(snapshot.tree,'Advance').props.onClick.handler,{type:'click'});assert.equal(snapshot.state.n,1);vm.dispose()
 const restored=createSandboxVM(Q,{code:result.module.code,state:snapshot.state});assert.equal(restored.snapshot().state.n,1);restored.dispose()
})

test('compatibility never silently drops behaviour, unsafe values or conflicting properties',()=>{
 for(const props of [{onLoad:{handler:'1:1'}},{src:'https://example.com'},{href:'#target'},{dangerouslySetInnerHTML:{__html:'x'}},{unknownVisualOption:true},{'stroke-width':2,strokeWidth:3},{'data-x':{}},{'fill-rule':'url(https://example.com)'}]){
  assert.throws(()=>validateSandboxTree({type:'svg',props,children:[]}))
 }
 const diagnostics=[]
 validateSandboxTree(Array.from({length:50},()=>({type:'svg',props:{xmlns:'http://www.w3.org/2000/svg'},children:[]})),{diagnostics})
 assert.equal(diagnostics.length,1)
})
test('hybrid short example declares complete native state and actions',()=>{
 const source=SANDBOX_CAPABILITY.match(/示例：([\s\S]+?)。brief/)[1]
 const result=compileCard('<card>'+source+'</card>',{final:true,context:{renderMode:'hybrid'}})
 assert.equal(result.complete,true,JSON.stringify(result.diagnostics))
 const store=createStore();makeScope(result.spec,store)
 executeAction(result.spec,store,'adjust',{event:{value:75}})
 assert.equal(store.values.n,75)
})
test('generation catches independently owned input controls without rejecting configuration input',()=>{
 const example='<state id="n" type="number" initial={0}/><sandbox id="view" brief="SVG呈现数值" initial={{n:0}} height={220}><stat label="数值" value={state.n}/><slider label="数值" min={0} max={100} value={state.n} onChange="adjust"/></sandbox><action id="adjust"><set target="n" value={event.value}/></action>'
 const source=example.replace('initial={{n:0}}','input={{n:state.n}} initial={{n:0}}').replace('</sandbox>','</sandbox><slider label="外部数值" value={state.n} min={0} max={100} onChange="adjust"/>')
 const result=compileCard('<card>'+source+'</card>',{final:true,context:{renderMode:'hybrid'}})
 assert.equal(result.complete,true,JSON.stringify(result.diagnostics)) // Compatibility: the general compiler still reads old cards.
 assert.equal(sandboxOwnershipDiagnostics(result.spec)[0].code,'sandbox-ownership')
 const valid=compileCard('<card>'+source.replace('input={{n:state.n}}','input={{configuration:state.n}}')+'</card>',{final:true,context:{renderMode:'hybrid'}})
 assert.deepEqual(sandboxOwnershipDiagnostics(valid.spec),[])
})
test('native mode rejects optional surfaces; hybrid validates fallback, count and nesting',()=>{
 assert.equal(compileCard(SANDBOX_FIXTURE,{final:true}).complete,false)
 assert.equal(compileCard(SANDBOX_FIXTURE,{final:true,context:{renderMode:'hybrid'}}).complete,true)
 for(const body of ['<sandbox id="a" brief="test"><sandbox id="b" brief="test"><text>fallback</text></sandbox></sandbox>','<sandbox id="a" brief="test"><text>A</text></sandbox><sandbox id="b" brief="test"><text>B</text></sandbox>'])assert.equal(compileCard('<card>'+body+'</card>',{final:true,context:{renderMode:'hybrid'}}).complete,false)
})
test('native implementation and hybrid fallback preserve multi-step simulator actions',()=>{
 for(const source of [SANDBOX_PURE,SANDBOX_FIXTURE]){
  const result=compileCard(source,{final:true,context:{renderMode:'hybrid'}});assert.equal(result.complete,true)
  const store=createStore();makeScope(result.spec,store)
  executeAction(result.spec,store,'advance');executeAction(result.spec,store,'advance');executeAction(result.spec,store,'charge')
  assert.equal(store.values.energy,55);assert.equal(store.values.steps,2)
  executeAction(result.spec,store,'reset');assert.equal(store.values.energy,60);assert.equal(store.values.steps,0)
 }
})
test('real React and Tailwind: multi-step feedback, input update and persistent state restore',async()=>{
 const module=await compileSandbox(SANDBOX_REACT,{input:{cost:10,charge:15},initial:{energy:60,steps:0}})
 assert.match(module.css,/bg-slate-900/)
 const Q=await getQuickJS(),vm=createSandboxVM(Q,{code:module.code,input:{cost:10,charge:15},state:{energy:60,steps:0}})
 let v=vm.snapshot();const click=t=>v=vm.event(find(v.tree,t).props.onClick.handler,{})
 click('推进一步');click('推进一步');click('充能');assert.deepEqual(v.state,{energy:55,steps:2})
 v=vm.input({cost:5,charge:15});click('推进一步');assert.deepEqual(v.state,{energy:50,steps:3})
 const saved=v.state;vm.dispose()
 const restored=createSandboxVM(Q,{code:module.code,input:{cost:5,charge:15},state:saved});assert.deepEqual(restored.snapshot().state,saved);restored.dispose()
})
test('VM has no browser, host, network or package capabilities, even through Function',async()=>{
 const m=await compileSandbox(`export default function App(){return <p>{JSON.stringify(['fetch','XMLHttpRequest','WebSocket','WebTransport','Worker','window','document','navigator','localStorage','process','require'].map(k=>Function('return typeof '+k)()))}</p>}`)
 const vm=createSandboxVM(await getQuickJS(),{code:m.code});const t=vm.snapshot().tree;assert.deepEqual(JSON.parse(t.children[0]),Array(11).fill('undefined'));vm.dispose()
 await assert.rejects(compileSandbox('import x from "react";export default function App(){return <p/>}'),/imports/)
})
test('no external-resource, injected HTML or arbitrary browser elements reach iframe',async()=>{
 await compileSandbox('export default function App(){return <svg viewBox="0 0 100 100"><circle cx={50} cy={50} r={40} fill="none" stroke="teal" strokeDasharray="251.3" strokeDashoffset={125.6}/></svg>}')
 for(const code of ['<img src="https://example.com"/>','<iframe/>','<div dangerouslySetInnerHTML={{__html:"x"}}/>','<svg><image href="https://example.com"/></svg>','<input type="file"/>','<div style={{background:"url(https://example.com)"}}/>'])await assert.rejects(compileSandbox('export default function App(){return '+code+'}'))
 await assert.rejects(compileSandbox('export default function App(){return <div className="bg-[url(https://example.com)]"/>}'),/CSS/)
 assert.throws(()=>validateSandboxTree({type:'div',props:{onClick:'alert(1)'},children:[]}))
 const doc=sandboxDocument('', 'safe-token');assert.match(doc,/connect-src 'none'/);assert.match(doc,/form-action 'none'/);assert.doesNotMatch(doc,/allow-same-origin/)
 assert.throws(()=>sandboxDocument('</style><script>evil()</script>','x'))
})
test('SVG local paint/clip references support expressive graphics without external resources',async()=>{
 await compileSandbox('export default function App(){return <svg viewBox="0 0 100 100"><defs><linearGradient id="paint"><stop offset="0%" stopColor="teal"/><stop offset="100%" stopColor="blue"/></linearGradient><clipPath id="cut"><circle cx={50} cy={50} r={40}/></clipPath></defs><rect width={100} height={100} fill="url(#paint)" clipPath="url(#cut)"/></svg>}')
 for(const value of ['url(https://example.com/x#paint)','url(//example.com/x)','url(data:image/svg+xml,x)','url(#paint) url(https://example.com)','url(\\23paint)'])
  assert.throws(()=>validateSandboxTree({type:'rect',props:{fill:value},children:[]}),/Unsafe/)
})
test('hybrid preference is disclosed without extra planning or external tools',async()=>{
 let calls=0
 const result=await generateCard({signal,catalog:[],view:{renderMode:'hybrid',generationMode:'direct'},input:{prompt:'用可操作的图形解释变化'},streamUpstream:async(messages,o)=>{
  calls++;assert.match(messages[0].content,/复杂空间图/);assert.match(messages[0].content,/用CardSpec/)
  o.onPiece({content:inline(SANDBOX_FIXTURE)})
 }})
 assert.equal(calls,1);assert.equal(result.spec.context.renderMode,'hybrid')
 assert.equal(result.spec.children.some(n=>n.type==='sandbox'),true)
})
test('existing single repair explains native fallback scope instead of adding a model call',async()=>{
 let calls=0
 const result=await generateCard({signal,catalog:[],view:{renderMode:'hybrid'},input:{prompt:'模拟'},streamUpstream:async(messages,o)=>{
  calls++
  if(calls===2)assert.match(messages.at(-1).content,/不能把缺失state改成local/)
  o.onPiece({content:inline(calls===1?SANDBOX_FIXTURE.replace(/<state[^>]+\/>/g,''):SANDBOX_FIXTURE)})
 }})
 assert.equal(calls,2);assert.equal(result.repairCount,1)
})
test('runaway event is bounded and invalid render/state is rejected without altering native state',async()=>{
 const m=await compileSandbox('export default function App(){return <button onClick={()=>{while(true){}}}>run</button>}')
 const vm=createSandboxVM(await getQuickJS(),{code:m.code});const v=vm.snapshot(),start=Date.now()
 assert.throws(()=>vm.event(v.tree.props.onClick.handler,{}),/timed out/);assert.ok(Date.now()-start<2000);vm.dispose()
 await assert.rejects(compileSandbox('export default function App({setState}){React.useEffect(()=>setState({x:Infinity}),[]);return <p/>}'),/finite|JSON|state/i)
})
test('sandbox generation is opt-in and bounded to one repair',async()=>{
 let calls=0;const opts={signal,input:{prompt:'test',context:{data:{cost:10,charge:15},initial:{energy:60,steps:0}}},streamUpstream:async(_m,o)=>{calls++;o.onPiece({content:calls===1?'export default function App(){return <iframe/>}':SANDBOX_REACT})}}
 await assert.rejects(generateSandbox(opts),/disabled/);assert.equal(calls,0)
 const result=await generateSandbox({...opts,view:{renderMode:'hybrid'}});assert.equal(calls,2);assert.equal(result.repairCount,1);assert.equal(result.kind,'sandbox')
})
test('unified native and slot generation rejects model sandboxes and repairs to complete native UI',async()=>{
 for(const view of [{},{renderMode:'hybrid'}]){
  let calls=0;const result=await generateCard({signal,photo:async()=>null,target:view.renderMode?'slot:detail':'page',view,input:{prompt:'simulator'},streamUpstream:async(messages,o)=>{assert.match(messages[0].content,/仅原生CardSpec/);o.onPiece({content:++calls===1?SANDBOX_FIXTURE:SANDBOX_PURE})}})
  assert.equal(result.repairCount,1);assert.equal(result.spec.context.renderMode,'native')
 }
 const native=createGenerationTools({goal:'复杂任务',allowPlanning:true});assert.match(native.planningRequest().prompt,/仅原生CardSpec/)
 const hybrid=createGenerationTools({goal:'复杂任务',allowPlanning:true,renderMode:'hybrid'});assert.match(hybrid.planningRequest().prompt,/Web创作/)
})
