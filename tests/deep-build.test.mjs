import test from 'node:test'
import assert from 'node:assert/strict'
import {createBuildWorkspace,normalizeBuildOperation} from '../server/cardspec/build-workspace.mjs'
import {validateRequirements,requirementAudit,behaviorFootprint,lostBehaviors,requestClauses} from '../server/cardspec/requirements.mjs'
import {assertSnapshot} from '../shared/cardspec/debug-assertions.mjs'
import {createDebugSession,validateDebugInput} from '../server/cardspec/debug-session.mjs'
import {generationPolicy,createGenerationBudget} from '../server/cardspec/budget.mjs'
import {generationSettings} from '../shared/cardspec/generation-settings.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {buildDeepCard} from '../server/cardspec/deep-build.mjs'

test('request coverage cannot quietly omit a clause or invent a quote',()=>{
 const goal='原理讲解，交互动画，十道题可刷新'
 assert.throws(()=>validateRequirements(goal,[{id:'R1',quote:'十道题可刷新',acceptance:'练习'}]),/omitted/)
 assert.throws(()=>validateRequirements(goal,[{id:'R1',quote:'假需求',acceptance:'练习'}]))
 assert.equal(validateRequirements(goal,[{id:'R1',quote:goal,acceptance:'完整闭环'}]).length,1)
 const long=Array.from({length:20},(_,i)=>'需求'+i).join('，');assert.ok(requestClauses(long).at(-1).includes('需求19'))
})

test('single operation aliases are safe; ambiguous batches remain rejected',()=>{
 assert.deepEqual(normalizeBuildOperation({ops:[{type:'write',files:[]}]}),{type:'write',op:'write',files:[]})
 assert.deepEqual(normalizeBuildOperation({op:{read:[{names:['lesson.cardspec']}]}}),{op:'read',names:['lesson.cardspec']})
 assert.equal(normalizeBuildOperation({ops:[{type:'write'},{type:'finish'}]}).op,undefined)
 assert.equal(normalizeBuildOperation({type:'shell'}).op,undefined)
})
test('claims are not proof, static checks cannot fulfill an interaction, blocked remains partial',()=>{
 const r=[{id:'R1',kind:'interaction',quote:'交互'}],claim=[{id:'R1',modules:['main.cardspec']}]
 assert.equal(requirementAudit(r,claim,{actions:[]}).status,'partial')
 const action={step:{op:'check',requirement:'R1'},ok:true,assertion:{passed:true}}
 assert.equal(requirementAudit(r,claim,{actions:[action]}).status,'partial')
 assert.equal(requirementAudit(r,claim,{actions:[{...action,step:{...action.step,op:'click'},changed:true}]}).status,'checked')
 assert.equal(requirementAudit(r,[{id:'R1',blocked:'未核实'}],{}).items[0].status,'unverified')
 assert.equal(requirementAudit([{...r[0],kind:'evidence'}],[{id:'R1',blocked:'未核实'}],{}).items[0].status,'blocked')
 assert.equal(requirementAudit(r,[],{actions:[{...action,step:{...action.step,op:'click'},changed:true}]}).status,'partial')
 assert.equal(requirementAudit(r,claim,{actions:[{...action,step:{...action.step,op:'click'},changed:true},{...action,ok:false}]}).status,'partial')
})

test('cached evidence belongs to the tested candidate and rollback cannot remove working behavior',async()=>{
 const plain='<card><text>静态页</text></card>',interactive='<card><state id="n" type="number" initial={0}/><button onPress="inc">增加</button><text>{state.n}</text><action id="inc"><increment target="n"/></action></card>'
 let calls=0;const runner=async()=>({status:'tested',marker:++calls,runs:[{scenario:'normal',initial:{errors:[]},final:{errors:[],controls:[],coverage:[]},actions:[],pageErrors:[]}]})
 const debug=createDebugSession({runner});const first=await debug.test({source:plain});await debug.test({source:interactive});assert.equal(debug.evidence().marker,2)
 await debug.test({source:plain});assert.equal(debug.evidence().marker,1);assert.throws(()=>debug.commit({version:first.version}),/repair_behavior_lost/)
})
test('modular writes are atomic, versioned, bounded, and expand without changing unaffected files',()=>{
 const w=createBuildWorkspace();w.write([{name:'main.cardspec',content:'<card><include module="body.cardspec"/><sandbox source="@module:view.jsx"/></card>'},{name:'body.cardspec',content:'<text>保留讲解</text>'},{name:'view.jsx',content:'export default function App(){return <svg/>}'}])
 const old=w.read('body.cardspec');assert.match(w.assemble().source,/保留讲解/)
 assert.throws(()=>w.write([{name:'body.cardspec',content:'删掉'}]),/stale/)
 assert.throws(()=>w.write([{name:'new.cardspec',content:'x'},{name:'../bad.cardspec',content:'x'}]));assert.equal(w.manifest().length,3)
 const v=w.read('view.jsx');w.write([{name:v.name,version:v.version,content:'export default function App(){return <svg viewBox="0 0 2 2"/>}'}])
 assert.deepEqual(w.read('body.cardspec'),old);assert.equal(w.assemble().used.length,3)
 w.write([{name:'body.cardspec',version:old.version,content:'<include module="main.cardspec"/>'}]);assert.throws(()=>w.assemble(),/cycle/)
})
test('expectations compare actual state/content and never evaluate code',()=>{
 const before={state:{n:0},text:'0'},after={state:{n:1},text:'结果 1',visualCount:1}
 assert.equal(assertSnapshot({state:{n:1},text:'结果',changed:true,visual:true},before,after).passed,true)
 assert.equal(assertSnapshot({state:{n:2}},before,after).passed,false)
 assert.throws(()=>assertSnapshot({eval:'fetch()'},before,after))
 assert.throws(()=>validateDebugInput({source:'<card/>',steps:[{op:'check',expect:{eval:'x'}}]}))
})

test('dotted JSX module names resolve and source errors map back to their module',()=>{
 const w=createBuildWorkspace()
 w.write([{name:'main.cardspec',content:'<card><sandbox id="s" source="@module:stage.pipeline.jsx"/></card>'},{name:'stage.pipeline.jsx',content:'export default function App(){ return <svg/> }'}])
 const a=w.assemble();assert.deepEqual(a.used,['main.cardspec','stage.pipeline.jsx'])
 assert.equal(a.bindings[0].start,a.source.indexOf('<sandbox'))
 assert.equal(a.bindings[0].module,'stage.pipeline.jsx')
 assert.throws(()=>w.write([{name:'main.cardspec',version:w.read('main.cardspec').version,content:'<card/>'},{name:'bad..jsx',content:'x'}]))
 assert.equal(w.assemble().version,a.version)
})
test('repair guard retains existing visual and interaction capabilities',()=>{
 const old=compileCard('<card><state id="n" type="number" initial={0}/><button onPress="inc">增加</button><action id="inc"><increment target="n"/></action></card>',{final:true}).spec
 const text=compileCard('<card><text>已完成</text></card>',{final:true}).spec
 assert.ok(lostBehaviors(behaviorFootprint(old),text).length)
 assert.equal(generationSettings({}).buildMode,'quick');assert.equal(generationPolicy('x',{buildMode:'deep'}).plan,false)
})
test('deep build commits tested version, saves coverage, and does not resend all previous outputs',async()=>{
 const goal='计数交互',req={id:'R1',kind:'interaction',quote:goal,acceptance:'点击增加后n=1'}
 const steps=[{op:'click',name:'增加',requirement:'R1',expect:{state:{n:1},changed:true}}]
 const outputs=[{requirements:[req],modules:[{name:'main.cardspec'}],interfaces:'state.n'},
  {op:'write',files:[{name:'main.cardspec',content:'<card><state id="n" type="number" initial={0}/><button onPress="inc">增加</button><text>{state.n}</text><action id="inc"><increment target="n"/></action></card>'}],claims:[{id:'R1',modules:['main.cardspec']}],steps},{op:'test',claims:[{id:'R1',modules:['main.cardspec']}],steps}]
 const budget=createGenerationBudget(generationPolicy(goal,{buildMode:'deep'})),context={buildMode:'deep',expressionDialect:'js-v1',renderMode:'native',cardSize:'auto'}
 const runner=async()=>({status:'tested',runs:[{scenario:'normal',initial:{errors:[]},final:{errors:[],controls:[],coverage:[]},actions:[{step:steps[0],ok:true,changed:true,assertion:{passed:true}}],pageErrors:[]}]})
 const debug=createDebugSession({context:()=>context,budget,runner}),messages=[]
 const result=await buildDeepCard({input:{prompt:goal},context,debug,budget,signal:new AbortController().signal,cardId:'test-deep-counter',streamUpstream:async(m,o)=>{messages.push(m);budget.model(o.stage);o.onPiece({content:JSON.stringify(outputs.shift())})}})
 assert.equal(result.coverage.status,'checked');assert.match(result.source,/<button/);assert.equal(messages.length,3)
 assert.deepEqual(JSON.parse(messages[1][1].content).focused,[])
 assert.ok(JSON.parse(messages[1][1].content).files.every(f=>!Object.hasOwn(f,'content')))
})

test('pending claims allow creating missing modules; unconnected modules require linking, not copying',async()=>{
 const goal='讲解',budget=createGenerationBudget(generationPolicy(goal,{buildMode:'deep'})),context={buildMode:'deep',renderMode:'native',cardSize:'auto'}
 const step={op:'check',requirement:'R1',expect:{text:'正文'}}
 const runner=async()=>({status:'tested',runs:[{scenario:'normal',initial:{errors:[]},final:{errors:[],controls:[],coverage:[]},actions:[{step,ok:true,assertion:{passed:true}}],pageErrors:[]}]})
 const debug=createDebugSession({context:()=>context,budget,runner});let round=0;const bodies=[]
 const output=body=>{
  switch(round++){
   case 0:return {requirements:[{id:'R1',kind:'content',acceptance:'正文可见'}],modules:[{name:'main.cardspec'},{name:'body.cardspec'}],interfaces:'无共享状态'}
   case 1:return {op:'write',files:[{name:'main.cardspec',content:'<card><text>目录</text></card>'}],claims:[{id:'R1',modules:['body.cardspec']}]}
   case 2:assert.match(body.task,/创建 body.cardspec/);return {op:'write',files:[{name:'body.cardspec',content:'<text>正文</text>'}]}
   case 3:assert.match(body.feedback.error,/Unconnected/);assert.deepEqual(body.focused.map(f=>f.name),['main.cardspec']);return {op:'write',files:[{name:'main.cardspec',version:body.files.find(f=>f.name==='main.cardspec').version,content:'<card><include module="body.cardspec"/></card>'}]}
   default:assert.equal(body.focused,undefined);return {op:'test',steps:[step]}
  }
 }
 const r=await buildDeepCard({input:{prompt:goal},context,debug,budget,signal:new AbortController().signal,cardId:'test-module-links',streamUpstream:async(m,o)=>{const body=JSON.parse(m[1].content);bodies.push(body);budget.model(o.stage);o.onPiece({content:JSON.stringify(output(body))})}})
 assert.equal(r.coverage.status,'checked');assert.equal(round,5);assert.match(r.source,/正文/)
})

test('an untested evidence limitation cannot bypass the final coverage gate',async()=>{
 const budget=createGenerationBudget(generationPolicy('来源核实',{buildMode:'deep'})),context={buildMode:'deep',renderMode:'native'}
 const debug=createDebugSession({context:()=>context,budget,runner:async()=>({status:'tested',runs:[{scenario:'normal',initial:{errors:[]},final:{errors:[],controls:[],coverage:[]},actions:[],pageErrors:[]}]})})
 let n=0
 await assert.rejects(buildDeepCard({input:{prompt:'来源核实'},context,debug,budget,cardId:'test-blocked-coverage',signal:new AbortController().signal,streamUpstream:async(m,o)=>{
  budget.model(o.stage)
  const output=n++===0?{requirements:[{id:'R1',kind:'evidence',acceptance:'来源有明确依据或显示核实限制'}],modules:[{name:'main.cardspec'}],interfaces:'无'}:n===2?{op:'write',files:[{name:'main.cardspec',content:'<card><text>没有来源</text></card>'}],claims:[{id:'R1',modules:['main.cardspec'],blocked:'无法核实'}]}:{op:'finish'}
  o.onPiece({content:JSON.stringify(output)})
 }}),/未改变实现或测试/)
})


test('navigation compact contract explains ownership and diagnostic maps to the offending module',async()=>{
 const {registryReference}=await import('../shared/cardspec/registry.mjs')
 assert.match(registryReference({compact:true,names:['navigation']}),/不是页面路由/)
 const w=createBuildWorkspace();w.write([{name:'main.cardspec',content:'<card><include module="body.cardspec"/></card>'},{name:'body.cardspec',content:'<navigation id="wrong" target="lesson"/>'}])
 const a=w.assemble(),result=compileCard(a.source,{final:true})
 const d=result.diagnostics.find(d=>d.code==='navigation_target');assert.equal(d.offset,a.source.indexOf('<navigation'))
 const {buildFeedback}=await import('../server/cardspec/build-feedback.mjs')
 const f=buildFeedback({status:'failed',diagnostics:[d]},undefined,a)
 assert.equal(f.phase,'implementation');assert.equal(f.diagnostics[0].module,'body.cardspec')
})

test('test repair cannot write implementation and receives observations without code or DSL contract',async()=>{
 const goal='计数交互',context={buildMode:'deep',renderMode:'native'},source='<card><state id="n" type="number" initial={0}/><button onPress="inc">增加</button><action id="inc"><increment target="n"/></action></card>'
 const steps=[{op:'click',name:'增加',requirement:'R1',expect:{state:{n:1},changed:true}}],seen=[]
 const runner=async(spec,{steps:actual})=>({status:'tested',runs:[{scenario:'normal',initial:{errors:[],state:{n:0},controls:[{name:'增加',role:'button'}]},final:{errors:[],controls:[],coverage:[]},actions:actual.map(step=>({step,ok:true,changed:step.op==='click',assertion:step.expect?{passed:true}:undefined,observed:{state:{n:1}}})),pageErrors:[]}]})
 const debug=createDebugSession({context:()=>context,runner}),budget=createGenerationBudget(generationPolicy(goal,{buildMode:'deep'}))
 const outputs=[{requirements:[{id:'R1',kind:'interaction',acceptance:'增加到1'}],modules:[{name:'main.cardspec'}],interfaces:'n'}, {op:'write',files:[{name:'main.cardspec',content:source}],claims:[{id:'R1',modules:['main.cardspec']}]}, {op:'write',files:[{name:'main.cardspec',content:'<card/>'}]}, {op:'test',steps}]
 const result=await buildDeepCard({input:{prompt:goal},context,debug,budget,cardId:'test-readonly-tests',streamUpstream:async(m,o)=>{seen.push(m);o.onPiece({content:JSON.stringify(outputs.shift())})}})
 assert.equal(result.source,source);assert.equal(result.coverage.status,'checked')
 for(const m of seen.slice(2)){assert.equal(JSON.parse(m[1].content).focused,undefined);assert.ok(!m[0].content.includes('所有组件共有'));assert.ok(!m[1].content.includes(source))}
 assert.match(JSON.parse(seen[3][1].content).feedback.error,/实现冻结/)
})


test('layout ownership resolves repeated item DOM paths to the fragment, not main',async()=>{
 const {buildFeedback,buildInterface}=await import('../server/cardspec/build-feedback.mjs')
 const w=createBuildWorkspace();w.write([{name:'main.cardspec',content:'<card><state id="view" type="string" initial="list"/><include module="items.cardspec"/></card>'},{name:'items.cardspec',content:'<button id="entry">项目</button>'}])
 const assembled=w.assemble(),f=buildFeedback({status:'partial',diagnostics:[]},{runs:[{scenario:'normal',width:320,initial:{},final:{layout:{issues:[{code:'clipped-content',element:'div.cs-card'},{code:'control-not-fully-visible',element:'/list/item-1/entry',width:280}]}},actions:[]}]},assembled)
 assert.equal(f.module,'items.cardspec');assert.equal(f.layout[1].viewportWidth,320)
 const api=buildInterface(w.read('main.cardspec').content);assert.equal(api.state.view.type,'string');assert.ok(JSON.stringify(api).length<500)
})

test('module interfaces expose data fields and declared bridge only, not entire datasets',async()=>{
 const {buildInterface,buildFeedback}=await import('../server/cardspec/build-feedback.mjs')
 const source='<card><data id="rows" value={[{id:"x",title:"PRIVATE_DATA_BODY",score:1}]}/><state id="n" type="number" initial={0}/><sandbox id="s" actions={{step:"inc"}} input={{n:state.n}} source="@module:s.jsx"/><action id="inc"><increment target="n"/></action></card>'
 const api=buildInterface(source)
 assert.deepEqual(api.data.rows.item,{id:'string',title:'string',score:'number'});assert.equal(api.state.n.initial,0)
 assert.ok(api.sandboxes[0].actions);assert.doesNotMatch(JSON.stringify(api),/PRIVATE_DATA_BODY/)
 const w=createBuildWorkspace();w.write([{name:'main.cardspec',content:source},{name:'s.jsx',content:'export default function App(){return <svg/>}'}])
 const a=w.assemble(),offset=a.source.indexOf('<sandbox')
 const f=buildFeedback({status:'failed',diagnostics:[{code:'sandbox_bridge_contract',severity:'error',offset,message:'Sandbox action is not exposed: step'}]},undefined,a)
 assert.equal(f.module,'main.cardspec')
})

test('local patches are versioned, unique and atomic, retaining unrelated modules',()=>{
 const w=createBuildWorkspace();w.write([{name:'main.cardspec',content:'<card><text>保留正文</text><button>继续</button></card>'},{name:'other.cardspec',content:'<text>另一个模块</text>'}])
 const file=w.read('main.cardspec'),other=w.read('other.cardspec')
 assert.throws(()=>w.patch({name:file.name,version:file.version,edits:[{old:'<button>',new:'<button id="next">'},{old:'不存在',new:'x'}]}),/exactly once/)
 assert.deepEqual(w.read(file.name),file)
 assert.throws(()=>w.patch({name:file.name,version:file.version,edits:[{old:'<',new:'>'}]}),/exactly once/)
 w.patch({name:file.name,version:file.version,edits:[{old:'<button>',new:'<button id="next">'}]})
 assert.match(w.read(file.name).content,/保留正文/);assert.deepEqual(w.read(other.name),other)
 assert.throws(()=>w.patch({name:file.name,version:file.version,edits:[{old:'继续',new:'下一步'}]}),/stale/)
})


test('all discovered control roles are legal in tests and bad steps identify the exact field',()=>{
 const source='<card/>'
 assert.equal(validateDebugInput({source,steps:[{op:'fill',name:'数值',role:'slider',value:5}]}).steps[0].value,'5')
 assert.throws(()=>validateDebugInput({source,steps:[{op:'check'},{op:'fill',name:'数值',role:'guess',value:'5'}]}),/step 2.role/)
 assert.throws(()=>validateDebugInput({source,steps:[{op:'check',expect:{foo:1}}]}),/step 1.expect/)
})

test('repair can hand off to an existing dependency without applying a blind cross-module patch',async()=>{
 const goal='显示计数',context={buildMode:'deep',renderMode:'native'},main='<card><include module="body.cardspec"/></card>'
 const w=createBuildWorkspace();w.write([{name:'main.cardspec',content:main},{name:'body.cardspec',content:'<text>{state.n}</text>'}])
 const steps=[{op:'check',requirement:'R1',expect:{text:'0'}}]
 const runner=async(spec,{steps:s})=>({status:'tested',runs:[{scenario:'normal',initial:{errors:[],state:{n:0}},final:{errors:[],controls:[],coverage:[]},actions:s.map(step=>({step,ok:true,assertion:step.expect?{passed:true}:undefined})),pageErrors:[]}]})
 const debug=createDebugSession({context:()=>context,runner}),budget=createGenerationBudget(generationPolicy(goal,{buildMode:'deep'}));let calls=0
 const result=await buildDeepCard({input:{prompt:goal},context,debug,budget,cardId:'test-dependency-handoff',resume:{goal,plan:{requirements:[{id:'R1',kind:'content',quote:goal,acceptance:'显示0'}],modules:[{name:'main.cardspec'},{name:'body.cardspec'}],interfaces:'n'},workspace:w.snapshot(),claims:[{id:'R1',modules:['body.cardspec']}]},streamUpstream:async(m,o)=>{
  const body=JSON.parse(m[1].content);calls++
  if(calls===1)assert.match(body.task,/body.cardspec/)
  if(calls===2){assert.match(body.task,/main.cardspec/);assert.equal(body.focused[0].content,main)}
  o.onPiece({content:JSON.stringify(calls<=2?{op:'patch',name:'main.cardspec',version:w.read('main.cardspec').version,edits:[{old:'<card>',new:'<card><state id="n" type="number" initial={0}/>'}]}:{op:'test',steps})})
 }})
 assert.equal(result.coverage.status,'checked');assert.equal(calls,3)
})

test('invalid fragment repairs are rejected atomically before they poison the assembled parent',()=>{
 const w=createBuildWorkspace();w.write([{name:'main.cardspec',content:'<card><if test={true}><include module="body.cardspec"/></if></card>'},{name:'body.cardspec',content:'<region><text>保留</text></region>'}])
 const before=w.read('body.cardspec')
 assert.throws(()=>w.patch({name:before.name,version:before.version,edits:[{old:'</region>',new:''}]},{checkSyntax:true}),/Module unchanged.*body.cardspec/)
 assert.deepEqual(w.read(before.name),before)
 w.patch({name:before.name,version:before.version,edits:[{old:'保留',new:'更新'}]},{checkSyntax:true})
 assert.match(w.assemble().source,/更新/)
})

test('exhausted generation budget stops without three futile repair retries',async()=>{
 const goal='计数',context={buildMode:'deep',renderMode:'native'};let calls=0
 const debug=createDebugSession({context:()=>context}),budget=createGenerationBudget(generationPolicy(goal,{buildMode:'deep'}))
 await assert.rejects(buildDeepCard({input:{prompt:goal},context,debug,budget,cardId:'test-budget-stop',streamUpstream:async()=>{
  calls++;if(calls===1)return JSON.stringify({requirements:[{id:'R1',kind:'interaction',acceptance:'计数增加'}],modules:[{name:'main.cardspec'}],interfaces:'n'})
  throw Object.assign(Error('budget exhausted'),{code:'GENERATION_BUDGET'})
 }}),e=>e.code==='GENERATION_BUDGET')
 assert.equal(calls,2)
})
