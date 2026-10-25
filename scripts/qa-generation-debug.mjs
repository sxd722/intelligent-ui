import {compileCard} from '../shared/cardspec/compiler.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
import {generateCard} from '../server/cardspec/generation.mjs'
const out=resolve('artifacts/generation-debug-qa');await mkdir(out,{recursive:true})
const source=`<card actionMode="snapshot"><state id="energy" type="number" initial={3}/><state id="score" type="number" initial={0}/><title>能量模拟器</title><stat label="能量" value={state.energy}/><stat label="得分" value={state.score}/><button onPress="step" disabled={state.energy==0}>推进</button><button onPress="reset">重置</button><action id="step"><increment target="energy" value={-1}/><set target="score" value={state.score+next.energy}/></action><action id="reset"><set target="energy" value={3}/><set target="score" value={0}/></action></card>`
const spec=compileCard(source,{final:true,cardId:'debug-qa'});assert.equal(spec.complete,true,JSON.stringify(spec.diagnostics))
const results=[]
for(const width of [320,360,432])for(const size of ['square','auto']){
 const r=await runDebugBrowser(spec.spec,{width,size,scenarios:['normal'],steps:[{op:'click',name:'推进'},{op:'click',name:'推进'},{op:'reload'}],artifactDir:resolve(out,`${width}-${size}`)})
 results.push({width,size,...r})
 await writeFile(resolve(out,'results.json'),JSON.stringify(results,null,2))
 assert.equal(r.status,'tested',r.reason)
 assert.deepEqual(r.runs[0].final.state,{energy:1,score:3})
 assert.deepEqual(r.runs[0].final.errors,[])
 assert.equal(r.runs[0].actions.at(-1).restored,true)
 assert.equal(r.runs[0].final.horizontalOverflow,false)
 console.log(width,size,'passed')
}
const toolSource=`<card><binding id="feed" tool="autocli.hackernews.top" input={{limit:2}} initial={{items:[],source:"",fetchedAt:""}} load="visible"/><title>Mock 数据流</title><text>{bindings.feed.status}</text><each items={bindings.feed.value.items} itemKey={item.id}><text>{item.title}</text></each><button onPress="refresh">刷新</button><action id="refresh"><invoke binding="feed"/></action></card>`
const t=compileCard(toolSource,{final:true,cardId:'debug-tool-qa'});assert.equal(t.complete,true,JSON.stringify(t.diagnostics))
const r=await runDebugBrowser(t.spec,{steps:[{op:'click',name:'刷新'}],artifactDir:resolve(out,'tools')})
results.push({tools:true,...r});await writeFile(resolve(out,'results.json'),JSON.stringify(results,null,2))
assert.equal(r.status,'tested',r.reason)
for(const run of r.runs){assert.ok(run.final.calls.length);assert.deepEqual(run.final.errors,[]);assert.equal(run.final.bindings.feed.status,run.scenario==='failure'?'error':'success')}
console.log('mock scenarios passed')
// The compiler accepts both candidates; the error appears only after a DOM action.
const bad=`<card><state id="rows" type="array" initial={[{id:"a",label:"A"}]}/><state id="count" type="number" initial={0}/><title>局部错误隔离</title><button onPress="load">加载</button><button onPress="inc">计数</button><text>{state.count}</text><each items={state.rows} itemKey={item.id}><text>{item.label}</text></each><action id="load"><set target="rows" value={[{id:"x",label:"X"},{id:"x",label:"Y"}]}/></action><action id="inc"><increment target="count"/></action></card>`
const fixed=bad.replace('{id:"x",label:"Y"}','{id:"y",label:"Y"}')
assert.equal(compileCard(bad,{final:true}).complete,true)
let modelCalls=0
const repair=await generateCard({input:{prompt:'局部组件与计数'},view:{debugGeneration:true},signal:AbortSignal.timeout(60000),streamUpstream:async(m,o)=>{o.onPiece({content:++modelCalls===1?bad:fixed})}})
assert.equal(modelCalls,2);assert.equal(repair.spec.generationDebug.tests[0].status,'failed');assert.equal(repair.spec.generationDebug.tests.at(-1).status,'passed')
await writeFile(resolve(out,'runtime-repair.json'),JSON.stringify({model:'scripted response, real browser execution',repair},null,2))
console.log('runtime failure -> repair -> browser pass')
const failedRecord=JSON.parse(await readFile(resolve(repair.spec.generationDebug.artifactPath,repair.spec.generationDebug.tests[0].version,'test-1.json'),'utf8'))
assert.ok(failedRecord.browser.runs.every(r=>r.final.state.count===1),'other controls must survive a failed component')
const model=JSON.parse(await readFile('artifacts/generation-debug-model/simulator.json','utf8'))
const modelRun=await runDebugBrowser(model.result.spec,{scenarios:['normal'],steps:[{op:'click',name:'消耗一步'},{op:'click',name:'消耗一步'},{op:'reload'}],artifactDir:resolve(out,'model-simulator')})
await writeFile(resolve(out,'model-simulator-replay.json'),JSON.stringify(modelRun,null,2))
assert.equal(modelRun.status,'tested',modelRun.reason)
const logic=Object.values(modelRun.runs[0].final.componentState).find(s=>s.logic)?.logic
assert.equal(logic.energy,1);assert.equal(logic.score,3);assert.equal(logic.step,2)
assert.equal(modelRun.runs[0].actions.at(-1).restored,true)
console.log('real model math + logic state restoration replay passed')
