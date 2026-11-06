import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdir} from 'node:fs/promises'
import React from 'react'
import renderer,{act} from 'react-test-renderer'
await mkdir('artifacts/refine-qa',{recursive:true})
await build({entryPoints:['src/PromptComposer.jsx'],outfile:'artifacts/refine-qa/composer.mjs',bundle:true,platform:'node',format:'esm',external:['react'],loader:{'.css':'empty'}})
const {default:Composer}=await import('../artifacts/refine-qa/composer.mjs')
globalThis.requestAnimationFrame=fn=>fn()
test('first submit only refines, review edits are the exact second generation input',async()=>{
 const old=globalThis.fetch;let generated=[],draft='original',view
 globalThis.fetch=async(_url,options)=>{const body=JSON.parse(options.body);assert.equal(body.toolsEnabled,false);assert.equal(body.designPreference,'folio');assert.equal(body.cardSize,'full');return {ok:true,json:async()=>({prompt:'CUJ plan'})}}
 const props=()=>({input:draft,toolsEnabled:false,designPreference:'folio',cardSize:'full',onChange:v=>{draft=v;view.update(React.createElement(Composer,props()))},onGenerate:v=>generated.push(v)})
 try{
  await act(async()=>{view=renderer.create(React.createElement(Composer,props()))})
  await act(async()=>{await view.root.findByProps({className:'send-btn'}).props.onClick()})
  assert.equal(draft,'CUJ plan');assert.deepEqual(generated,[])
  await act(async()=>view.root.findByType('textarea').props.onChange({target:{value:'user edited plan'}}))
  await act(async()=>view.root.findByProps({className:'send-btn'}).props.onClick())
  assert.deepEqual(generated,['user edited plan'])
 }finally{view?.unmount();globalThis.fetch=old}
})
test('cancel and draft replacement reject even fetch implementations ignoring abort',async()=>{
 const old=globalThis.fetch;let finish,changes=[],view
 globalThis.fetch=()=>new Promise(resolve=>{finish=()=>resolve({ok:true,json:async()=>({prompt:'stale plan'})})})
 try{
  await act(async()=>{view=renderer.create(React.createElement(Composer,{input:'original',onChange:v=>changes.push(v)}))})
  await act(async()=>{view.root.findByProps({className:'send-btn'}).props.onClick()})
  await act(async()=>view.root.findByProps({className:'stop-btn'}).props.onClick())
  await act(async()=>{finish();await Promise.resolve()})
  assert.deepEqual(changes,[]);assert.equal(view.root.findByType('textarea').props.value,'original')
  await act(async()=>{view.root.findByProps({className:'send-btn'}).props.onClick()})
  await act(async()=>view.unmount())
  await act(async()=>{finish();await Promise.resolve()});assert.deepEqual(changes,[])
 }finally{globalThis.fetch=old}
})

test('unchecked option sends exact input without refinement, persists and supports Enter',async()=>{
 const oldFetch=globalThis.fetch,oldStorage=globalThis.localStorage;const saved=new Map();let view,calls=0,generated=[]
 globalThis.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)}
 globalThis.fetch=async()=>{calls++;throw Error('refine must not run')}
 const props={input:'原始需求，不应改写',onGenerate:v=>generated.push(v)}
 try{
  await act(async()=>{view=renderer.create(React.createElement(Composer,props))})
  assert.equal(view.root.findByProps({type:'checkbox'}).props.checked,true)
  await act(async()=>view.root.findByProps({type:'checkbox'}).props.onChange({target:{checked:false}}))
  await act(async()=>view.root.findByProps({className:'send-btn'}).props.onClick())
  assert.deepEqual(generated,[props.input]);assert.equal(calls,0)
  await act(async()=>view.unmount())
  await act(async()=>{view=renderer.create(React.createElement(Composer,props))})
  assert.equal(view.root.findByProps({type:'checkbox'}).props.checked,false)
  await act(async()=>view.root.findByType('textarea').props.onKeyDown({key:'Enter',nativeEvent:{isComposing:false},preventDefault(){}}))
  assert.deepEqual(generated,[props.input,props.input]);assert.equal(calls,0)
 }finally{view?.unmount();globalThis.fetch=oldFetch;globalThis.localStorage=oldStorage}
})

test('turning refinement off cancels pending work and cannot overwrite or delay direct input',async()=>{
 const old=globalThis.fetch;let finish,view,changes=[],generated=[]
 globalThis.fetch=()=>new Promise(resolve=>{finish=()=>resolve({ok:true,json:async()=>({prompt:'obsolete plan'})})})
 try{
  await act(async()=>{view=renderer.create(React.createElement(Composer,{input:'current',onChange:v=>changes.push(v),onGenerate:v=>generated.push(v)}))})
  await act(async()=>{view.root.findByProps({className:'send-btn'}).props.onClick()})
  await act(async()=>view.root.findByProps({type:'checkbox'}).props.onChange({target:{checked:false}}))
  await act(async()=>view.root.findByProps({className:'send-btn'}).props.onClick())
  await act(async()=>{finish();await Promise.resolve()})
  assert.deepEqual(changes,[]);assert.deepEqual(generated,['current'])
 }finally{view?.unmount();globalThis.fetch=old}
})
