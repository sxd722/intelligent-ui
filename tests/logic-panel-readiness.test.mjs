import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import {create,act} from 'react-test-renderer'
import {build} from 'esbuild'
import Module from 'node:module'
import path from 'node:path'
const output=await build({stdin:{contents:`export {LogicPanel} from './src/cardspec/LogicPanel.jsx';export {pending} from './src/cardspec/logic-client.js';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',external:['react'],plugins:[{name:'controlled-worker',setup(b){b.onLoad({filter:/logic-client\.js$/},()=>({contents:'export const pending=[];export const runLogic=(payload,signal)=>new Promise((resolve,reject)=>pending.push({payload,signal,resolve,reject}));',loader:'js'}))}}]})
const mod=new Module(path.resolve('tests/logic-panel-bundle.cjs'));mod.filename=path.resolve('tests/logic-panel-bundle.cjs');mod.paths=Module._nodeModulePaths(path.resolve('tests'));mod._compile(output.outputFiles[0].text,mod.filename)
const {LogicPanel,pending}=mod.exports,h=React.createElement
test('real panel JSX never renders incomplete seed or state from a replaced source',async()=>{
 const oldObserver=globalThis.IntersectionObserver,oldDocument=globalThis.document
 globalThis.IntersectionObserver=class{constructor(callback){this.callback=callback}observe(){this.callback([{isIntersecting:true}])}disconnect(){}}
 globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}}
 let tree,views=[]
 const view=source=>h(LogicPanel,{p:{source,initial:{n:2},reactive:true},streaming:false,validate:s=>assert.ok(Array.isArray(s.matrix))},state=>{assert.ok(state.matrix);views.push({source,value:state.matrix[0][0]});return h('p',null,state.matrix[0][0])})
 try{
  await act(async()=>{tree=create(view('function update(s){return s}'))})
  assert.equal(tree.root.findAllByType('p').length,0);assert.equal(pending.length,1)
  await act(async()=>{pending.shift().resolve({n:2,matrix:[[4]]})})
  assert.equal(tree.root.findByType('p').children.join(''),'4')
  await act(async()=>tree.update(view('function update(s){return {...s}}')))
  assert.equal(tree.root.findAllByType('p').length,0)
  await act(async()=>{pending.shift().reject(Error('new init failed'))})
  assert.equal(tree.root.findAllByType('p').length,0);assert.ok(tree.root.findAllByProps({role:'alert'}).length)
  assert.ok(views.every(x=>x.source==='function update(s){return s}'))
 }finally{if(tree)act(()=>tree.unmount());globalThis.IntersectionObserver=oldObserver;globalThis.document=oldDocument;pending.length=0}
})
