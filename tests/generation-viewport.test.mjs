import test from 'node:test'
import assert from 'node:assert/strict'
import {generationViewport} from '../shared/cardspec/generation-layout.mjs'
import {generateCard} from '../server/cardspec/generation.mjs'

test('square viewport budgets host chrome separately from card geometry',()=>{
 for(const width of [320,360,432]){
  const plain=generationViewport({width}),tools=generationViewport({width},'page',{toolsEnabled:true})
  assert.equal(plain.height,width);assert.equal(plain.contentHeight,width)
  assert.equal(tools.height,width);assert.equal(tools.contentHeight,width-72)
  assert.equal(tools.estimated,true)
 }
 assert.equal(generationViewport({width:360,summary:'previous page'},'page',{toolsEnabled:true}).contentHeight,238)
})
test('natural cards have no artificial height; slots do not reserve parent chrome twice',()=>{
 assert.equal(generationViewport({cardSize:'auto',width:360,height:2000},'page',{toolsEnabled:true}).contentHeight,null)
 assert.equal(generationViewport({width:360,height:180,summary:'parent'},'slot:detail',{toolsEnabled:true}).contentHeight,180)
 assert.equal(generationViewport({width:360,height:null},'slot:detail').height,360)
 assert.equal(generationViewport({width:-1,height:-1},'slot:x').height,48)
 assert.equal(generationViewport({width:NaN}).width,320)
})
test('generation context and pageView disclose one consistent surface budget without extra calls',async()=>{
 for(const [view,target,expected]of [
  [{width:360},'page',288],
  [{width:360,summary:'previous'},'page',238],
  [{width:360,height:180},'slot:detail',180],
  [{cardSize:'auto',width:360},'page',null],
 ]){
  const calls=[]
  const output=await generateCard({catalog:[{id:'glm.generate',available:true}],view:{...view,generationMode:'direct'},target,input:{prompt:'A simple counter'},signal:new AbortController().signal,streamUpstream:async(messages,opts)=>{calls.push(messages);opts.onPiece({content:'<card><text>Ready</text></card>'})}})
  assert.equal(calls.length,1)
  const pageView=JSON.parse(calls[0].find(m=>m.role==='user').content).pageView
  assert.equal(pageView.contentHeight,expected)
  assert.equal(output.spec.context.viewport.contentHeight,expected)
  assert.equal(pageView.width,output.spec.context.viewport.width)
  assert.match(calls[0][0].content,/扣除宿主工具\/后续\/历史栏/)
 }
})
