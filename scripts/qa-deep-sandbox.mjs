import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'

// Controlled harness regression, not a model-generated quality sample.
const jsx='export default function App({state,setState}) { const n=state.step||0; return <div style={{width:"100%",minWidth:0}}><svg viewBox="0 0 280 140" style={{width:"100%",height:140}}><rect x={20+n*30} y="40" width="40" height="40" fill="currentColor"/><text x="20" y="120">步数 {n}</text></svg><button onClick={()=>setState({step:(n+1)%4})}>推进</button></div> }'
const source=`<card theme="minimal"><title>沙箱步进测试</title><sandbox id="sim" height={180} brief="移动方块" initial={{step:0}} source={${JSON.stringify(jsx)}}/></card>`
const compiled=compileCard(source,{final:true,context:{renderMode:'hybrid',cardSize:'square',expressionDialect:'js-v1'}})
await validateRichContent(compiled);assert.equal(compiled.complete,true,JSON.stringify(compiled.diagnostics))
const dir='artifacts/deep-build-qa/sandbox-controls';await mkdir(dir,{recursive:true})
const result=await runDebugBrowser(compiled.spec,{artifactDir:dir,scenarios:['normal'],steps:[
 {op:'check',expect:{text:'步数 0',visual:true}},
 {op:'click',name:'推进',expect:{text:'步数 1',changed:true}},
 {op:'reload',expect:{text:'步数 1'}},
 {op:'click',name:'推进',expect:{text:'步数 2',changed:true}}
]})
await writeFile(dir+'/result.json',JSON.stringify(result,null,2))
assert.equal(result.status,'tested',result.reason)
for(const run of result.runs){assert.equal(run.pageErrors.length,0);assert.equal(run.final.layout.pass,true,JSON.stringify(run.final.layout.issues));for(const action of run.actions){assert.equal(action.ok,true,action.error);assert.equal(action.assertion?.passed,true,JSON.stringify(action.assertion))}assert.equal(run.actions[2].restored,true)}
console.log(JSON.stringify({passed:true,widths:result.runs.map(r=>r.width),steps:result.runs.reduce((n,r)=>n+r.actions.length,0),scope:'controlled fixture; frame controls and restore; not model quality'}))

const slider=compileCard('<card><state id="hours" type="number" initial={5}/><slider label="灯时长" value={state.hours} min={0} max={12} step={1} onChange="hours"/><text>小时 {state.hours}</text><action id="hours"><set target="hours" value={event.value}/></action></card>',{final:true,context:{renderMode:'native',cardSize:'auto'}})
assert.equal(slider.complete,true)
const discovery=await runDebugBrowser(slider.spec,{size:'auto',scenarios:['normal'],steps:[{op:'check'}]})
const name=discovery.runs[0].initial.controls.find(c=>c.name.includes('灯时长')).name
const sliderResult=await runDebugBrowser(slider.spec,{artifactDir:dir+'/slider',size:'auto',scenarios:['normal'],steps:[{op:'fill',name,value:'3',expect:{state:{hours:3},changed:true}},{op:'reload',expect:{state:{hours:3}}}]})
await writeFile(dir+'/slider-result.json',JSON.stringify(sliderResult,null,2))
for(const run of sliderResult.runs){for(const a of run.actions){assert.equal(a.ok,true,a.error);assert.equal(a.assertion.passed,true)}assert.equal(run.actions[1].restored,true)}
assert.equal(sliderResult.runs.length,2)
console.log(JSON.stringify({passed:true,scope:'dynamic accessible label survives range keyboard changes',steps:4}))

// Accessible names insert spaces across text nodes; textContent is not a
// reliable locator. Discovery must expose the exact name the browser uses.
const nestedJsx='export default function App({state,setState}) { return <div><button onClick={()=>setState({n:(state.n||0)+1})}><span style={{display:"block"}}>推进</span><small>观察变化</small></button><progress max="4" value={state.n||0}/><p>步数 {state.n||0}</p></div> }'
const nested=compileCard(`<card><sandbox id="nested" height={160} brief="推进进度" initial={{n:0}} source={${JSON.stringify(nestedJsx)}}/></card>`,{final:true,context:{renderMode:'hybrid'}})
await validateRichContent(nested);assert.equal(nested.complete,true)
const nestedDiscovery=await runDebugBrowser(nested.spec,{scenarios:['normal'],steps:[{op:'check'}]})
const nestedName=nestedDiscovery.runs[0].initial.controls.find(c=>c.sandbox&&c.role==='button')?.name
assert.equal(nestedName,'推进 观察变化')
const nestedResult=await runDebugBrowser(nested.spec,{artifactDir:dir+'/accessible-names',scenarios:['normal'],steps:[{op:'click',name:nestedName,expect:{text:'步数 1',changed:true,visual:true}},{op:'reload',expect:{text:'步数 1',visual:true}}]})
await writeFile(dir+'/accessible-result.json',JSON.stringify(nestedResult,null,2))
for(const run of nestedResult.runs)for(const a of run.actions){assert.equal(a.ok,true,a.error);assert.equal(a.assertion?.passed,true,JSON.stringify(a.assertion))}
console.log(JSON.stringify({passed:true,scope:'native accessible names across nested text and semantic progress graphics',steps:4}))
