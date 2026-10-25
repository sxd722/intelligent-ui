import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
import {createDebugSession} from '../server/cardspec/debug-session.mjs'

const out=resolve('artifacts/p0-debug-qa');await mkdir(out,{recursive:true})
const results=[]
const save=()=>writeFile(resolve(out,'results.json'),JSON.stringify(results,null,2))
const model=JSON.parse(await readFile('artifacts/generation-debug-model/feed.json','utf8'))
const feed=compileCard(model.result.source,{final:true,cardId:'p0-feed-replay',context:model.result.spec.context})
assert.equal(feed.complete,true,JSON.stringify(feed.diagnostics))
for(const width of [320,360,432])for(const size of ['square','auto']){
 const result=await runDebugBrowser(feed.spec,{width,size,scenarios:width===432&&size==='square'?['normal','empty','failure']:['normal'],steps:[{op:'click',name:'刷新'},{op:'click',name:'打开详情'},{op:'reload'},{op:'click',name:'返回列表'}],artifactDir:resolve(out,`feed-${width}-${size}`)})
 results.push({id:'feed',width,size,...result});await save()
 assert.equal(result.status,'tested',result.reason)
 for(const run of result.runs){
  assert.ok(run.actions.every(a=>a.ok),JSON.stringify(run.actions))
  assert.deepEqual(run.final.errors,[])
  assert.equal(run.final.horizontalOverflow,false)
  assert.ok(run.initial.controls.every(c=>!c.name.includes('浏览结果')))
  if(run.scenario==='normal'){
   assert.equal(run.actions[1].changed,true)
   assert.equal(run.actions[2].restored,true)
   assert.equal(run.final.state.view,'list')
  }else assert.ok(!run.actions.some(a=>a.step.name==='打开详情'))
 }
 console.log('feed',width,size,'pass')
}

const source=`已完成。
<card><state id="n" type="number" initial={0}/><state id="pick" type="string" initial=""/>
<button id="dynamic" onClick="inc" label={"加一 " + state.n}><stack><strong>增加</strong><caption>剩余 UI 不受影响</caption></stack></button>
<list><list-item id="a" label="选择" onClick="pick" args={{id:"a"}}><stack><strong>A</strong><caption>第一个</caption></stack></list-item><list-item id="b" label="选择" onClick="pick" args={{id:"b"}}><stack><strong>B</strong></stack></list-item></list>
<text>{state.pick}</text><region overflow="details" label="隐藏内容"><button onPress="inc">隐藏按钮</button></region>
<action id="inc"><increment target="n"/></action><action id="pick"><set target="pick" value={args.id}/></action></card>`
const compiled=compileCard(source,{final:true,cardId:'p0-controls'});assert.equal(compiled.complete,true,JSON.stringify(compiled.diagnostics))
const discovery=await runDebugBrowser(compiled.spec,{scenarios:['normal'],steps:[{op:'reload'}]})
assert.equal(discovery.status,'tested',discovery.reason)
const controls=discovery.runs[0].initial.controls
assert.ok(!controls.some(c=>c.name==='隐藏按钮'))
const dynamic=controls.find(c=>c.name==='加一 0'),second=controls.filter(c=>c.name==='选择')[1]
assert.ok(dynamic?.handle&&second?.handle)
const replay=await runDebugBrowser(compiled.spec,{scenarios:['normal'],steps:[{op:'click',handle:dynamic.handle},{op:'click',handle:dynamic.handle},{op:'click',handle:second.handle},{op:'reload'}],artifactDir:resolve(out,'handles')})
results.push({id:'handles',...replay});await save()
assert.equal(replay.status,'tested',replay.reason)
assert.ok(replay.runs[0].actions.every(a=>a.ok),JSON.stringify(replay.runs[0].actions))
assert.deepEqual(replay.runs[0].final.state,{n:2,pick:'b'})
assert.equal(replay.runs[0].actions.at(-1).restored,true)

const debug=createDebugSession({cardId:'p0-bad-test-plan'})
const feedback=await debug.test({source,steps:[{op:'click',name:'不存在的按钮'},{op:'click',name:'隐藏按钮'},{op:'reload'}]})
assert.equal(feedback.status,'partial');assert.equal(debug.snapshot().repairs,0)
const record=JSON.parse(await readFile(resolve(debug.snapshot().artifactPath,feedback.version,'test-1.json'),'utf8'))
assert.equal(record.browser.runs[0].actions[1].skipped,true)
assert.ok(feedback.diagnostics.every(d=>d.severity!=='error'))
results.push({id:'bad-test-plan',feedback,debug:debug.snapshot()});await save()
console.log('handles, rich rows, hidden controls, dependent steps and warning classification pass')

// Independently replay the new real-model artifacts; generated checks alone
// are not a business correctness oracle.
const newFeed=JSON.parse(await readFile('artifacts/p0-debug-model/feed.json','utf8'))
const nf=newFeed.result.spec
const opening=await runDebugBrowser(nf,{scenarios:['normal'],steps:[{op:'reload'}]})
const item=opening.runs[0].initial.controls.find(c=>c.component?.endsWith('/@press'))
assert.ok(item)
const newFeedReplay=await runDebugBrowser(nf,{scenarios:['normal'],steps:[{op:'click',name:'刷新榜单'},{op:'click',handle:item.handle},{op:'reload'},{op:'click',name:'返回榜单'}],artifactDir:resolve(out,'new-feed')})
results.push({id:'new-feed',...newFeedReplay});await save()
assert.ok(newFeedReplay.runs[0].actions.every(a=>a.ok),JSON.stringify(newFeedReplay.runs[0].actions))
assert.ok(newFeedReplay.runs[0].initial.text.includes(item.name),'list-item label must be visible, not accessibility-only')
assert.deepEqual(newFeedReplay.runs[0].final.state.sel,{})
const newSim=JSON.parse(await readFile('artifacts/p0-debug-model/simulator.json','utf8'))
const simReplay=await runDebugBrowser(newSim.result.spec,{scenarios:['normal'],steps:[{op:'click',name:'推进'},{op:'click',name:'推进'},{op:'reload'},{op:'click',name:'推进'},{op:'click',name:'重置'}],artifactDir:resolve(out,'new-simulator')})
results.push({id:'new-simulator',...simReplay});await save()
assert.ok(simReplay.runs[0].actions.every(a=>a.ok),JSON.stringify(simReplay.runs[0].actions))
assert.equal(simReplay.runs[0].actions[2].restored,true)
assert.deepEqual(simReplay.runs[0].final.state,{energy:3,score:0,step:0})
console.log('new real model artifacts: full detail/return and simulator end/reset replay passed')
