import test from 'node:test'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'

// Requires the current local build. Real isolated browser, no model, tool or
// Owl connection. Do not replace this with native-only snapshot fixtures:
// FrameLocator navigation instrumentation once swallowed all frame evidence.
for(const renderMode of ['hybrid','web'])test(`sandbox text and interactions survive navigation observation (${renderMode})`,async()=>{
 const source='<card><sandbox id="counter" brief="计数" height={180} initial={{n:0}} source={`export default function App({state,setState}){return <div><p>计数 {state.n}</p><button onClick={()=>setState({n:state.n+1})}>加一</button>'+(renderMode==='web'?'<a href="https://example.org/test" target="_blank">打开原文</a>':'')+'</div>}`}/></card>'
 const compiled=compileCard(source,{final:true,context:{renderMode,expressionDialect:'js-v1'}})
 await validateRichContent(compiled)
 assert.equal(compiled.complete,true,JSON.stringify(compiled.diagnostics))
 const steps=[{op:'click',name:'加一',expect:{text:'计数 1'}}]
 if(renderMode==='web')steps.push({op:'click',name:'打开原文',role:'link',expect:{navigation:'https://example.org/test'}})
 const result=await runDebugBrowser(compiled.spec,{steps,scenarios:['normal'],viewports:[320,432],size:'auto'})
 assert.equal(result.status,'tested',result.reason)
 for(const run of result.runs){
  assert(run.initial.text.includes('计数 0'))
  assert(run.initial.controls.some(c=>c.sandbox&&c.name==='加一'))
  assert.equal(run.initial.empty,false)
  for(const action of run.actions){assert.equal(action.ok,true,action.error);assert.equal(action.assertion?.passed,true,JSON.stringify(action.assertion))}
 }
})
