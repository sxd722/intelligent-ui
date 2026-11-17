import {mkdir,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
const dir='artifacts/web-graphics-qa';await mkdir(dir,{recursive:true})
const gl='precision mediump float;uniform vec2 u_resolution;uniform vec4 u_params;uniform float u_time;void main(){vec2 uv=gl_FragCoord.xy/u_resolution;float wave=sin(uv.x*12.+u_time)*.08;gl_FragColor=vec4(uv.x,u_params.x,uv.y+wave,1.);}'
const wgsl='@fragment fn fs(@builtin(position) pos:vec4f)->@location(0) vec4f {let uv=pos.xy/card.viewport.xy;return vec4f(uv.x,card.params.x,uv.y,1.);}'
function source(backend,fragment){return `import React,{useEffect,useRef} from 'react';export default function App({state,setState,graphics}){const c=useRef(null),fx=useRef(null),n=state.amount??0.2;useEffect(()=>{const f=graphics.shader(c.current,{backend:${JSON.stringify(backend)},fragment:${JSON.stringify(fragment)},params:[n,0,0,0]});fx.current=f;return()=>f.dispose()},[]);useEffect(()=>{fx.current?.update([n,0,0,0])},[n]);return <div><h3>光谱参数实验</h3><canvas aria-label="光谱" ref={c} style={{display:'block',width:'100%',height:180,borderRadius:16}}/><p>参数 {n.toFixed(1)}</p><button onClick={()=>setState({amount:n>0.5?0.2:0.8})}>改变参数</button></div>}`}
async function specFor(backend,fragment,enabled=true){const r=compileCard(`<card><sandbox id="visual" brief="光谱" height={280} initial={{amount:0.2}} source={${JSON.stringify(source(backend,fragment))}}/></card>`,{final:true,cardId:'graphics-'+backend+'-'+enabled,context:{renderMode:'web',webGraphics:enabled}});await validateRichContent(r);assert.equal(r.complete,true,JSON.stringify(r.diagnostics));return r.spec}
const browser=await chromium.launch({channel:'chrome',headless:true}),rows=[]
try{
 const p=await browser.newPage({viewport:{width:432,height:800},reducedMotion:'reduce'});await p.goto('http://127.0.0.1:8787/card-debug.html');await p.waitForFunction(()=>window.cardDebug)
 for(const [id,backend,fragment,enabled] of [['glsl','webgl',gl,true],['glsl2','webgl2','#version 300 es\nprecision mediump float;uniform vec4 u_params;out vec4 color;void main(){color=vec4(u_params.x,0.3,0.7,1.);}',true],['wgsl','webgpu',wgsl,true],['wgsl-constant','webgpu','@fragment fn fs()->@location(0) vec4f{return vec4f(0.2,0.4,0.8,1.);}',true],['bad-wgsl','webgpu','@fragment fn fs()->@location(0) vec4f{return UNKNOWN;}',true],['bad-glsl','webgl','NOT A SHADER',true],['disabled','webgl',gl,false]]){
  const spec=await specFor(backend,fragment,enabled);await writeFile(`${dir}/${id}.json`,JSON.stringify(spec,null,2));await p.evaluate(spec=>window.cardDebug.mount(spec),spec)
  await p.waitForFunction(()=>{const e=document.querySelector('.cs-web-sandbox');const values=Object.values(JSON.parse(e?.dataset.webGraphics||'{}'));return values.some(v=>['ready','fallback'].includes(v.status))},{},{timeout:15000})
  const f=p.frameLocator('.cs-web-sandbox iframe'),canvas=f.locator('canvas'),before=await canvas.evaluate(c=>c.toDataURL()),status=await p.locator('.cs-web-sandbox').getAttribute('data-web-graphics')
  await f.getByRole('button',{name:'改变参数'}).click();await f.getByText('参数 0.8',{exact:true}).waitFor();await p.waitForTimeout(150)
  const after=await canvas.evaluate(c=>c.toDataURL()),g=Object.values(JSON.parse(status))[0]
  if(id==='glsl'||id==='glsl2'){assert.equal(g.status,'ready',status);assert.notEqual(before,after,'parameter change must alter real shader pixels')}
  if(id==='bad-glsl'||id==='bad-wgsl'&&g.kind!=='environment'){assert.equal(g.status,'fallback');assert.equal(g.kind,'implementation')}
  if(id==='disabled'){assert.equal(g.status,'fallback');assert.equal(g.kind,'disabled')}
  if(id==='wgsl-constant')assert.ok(g.status==='ready'||g.kind==='environment',status)
  if(id==='wgsl'&&g.status==='fallback')assert.equal(g.kind,'environment',status)
  if(id==='wgsl'&&g.status==='ready')assert.notEqual(before,after)
  const frame=await (await p.locator('.cs-web-sandbox iframe').elementHandle()).contentFrame();assert.equal(await frame.evaluate(()=>{try{return !!parent.document}catch{return false}}),false)
  await p.locator('.cs-stage').screenshot({path:`${dir}/${id}-432.png`});rows.push({id,...g,parameterChanged:before!==after,controlsWork:true})
  await p.setViewportSize({width:320,height:800});await p.locator('.cs-stage').screenshot({path:`${dir}/${id}-320.png`});await p.setViewportSize({width:432,height:800})
 }
 const plain=await specFor('webgl',gl,false);plain.sandboxModules.visual=await (await import('../server/cardspec/web-sandbox.mjs')).compileWebSandbox(`import React,{useRef,useEffect} from 'react';export default function App(){const c=useRef(null);useEffect(()=>{const x=c.current.getContext('2d');x.fillStyle='orange';x.fillRect(0,0,80,80)},[]);return <canvas ref={c} width={100} height={100}/>}`)
 await p.evaluate(spec=>window.cardDebug.mount(spec),plain);await p.waitForFunction(()=>document.querySelector('[data-sandbox-ready=true]'))
 const c=p.frameLocator('.cs-web-sandbox iframe').locator('canvas');assert.deepEqual(await c.evaluate(c=>[...c.getContext('2d').getImageData(10,10,1,1).data]),[255,165,0,255]);rows.push({id:'canvas2d-off',passed:true})
 const restore=await runDebugBrowser(await specFor('webgl',gl),{scenarios:['normal'],viewports:[320,432],steps:[{op:'click',name:'改变参数',expect:{changed:true,text:'参数 0.8'}},{op:'reload',expect:{text:'参数 0.8'}}],artifactDir:dir+'/restore',signal:AbortSignal.timeout(60000)})
 for(const r of restore.runs){assert.equal(r.final.errors.length,0,JSON.stringify(r.final.errors));assert.ok(r.actions.every(a=>a.ok&&a.assertion?.passed!==false&&a.restored!==false))}
 await writeFile(dir+'/restore.trace.json',JSON.stringify(restore,null,2))
 for(const enabled of [true,false]){
  const diagnostic=await runDebugBrowser(await specFor('webgl','NOT A SHADER',enabled),{scenarios:['normal'],viewports:[320],signal:AbortSignal.timeout(30000)})
  const final=diagnostic.runs[0]?.final;assert.ok(final,'graphics diagnostics must return a final snapshot')
  if(enabled)assert.ok(final.errors.some(e=>String(e).includes('Shader implementation error')))
  else {assert.ok(final.warnings.some(e=>String(e).includes('Graphics host unavailable')));assert.ok(!final.errors.some(e=>String(e).includes('Shader implementation error')))}
  await writeFile(dir+`/diagnostics-${enabled}.trace.json`,JSON.stringify(diagnostic,null,2))
 }
 await writeFile(dir+'/result.json',JSON.stringify({rows,restored:true,scope:'Hand-authored runtime fixtures; real hardware APIs, no forced GPU flags, no model call or CLI calls.'},null,2));console.log(JSON.stringify(rows))
}finally{await browser.close()}
