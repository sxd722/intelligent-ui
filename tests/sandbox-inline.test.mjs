import test from 'node:test'
import assert from 'node:assert/strict'
import {generateCard} from '../server/cardspec/generation.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import {getQuickJS} from 'quickjs-emscripten'
import {createSandboxVM} from '../shared/cardspec/sandbox-engine.mjs'
export const JSX='export default function App({data,state,setState,bridge}){return <div><svg viewBox="0 0 100 60"><circle cx={data.n} cy={30} r={12}/></svg><button onClick={()=>setState(s=>({...s,count:s.count+1}))}>本地计数 {state.count}</button><button onClick={()=>bridge.call("adjust",{value:data.n+5})}>增加共享值</button></div>}'
export const source=jsx=>`<card><state id="n" type="number" initial={30}/><slider label="共享值" min={0} max={100} value={state.n} onChange="adjust"/><sandbox id="visual" brief="交互图形" input={{n:state.n}} initial={{count:0}} actions={{adjust:"adjust"}} height={200} source={${JSON.stringify(jsx)}}/><action id="adjust"><set target="n" value={event.value}/></action></card>`
const signal=new AbortController().signal
test('static module child normalizes to source without treating JSX as CardSpec',async()=>{
 const raw=source(JSX).replace(' source={'+JSON.stringify(JSX)+'}/>','>{`'+JSX+'`}</sandbox>')
 for(const expressionDialect of ['legacy','js-v1']){
  const r=compileCard(raw,{final:true,context:{renderMode:'hybrid',expressionDialect}});assert.equal(r.complete,true,JSON.stringify(r.diagnostics));assert.ok(r.diagnostics.some(d=>d.code==='sandbox_source_normalized'));await validateRichContent(r);assert.equal(r.complete,true,JSON.stringify(r.diagnostics))
 }
 const conflict=raw.replace('<sandbox ','<sandbox source={'+JSON.stringify(JSX)+'} ')
 assert.equal(compileCard(conflict,{final:true,context:{renderMode:'hybrid'}}).complete,false)
})
test('multiline static JSX template works in both expression dialects, never evaluates interpolation',async()=>{
 for(const expressionDialect of ['legacy','js-v1']){
  const raw=source(JSX).replace(JSON.stringify(JSX),'`'+JSX.replace('return <div>','return (\n<div>').replace('</div>}','</div>\n)}')+'`')
  const r=compileCard(raw,{final:true,context:{renderMode:'hybrid',expressionDialect}});assert.equal(r.complete,true,JSON.stringify(r.diagnostics));await validateRichContent(r);assert.equal(r.complete,true,JSON.stringify(r.diagnostics))
  const bad=compileCard(raw.replace('return (','${state.n} return ('),{final:true,context:{renderMode:'hybrid',expressionDialect}});assert.equal(bad.complete,false);assert.match(JSON.stringify(bad.diagnostics),/interpolation/)
  const cut=compileCard(raw.slice(0,raw.indexOf('</div>')),{context:{renderMode:'hybrid',expressionDialect}});assert.equal(cut.complete,false)
 }
})
test('one initial model response contains compiled React, no fallback and working bridge/local state',async()=>{
 let calls=0,validated=false
 const r=await generateCard({input:{prompt:'图形'},view:{renderMode:'hybrid',generationMode:'direct'},signal,onValidated:r=>{validated=!!r.spec.sandboxModules.visual},streamUpstream:async(m,o)=>{calls++;o.onPiece({content:source(JSX)})}})
 assert.equal(calls,1);assert.ok(validated);assert.equal(r.repairCount,0)
 assert.equal(r.spec.sandboxModules.visual.validation.clickProbes,2)
 const vm=createSandboxVM(await getQuickJS(),{code:r.spec.sandboxModules.visual.code,input:{n:30},state:{count:0},capabilities:['adjust']})
 try{let v=vm.snapshot();v=vm.event(v.tree.children[1].props.onClick.handler,{type:'click'});assert.equal(v.state.count,1);v=vm.event(v.tree.children[2].props.onClick.handler,{type:'click'});assert.deepEqual(v.effects[0].payload,{value:35})}finally{vm.dispose()}
})
for(const broken of [null,'export default function App(){return <button onClick={()=>{throw Error("broken click")}}>坏交互</button>}','export default function App(){return fetch("https://example.com")}'])test('initial repair catches '+String(broken).slice(0,60),async()=>{
 let calls=0
 const r=await generateCard({input:{prompt:'图形'},view:{renderMode:'hybrid',generationMode:'direct'},signal,streamUpstream:async(m,o)=>{o.onPiece({content:++calls===1?(broken?source(broken):source(JSX).replace(/ source=\{.*\}\/>/,'/>')):source(JSX)})}})
 assert.equal(calls,2);assert.equal(r.repairCount,1);assert.ok(r.spec.sandboxModules.visual)
})
test('hidden sandbox is validated too; native mode still rejects web',async()=>{
 assert.equal(compileCard(source(JSX),{final:true}).complete,false)
 const hidden=source('export default function App(){throw Error("hidden bad") }').replace('<sandbox','<if test={false}><sandbox').replace('/><action','/></if><action')
 const r=compileCard(hidden,{final:true,context:{renderMode:'hybrid'}});assert.equal(r.complete,true,JSON.stringify(r.diagnostics));await validateRichContent(r);assert.equal(r.complete,false);assert.match(r.diagnostics.at(-1).message,/hidden bad/)
})
test('preflight detects local hooks that lose visible progress on restore',async()=>{
 const r=compileCard(source('export default function App(){const [n,setN]=React.useState(0);return <button onClick={()=>setN(n+1)}>{n}</button>}'),{final:true,context:{renderMode:'hybrid'}})
 await validateRichContent(r);assert.equal(r.complete,false);assert.match(r.diagnostics.at(-1).message,/does not restore/)
})
