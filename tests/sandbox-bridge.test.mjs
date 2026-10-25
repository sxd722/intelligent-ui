import test from 'node:test'
import assert from 'node:assert/strict'
import {getQuickJS} from 'quickjs-emscripten'
import {compileSandbox} from '../server/cardspec/sandbox.mjs'
import {createSandboxVM} from '../shared/cardspec/sandbox-engine.mjs'
import {dispatchSandboxEffects} from '../shared/cardspec/sandbox-bridge.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
import {SANDBOX_LINKED,LINKED_REACT} from '../shared/cardspec/sandbox-linked-fixture.mjs'
const flatten=t=>Array.isArray(t)?t.flatMap(flatten):t&&typeof t==='object'?[t,...t.children.flatMap(flatten)]:[]
test('shared actions compile; unknown and dynamic action maps do not',()=>{
 const good=compileCard(SANDBOX_LINKED,{final:true,context:{renderMode:'hybrid'}});assert.equal(good.complete,true,JSON.stringify(good.diagnostics))
 for(const source of [SANDBOX_LINKED.replace('adjust:"adjust"','adjust:"missing"'),SANDBOX_LINKED.replace('adjust:"adjust"','adjust:state.level')])assert.equal(compileCard(source,{final:true,context:{renderMode:'hybrid'}}).complete,false)
})
test('stylesheet animation and static literal exports; no imports or external CSS',async()=>{
 const module=await compileSandbox(LINKED_REACT,{input:{level:30,count:0,status:'idle'},capabilities:['adjust','refresh']});assert.match(module.css,/@keyframes ripple/);assert.equal(module.animated,true)
 await compileSandbox('export default function App(){return <p>import 与 export 的区别</p>}')
 await compileSandbox('export const styles="g:focus > circle{opacity:.7}";export default function App(){return <p/>}')
 await compileSandbox('说明：\n```jsx\nexport const styles=".x{opacity:.5}";export default function App(){return <p className="x"/>}\n```\n修复要点：只返回一份模块。')
 await assert.rejects(compileSandbox('```jsx\nexport default function App(){return <p/>}\n```\n```js\nalert(1)\n```'),/one JSX module/)
 for(const css of ['@import "https://example.com";','@font-face{font-family:x;src:url(x)}','.x{background:u\\72l(x)}','</style><script>alert(1)</script>','@namespace url(x);'])await assert.rejects(compileSandbox('export const styles='+JSON.stringify(css)+';export default function App(){return <p/>}'))
 await assert.rejects(compileSandbox('export const styles=String(Date.now());export default function App(){return <p/>}'),/static/)
})
test('effects only on gestures, strict capabilities, transactional host dispatch and live callback',async()=>{
 const spec=compileCard(SANDBOX_LINKED,{final:true,context:{renderMode:'hybrid'}}).spec,store=createStore();makeScope(spec,store)
 const module=await compileSandbox(LINKED_REACT,{input:{level:30,count:0,status:'idle'},capabilities:['adjust','refresh']})
 const vm=createSandboxVM(await getQuickJS(),{code:module.code,input:{level:30,count:0,status:'idle'},capabilities:['adjust','refresh']})
 try{
  let snap=vm.snapshot();assert.deepEqual(snap.effects,[])
  const button=flatten(snap.tree).find(n=>n.props['aria-label']==='波形设为75')
  snap=vm.event(button.props.onClick.handler,{type:'click'});assert.equal(snap.effects[0].name,'adjust')
  const fire=(a,extra)=>executeAction(spec,store,a,extra)
  assert.throws(()=>dispatchSandboxEffects(snap.effects,{actions:{adjust:'adjust'},spec,fire,active:false,trusted:true}),/gesture/);assert.equal(store.values.level,30)
  assert.throws(()=>dispatchSandboxEffects(snap.effects,{actions:{adjust:'adjust'},spec,fire,active:true,trusted:false}),/gesture/)
  dispatchSandboxEffects(snap.effects,{actions:{adjust:'adjust'},spec,fire,active:true,trusted:true});assert.equal(store.values.level,75)
  const next=vm.input({level:store.values.level,count:2,status:'success'});assert.match(JSON.stringify(next.tree),/success/);assert.deepEqual(next.effects,[])
  assert.throws(()=>dispatchSandboxEffects([{type:'action',name:'adjust',payload:{value:'bad'}}],{actions:{adjust:'adjust'},spec,fire,active:true,trusted:true}));assert.equal(store.values.level,75)
  assert.throws(()=>dispatchSandboxEffects([{type:'action',name:'unknown',payload:{}}],{actions:{},spec,fire,active:true,trusted:true}),/not exposed/)
 }finally{vm.dispose()}
})
test('render/effect initialization cannot trigger host tools; error events yield no effects',async()=>{
 for(const body of ['bridge.call("refresh");','React.useEffect(()=>bridge.call("refresh"),[]);'])await assert.rejects(compileSandbox('export default function App({bridge}){'+body+'return <p/>}',{capabilities:['refresh']}),/user event/)
 const module=await compileSandbox('export default function App({bridge}){return <button onClick={()=>{bridge.call("refresh");throw Error("event failed")}}>Go</button>}',{capabilities:['refresh']})
 const vm=createSandboxVM(await getQuickJS(),{code:module.code,capabilities:['refresh']})
 try{const s=vm.snapshot();assert.throws(()=>vm.event(s.tree.props.onClick.handler,{type:'click'}),/event failed/);assert.deepEqual(vm.snapshot().effects,[])}finally{vm.dispose()}
 const indirect=await compileSandbox('export default function App({state,setState,bridge}){React.useEffect(()=>{if(state.n)bridge.call("refresh")},[state.n]);return <button onClick={()=>setState({n:1})}>Go</button>}',{capabilities:['refresh'],initial:{n:0}})
 const effectVM=createSandboxVM(await getQuickJS(),{code:indirect.code,capabilities:['refresh'],state:{n:0}})
 try{const s=effectVM.snapshot();assert.throws(()=>effectVM.event(s.tree.props.onClick.handler,{type:'click'}),/user event/)}finally{effectVM.dispose()}
})
