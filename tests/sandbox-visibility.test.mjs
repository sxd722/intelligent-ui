import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import {create,act} from 'react-test-renderer'
import {build} from 'esbuild'
import Module from 'node:module'
import path from 'node:path'
const output=await build({stdin:{contents:`export {SandboxPanel} from './src/cardspec/SandboxPanel.jsx';export {clients} from './src/cardspec/sandbox-client.js';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',external:['react'],plugins:[{name:'controlled-sandbox',setup(b){
 b.onLoad({filter:/sandbox-client\.js$/},()=>({contents:`export const clients=[];export function createSandboxClient(){const c={calls:[],closed:0,close(){c.closed++},async request(type,payload){c.calls.push({type,payload});if(type==='init')c.state=payload.state;if(type==='event')c.state={n:c.state.n+1};return {tree:{type:'p',props:{},children:[String(c.state.n)]},state:c.state,revision:c.calls.length,effects:[]}}};clients.push(c);return c}`,loader:'js'}))
 b.onLoad({filter:/SandboxMode\.jsx$/},()=>({contents:`export const useSandboxMode=()=> 'hybrid'`,loader:'js'}))
 b.onLoad({filter:/design-environment\.js$/},()=>({contents:`export const readDesignEnvironment=()=>({})`,loader:'js'}))
 b.onLoad({filter:/sandbox-document\.mjs$/},()=>({contents:`export const sandboxDocument=()=>'<html></html>'`,loader:'js'}))
}}]})
const mod=new Module(path.resolve('tests/sandbox-visibility-bundle.cjs'));mod.filename=path.resolve('tests/sandbox-visibility-bundle.cjs');mod.paths=Module._nodeModulePaths(path.resolve('tests'));mod._compile(output.outputFiles[0].text,mod.filename)
const {SandboxPanel,clients}=mod.exports

test('sandbox starts once, survives viewport/tab hiding, coalesces input and cleans up on unmount',async()=>{
 const old=Object.fromEntries(['IntersectionObserver','window','document'].map(k=>[k,globalThis[k]]))
 const listeners=new Map(),visibility=new Set(),messages=[];let intersect,tree
 const frame={postMessage:m=>messages.push(m)},host={dataset:{},dispatchEvent(){}}
 const emit=data=>{for(const f of listeners.get('message')||[])f({source:frame,data})}
 const doc={hidden:false,addEventListener:(k,f)=>visibility.add(f),removeEventListener:(k,f)=>visibility.delete(f)}
 const spec={context:{renderMode:'hybrid'},actions:{},sandboxModules:{demo:{id:'m1',code:'fixture',css:''}}}
 const view=n=>React.createElement(SandboxPanel,{p:{source:'fixture',input:{n},initial:{n:4}},nodeId:'demo',runtime:{spec,page:{id:'p1'},streaming:false}})
 try{
  globalThis.document=doc;globalThis.window={document:doc,addEventListener(k,f){if(!listeners.has(k))listeners.set(k,new Set());listeners.get(k).add(f)},removeEventListener(k,f){listeners.get(k)?.delete(f)}}
  globalThis.IntersectionObserver=class{constructor(f){intersect=f}observe(){}disconnect(){}}
  await act(async()=>{tree=create(view(1),{createNodeMock:e=>e.type==='iframe'?{contentWindow:frame}:host})})
  assert.equal(clients.length,0,'offscreen card must stay lazy')
  await act(async()=>intersect([{isIntersecting:true}]))
  assert.equal(clients.length,1);const c=clients[0]
  let render=messages.filter(m=>m.type==='render').at(-1)
  await act(async()=>emit({sandbox:render.sandbox,type:'rendered',revision:render.revision}))
  assert.equal(tree.root.findByType('section').props['data-sandbox-ready'],'true')
  await act(async()=>emit({sandbox:render.sandbox,type:'event',revision:render.revision,handler:'increment',event:{type:'click',trusted:true}}))
  assert.equal(c.state.n,5)
  await act(async()=>intersect([{isIntersecting:false}]))
  const before=c.calls.length
  await act(async()=>tree.update(view(2)));await act(async()=>tree.update(view(3)))
  assert.equal(c.calls.length,before);assert.equal(c.closed,0)
  assert.equal(tree.root.findByType('section').props['data-sandbox-ready'],'true')
  assert.equal(messages.filter(m=>m.type==='environment').at(-1).active,false)
  await act(async()=>intersect([{isIntersecting:true}]))
  assert.equal(clients.length,1);assert.equal(c.calls.at(-1).payload.n,3);assert.equal(c.state.n,5)
  await act(async()=>{doc.hidden=true;visibility.forEach(f=>f())})
  await act(async()=>{doc.hidden=false;visibility.forEach(f=>f())})
  assert.equal(clients.length,1);assert.equal(c.calls.filter(x=>x.type==='init').length,1)
  await act(async()=>tree.unmount());tree=null;assert.equal(c.closed,1)
 }finally{if(tree)act(()=>tree.unmount());clients.length=0;for(const [k,v] of Object.entries(old))if(v===undefined)delete globalThis[k];else globalThis[k]=v}
})
