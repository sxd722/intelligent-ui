import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import {create,act} from 'react-test-renderer'
import {build} from 'esbuild'
import Module from 'node:module'
import path from 'node:path'
import {FAILED_TRAIN_SOURCE} from '../shared/cardspec/recovery-train-fixture.mjs'
import {recoveryDraft} from '../shared/cardspec/recovery.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'

// Exercise the actual JSX boundary, with React shared by the test renderer.
const output=await build({entryPoints:['src/cardspec/Recovery.jsx'],bundle:true,write:false,platform:'node',format:'cjs',external:['react'],loader:{'.css':'empty'}})
const mod=new Module(path.resolve('tests/recovery-component.cjs'))
mod.filename=path.resolve('tests/recovery-component.cjs')
mod.paths=Module._nodeModulePaths(path.resolve('tests'));mod._compile(output.outputFiles[0].text,mod.filename)
const {RenderBoundary,Recovery}=mod.exports,h=React.createElement

test('original G1386 rejection has readable recovery and cannot become an executable card',()=>{
  const result=compileCard(FAILED_TRAIN_SOURCE,{final:true})
  assert.equal(result.complete,false)
  assert.match(JSON.stringify(result.diagnostics),/state.hasG/)
  assert.match(JSON.stringify(result.diagnostics),/rowKey/)
  const draft=recoveryDraft(FAILED_TRAIN_SOURCE,'G1386 行程')
  assert.ok(draft.title.includes('G1386'));assert.ok(draft.fields.includes('出发站'))
  let edit=0,retry=0,tree
  act(()=>{tree=create(h(Recovery,{source:FAILED_TRAIN_SOURCE,onEdit:()=>edit++,onRetry:()=>retry++}))})
  const buttons=tree.root.findAllByType('button');act(()=>buttons[0].props.onClick());act(()=>buttons[1].props.onClick())
  assert.equal(edit,1);assert.equal(retry,1)
  act(()=>tree.unmount())
})
for(const phase of ['render','effect'])test(`${phase} exception is isolated; sibling state and retry survive`,()=>{
  let broken=false,mounts=0,tree
  function Widget(){React.useEffect(()=>{if(broken&&phase==='effect')throw new Error('effect failed')},[]);if(broken&&phase==='render')throw new Error('render failed');return h('span',null,'healthy')}
  function Sibling(){const [count,setCount]=React.useState(0);React.useEffect(()=>{mounts++},[]);return h('button',{id:'counter',onClick:()=>setCount(n=>n+1)},String(count))}
  const view=key=>h('section',null,h(Sibling),h(RenderBoundary,{resetKey:key},h(Widget,{key})))
  const previous=console.error;console.error=()=>{}
  try{
    act(()=>{tree=create(view(0))});act(()=>tree.root.findByProps({id:'counter'}).props.onClick())
    broken=true;act(()=>tree.update(view(1)))
    assert.equal(tree.root.findAllByProps({'data-cs-error':''}).length,1)
    act(()=>tree.root.findByProps({id:'counter'}).props.onClick())
    assert.deepEqual(tree.root.findByProps({id:'counter'}).children,['2']);assert.equal(mounts,1)
    broken=false;act(()=>tree.root.findAllByType('button').find(b=>b.children.includes('重试此部分')).props.onClick())
    assert.equal(tree.root.findAllByProps({'data-cs-error':''}).length,0)
    assert.deepEqual(tree.root.findByProps({id:'counter'}).children,['2'])
    act(()=>tree.unmount())
  }finally{console.error=previous}
})
