import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import {create,act} from 'react-test-renderer'
import {build} from 'esbuild'
import Module from 'node:module'
import path from 'node:path'

const output=await build({stdin:{contents:`export {Collection} from './src/cardspec/Collection.jsx';export {Experience,PointMap} from './src/cardspec/Experience.jsx';export {Heatmap} from './src/cardspec/NumericWidgets.jsx';export {SeriesChart} from './src/cardspec/SeriesChart.jsx';export {ChoiceGroup} from './src/cardspec/RichWidgets.jsx';export {CardSizeOverride} from './src/CardSize.jsx';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',external:['react'],loader:{'.css':'empty'}})
const mod=new Module(path.resolve('tests/selection-components.cjs'));mod.filename=path.resolve('tests/selection-components.cjs');mod.paths=Module._nodeModulePaths(path.resolve('tests'));mod._compile(output.outputFiles[0].text,mod.filename)
const {Collection,Experience,PointMap,Heatmap,SeriesChart,ChoiceGroup,CardSizeOverride}=mod.exports,h=React.createElement
const items=[{rowKey:'a',name:'Alpha',lat:30,lon:120},{rowKey:'b',name:'Beta',lat:31,lon:121}]
test('segmented choices retain labels and native disabled semantics without dispatching',()=>{
 const old=globalThis.ResizeObserver;globalThis.ResizeObserver=class{observe(){}disconnect(){}}
 let tree,calls=[]
 const view=disabled=>h(ChoiceGroup,{kind:'segmented',p:{label:'阶段',options:['A','B'],value:'A',disabled},fire:(_event,payload)=>calls.push(payload.value)})
 try{
  act(()=>{tree=create(view(true),{createNodeMock:()=>({querySelector:()=>null,querySelectorAll:()=>[]})})})
  const b=()=>tree.root.findAllByType('button')[1]
  assert.equal(tree.root.findByProps({className:'cs-segmented-field'}).props['data-short-label'],true)
  assert.equal(tree.root.findByProps({role:'radiogroup'}).props['aria-label'],'阶段')
  assert.equal(b().props.disabled,true)
  act(()=>{b().props.onClick();b().props.onKeyDown({key:'ArrowRight'})})
  assert.deepEqual(calls,[])
  act(()=>tree.update(view(false)));act(()=>b().props.onClick());assert.deepEqual(calls,['B'])
 }finally{if(tree)act(()=>tree.unmount());globalThis.ResizeObserver=old}
})
for(const [name,Component,p,predicate]of [
 ['collection',Collection,{items,onSelect:'pick'},b=>b.props.className==='cs-collection-item'],
 ['experience',Experience,{items,multiple:true,onSelect:'pick'},b=>b.props.className==='cs-experience-item'],
 ['map',PointMap,{items,onSelect:'pick'},b=>b.props.title==='Alpha'],
 ['heatmap',Heatmap,{rows:[{id:'a',label:'A'}],columns:[{id:'b',label:'B'}],values:[[1]],onSelect:'pick'},b=>b.props['aria-label']==='A / B：1'],
 ['series chart',SeriesChart,{data:[{id:'a',label:'A',value:1}],onSelect:'pick'},b=>Object.hasOwn(b.props,'aria-pressed')],
])test(`${name}: rejected action cannot commit local selected state`,()=>{
 let accept=false,tree,calls=0
 act(()=>{tree=create(h(Component,{p,fire:()=>{calls++;return accept}}))})
 const button=()=>tree.root.findAllByType('button').find(predicate)
 act(()=>button().props.onClick())
 assert.notEqual(button().props['aria-pressed'],true);assert.equal(calls,1)
 accept=true;act(()=>button().props.onClick())
 assert.equal(button().props['aria-pressed'],true);assert.equal(calls,2)
 act(()=>tree.unmount())
})
test('collection size change keeps current anchor visible and folded filters retain input',()=>{
 const rows=Array.from({length:7},(_,i)=>({id:String(i),title:`Candidate ${i}`}));let tree
 const view=size=>h(CardSizeOverride.Provider,{value:size},h(Collection,{p:{items:rows},fire:()=>true}))
 act(()=>{tree=create(view('square'))})
 const candidates=()=>tree.root.findAllByType('button').filter(b=>b.props.className==='cs-collection-item')
 assert.equal(candidates().length,2)
 act(()=>tree.root.findAllByType('button').find(b=>b.children.includes('下一组')).props.onClick())
 assert.deepEqual(candidates()[0].findByType('strong').children,['Candidate 2'])
 act(()=>tree.update(view('auto')));assert.equal(candidates().length,4)
 assert.ok(JSON.stringify(tree.toJSON()).includes('Candidate 2'))
 act(()=>tree.update(view('square')))
 assert.deepEqual(candidates()[0].findByType('strong').children,['Candidate 2'])
 act(()=>tree.root.findByType('input').props.onChange({target:{value:'Candidate 6'}}))
 assert.equal(candidates().length,1);assert.ok(JSON.stringify(tree.toJSON()).includes('Candidate 6'))
 act(()=>tree.unmount())
})
