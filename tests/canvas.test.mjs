import test from 'node:test'
import assert from 'node:assert/strict'
import {compileSandbox} from '../server/cardspec/sandbox.mjs'
import {createSandboxVM} from '../shared/cardspec/sandbox-engine.mjs'
import {getQuickJS} from 'quickjs-emscripten'
import {validateSandboxTree,sandboxInstruction} from '../shared/cardspec/sandbox-policy.mjs'
import {findCapabilities} from '../shared/cardspec/capability-index.mjs'

export const CANVAS_SOURCE=`export const styles=".art{animation:breathe 3s infinite alternate}@keyframes breathe{to{opacity:.7}}";
export default function App({data,state,setState,bridge}){return <div><Canvas className="art" width={320} height={160} role="img" aria-label="能量点阵" onClick={e=>bridge.call("select",{value:Math.round(e.x)})} draw={ctx=>{ctx.fillStyle="var(--cs-accent)";for(let i=0;i<8;i++){ctx.beginPath();ctx.arc(20+i*40,80,4+data.n/10,0,Math.PI*2);ctx.fill()}ctx.fillStyle="#f59e0b";ctx.fillRect(0,0,10+(state.step||0)*20,8)}}/><button onClick={()=>setState(s=>({...s,step:(s.step||0)+1}))}>下一步</button></div>}`
test('Canvas records real 2D commands, parent input, bridge and persistent local state',async()=>{
 const m=await compileSandbox(CANVAS_SOURCE,{input:{n:30},capabilities:['select'],probe:true})
 const vm=createSandboxVM(await getQuickJS(),{code:m.code,input:{n:30},capabilities:['select']})
 try{
  let v=vm.snapshot();assert.equal(v.tree.children[0].type,'canvas');assert.equal(v.tree.children[0].props.drawing[2][3],7)
  v=vm.input({n:60});assert.equal(v.tree.children[0].props.drawing[2][3],10)
  v=vm.event(v.tree.children[0].props.onClick.handler,{type:'click',x:75});assert.deepEqual(v.effects[0].payload,{value:75})
  v=vm.event(v.tree.children[1].props.onClick.handler,{type:'click'});assert.equal(v.state.step,1)
  const restored=createSandboxVM(await getQuickJS(),{code:m.code,input:{n:60},state:v.state,capabilities:['select']})
  try{assert.deepEqual(restored.snapshot().tree.children[0].props.drawing,v.tree.children[0].props.drawing)}finally{restored.dispose()}
 }finally{vm.dispose()}
})
test('Canvas rejects resource access, unsupported commands and unbounded drawing',async()=>{
 for(const draw of ['ctx.drawImage("https://example.com",0,0)','ctx.getImageData(0,0,1,1)','ctx.fillStyle="url(https://example.com)"','ctx.arc(0,0,-2,0,6)','ctx.save()','for(let i=0;i<1201;i++)ctx.fillRect(0,0,1,1)'])await assert.rejects(compileSandbox('export default function App(){return <Canvas draw={ctx=>{'+draw+'}}/>}'))
 for(const drawing of [[['__proto__']], [['set','canvas','x']], [['set','fillStyle','url(x)']], [['fillRect',0,0,NaN,1]]])assert.throws(()=>validateSandboxTree({type:'canvas',props:{width:320,height:160,drawing},children:[]}))
 assert.throws(()=>validateSandboxTree({type:'canvas',props:{width:5000,height:5000,drawing:[]},children:[]}))
})
test('graphics promoted only when permitted; indexed as an independent task',()=>{
 assert.match(sandboxInstruction('hybrid'),/原创图像与动效/)
 assert.match(sandboxInstruction('hybrid'),/draw\(ctx\)/)
 assert.doesNotMatch(sandboxInstruction('native'),/draw\(ctx\)/)
 assert.ok(findCapabilities('svg canvas 插图',{renderMode:'hybrid'}).components.some(c=>c.name==='sandbox'))
 assert.ok(!findCapabilities('svg canvas 插图',{renderMode:'native'}).components.some(c=>c.name==='sandbox'))
})
test('standard pointer boundary events survive validation; Canvas save/restore preserves readable properties',async()=>{
 const m=await compileSandbox(`export default function App(){return <Canvas onPointerLeave={()=>{}} draw={ctx=>{ctx.fillStyle="red";ctx.save();ctx.fillStyle="blue";ctx.restore();if(ctx.fillStyle!=="red")throw Error("restore mismatch");ctx.fillRect(0,0,10,10)}}/>}`)
 assert.ok(m.code)
})
