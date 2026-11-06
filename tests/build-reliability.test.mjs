import test from 'node:test'
import assert from 'node:assert/strict'
import {generationCallOptions} from '../server/cardspec/build-policy.mjs'
import {buildDataflowDiagnostics} from '../server/cardspec/build-dataflow.mjs'
import {createBuildWorkspace,normalizeBuildOperation} from '../server/cardspec/build-workspace.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {buildDeepCard} from '../server/cardspec/deep-build.mjs'
import {createDebugSession} from '../server/cardspec/debug-session.mjs'
import {observedClickRole} from '../server/cardspec/build-feedback.mjs'

test('unspecified test role resolves only from a unique observed control, explicit intent is retained',()=>{
 const controls=[{name:'解释',role:'radio'}]
 assert.equal(observedClickRole({name:'解释'},controls),'radio')
 assert.equal(observedClickRole({name:'解释',role:'button'},controls),'button')
 assert.equal(observedClickRole({name:'不存在'},controls),'button')
 assert.equal(observedClickRole({name:'解释'},[...controls,...controls]),'button')
})

test('runtime error keeps its component location for module repair instead of defaulting to main',async()=>{
 const source='<card><title>外围</title><math id="eq" value="1"/></card>'
 const snapshot={errors:['dynamic formula failure'],errorDetails:[{message:'dynamic formula failure',node:'/lesson/eq'}],controls:[],coverage:[]}
 const debug=createDebugSession({context:()=>({buildMode:'deep'}),runner:async()=>({status:'tested',runs:[{scenario:'normal',initial:snapshot,final:snapshot,actions:[],pageErrors:[]}]})})
 const result=await debug.test({source,steps:[{op:'check'}]})
 const error=result.diagnostics.find(d=>d.code==='debug_runtime')
 assert.equal(error.node,'eq');assert.equal(error.offset,source.indexOf('<math'))
})

test('empty operations produce actionable protocol errors and chunk aliases stay bounded',()=>{
 assert.throws(()=>normalizeBuildOperation(null),/operation object/)
 assert.throws(()=>normalizeBuildOperation({op:null}),/null operation/)
 assert.equal(normalizeBuildOperation({type:'chunk'}).op,'chunk')
})

test('implementation target alias stays scoped and never overrides an explicit target',()=>{
 assert.equal(normalizeBuildOperation({op:'patch',module:'app.jsx',edits:[]}).name,'app.jsx')
 assert.equal(normalizeBuildOperation({op:'chunk',module:'app.jsx'}).name,'app.jsx')
 assert.equal(normalizeBuildOperation({op:'patch',module:'app.jsx',name:'other.jsx'}).name,'other.jsx')
 assert.equal(normalizeBuildOperation({op:'patch',module:'../escape.jsx'}).name,undefined)
 assert.equal(normalizeBuildOperation({op:'implementation_issue',module:'app.jsx'}).name,undefined)
})

test('deep mechanical phases override profile thinking, implementation retains room; quick unchanged',()=>{
 for(const buildPhase of ['plan','test']){
  const o=generationCallOptions({buildMode:'deep',modelProfile:'deep'},{buildPhase,maxTokens:2400})
  assert.equal(o.modelOverride,'glm-5.3');assert.equal(o.thinking.type,'disabled');assert.equal(o.maxTokens,buildPhase==='plan'?6144:8192)
 }
 assert.equal(generationCallOptions({buildMode:'deep',modelProfile:'deep'},{buildPhase:'implementation'}).maxTokens,16384)
 assert.equal(generationCallOptions({buildMode:'quick',modelProfile:'deep'},{maxTokens:2400}).maxTokens,32768)
})

test('dead data paths fail without confusing mutable empty lists or a visible empty hint',()=>{
 const prefix='<card><state id="rows" type="array" initial={[]}/><state id="loaded" type="boolean" initial={false}/>'
 const body='<if test={state.loaded}><each items={state.rows} as="r" itemKey={r.name}><text>{r.name}</text></each></if>'
 assert.deepEqual(buildDataflowDiagnostics(prefix+body+'</card>').map(d=>d.code),['build_guard_unreachable','build_data_source_missing'])
 const producers='<action id="result"><set target="rows" value={event.result.items}/><set target="loaded" value={true}/></action>'
 assert.equal(buildDataflowDiagnostics(prefix+body+producers+'</card>').length,0)
 assert.equal(buildDataflowDiagnostics(prefix+'<if test={!state.loaded}><text>未加载</text></if></card>').length,0)
 const populated='<card><data id="rows" value={[{name:"one"}]}/><each items={data.rows} as="r" itemKey={r.name}><text>{r.name}</text></each></card>'
 assert.equal(buildDataflowDiagnostics(populated).length,0)
 const reactive=prefix+'<state id="visible" type="boolean" initial={false}/><if test={state.loaded || state.visible}><text>可见</text></if><action id="show"><set target="visible" value={true}/></action></card>'
 assert.equal(buildDataflowDiagnostics(reactive).length,0)
})

test('hidden-view buttons cannot directly assign absent event fields; valid controls and explicit fallback remain valid',()=>{
 const make=value=>'<card><state id="view" type="string" initial="main"/><segmented label="视图" options={["main","detail"]} value={state.view} onChange="nav"/><if test={state.view=="detail"}><button onPress="nav" args="main">返回</button></if><action id="nav"><set target="view" value={'+value+'}/></action></card>'
 assert.ok(buildDataflowDiagnostics(make('event.value')).some(d=>d.code==='build_event_field_missing'))
 assert.ok(!buildDataflowDiagnostics(make('event.value ?? args')).some(d=>d.code==='build_event_field_missing'))
})

test('chunk writes are atomic, versioned, offset-bound and syntax checked at commit',()=>{
 const w=createBuildWorkspace(),source='<card><text>before</text></card>'
 w.write([{name:'main.cardspec',content:source}]);const base=w.read('main.cardspec')
 w.chunk({name:base.name,version:base.version,offset:0,content:'<card><text>',done:false})
 assert.equal(w.assemble().source,source)
 assert.throws(()=>w.chunk({name:base.name,version:base.version,offset:1,content:'x',done:false}),/offset/)
 assert.throws(()=>w.chunk({name:base.name,version:base.version,offset:12,content:'x',done:true},{checkSyntax:true}))
 w.chunk({name:base.name,version:base.version,offset:12,content:'after</text></card>',done:true},{checkSyntax:true})
 assert.match(w.assemble().source,/after/);assert.equal(w.pending().length,0)
 assert.throws(()=>w.chunk({name:base.name,version:base.version,offset:0,content:'x',done:false}),/stale/)
})

test('truncation preserves usage and separate content/reasoning sizes',async()=>{
 const client=createModelClient({base:'https://example.test',key:'test',model:'test',fetchImpl:async()=>new Response('data: '+JSON.stringify({choices:[{delta:{reasoning_content:'12345',content:'{'},finish_reason:'length'}],usage:{completion_tokens:10}})+'\n\ndata: [DONE]\n\n')})
 let usage
 await assert.rejects(client([],{maxTokens:10,onUsage:u=>usage=u}),e=>e.code==='OUTPUT_TRUNCATED'&&e.reasoningCharacters===5&&e.outputCharacters===1&&e.usage.completion_tokens===10)
 assert.equal(usage.completion_tokens,10)
})

test('bounded reasoning guard stops a gateway that ignores thinking-disabled without changing quick calls',async()=>{
 const event='data: '+JSON.stringify({choices:[{delta:{reasoning_content:'reasoning without code'},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n'
 const client=createModelClient({base:'https://example.test',key:'test',model:'test',fetchImpl:async()=>new Response(event)})
 await assert.rejects(client([],{maxReasoningCharacters:10,thinking:{type:'disabled'}}),e=>e.code==='OUTPUT_TRUNCATED'&&e.outputCharacters===0)
 assert.equal((await client([])).message.reasoning_content,'reasoning without code')
})

test('a completion/tool in the same SSE delta wins over the no-output reasoning guard',async()=>{
 const event='data: '+JSON.stringify({choices:[{delta:{reasoning_content:'long analysis',content:'{}'},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n'
 const client=createModelClient({base:'https://example.test',key:'test',model:'test',fetchImpl:async()=>new Response(event)})
 assert.equal((await client([],{maxReasoningCharacters:3})).message.content,'{}')
})

test('build submission is a bounded terminal envelope, never executes extra tools',async()=>{
 let body
 const event=calls=>'data: '+JSON.stringify({choices:[{delta:{tool_calls:calls},finish_reason:'tool_calls'}]})+'\n\ndata: [DONE]\n\n'
 const c={index:0,id:'build1',function:{name:'submit_build_operation',arguments:JSON.stringify({op:'describe',names:['slider']})}}
 const client=createModelClient({base:'https://example.test',key:'test',model:'test',fetchImpl:async(url,init)=>{body=JSON.parse(init.body);return new Response(event([c]))}})
 const result=await client([],{buildPhase:'implementation',responseFormat:{type:'json_object'},tools:[{type:'function',function:{name:'other'}}]})
 assert.equal(body.tool_choice.function.name,'submit_build_operation');assert.equal(body.response_format,undefined)
 assert.equal(result.message.tool_calls,undefined);assert.deepEqual(JSON.parse(result.message.content),{op:'describe',names:['slider']})
 const mixed=createModelClient({base:'https://example.test',key:'test',model:'test',fetchImpl:async()=>new Response(event([c,{index:1,id:'bad',function:{name:'cli_read',arguments:'{}'}}]))})
 await assert.rejects(mixed([],{buildPhase:'test'}),/exactly one/)
 const textClient=createModelClient({base:'https://example.test',key:'test',model:'test',fetchImpl:async()=>new Response('data: '+JSON.stringify({choices:[{delta:{content:'{"op":"test","steps":[]}'},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n')})
 assert.equal(JSON.parse((await textClient([],{buildPhase:'test'})).message.content).op,'test')
})

test('data defects route to implementation before freezing; shared tool contract stays out of tests',async()=>{
 const goal='显示库存并增加',context={renderMode:'native',expressionDialect:'js-v1'},seen=[]
 const step={op:'click',name:'增加',requirement:'R1',expect:{changed:true,state:{n:1}}}
 const runner=async(spec,{steps})=>({status:'tested',runs:[{scenario:'normal',initial:{state:{n:0},errors:[]},final:{errors:[],controls:[],coverage:[]},actions:steps.map(s=>({step:s,ok:true,changed:s.op==='click',assertion:s.expect?{passed:true}:undefined})),pageErrors:[]}]})
 const debug=createDebugSession({context:()=>context,runner});let index=0
 const result=await buildDeepCard({input:{prompt:goal},context,debug,cardId:'test-build-data-gate',toolContract:'REGISTERED_TOOL_SENTINEL',streamUpstream:async(messages,options)=>{
  seen.push(messages);const body=JSON.parse(messages[1].content);let out
  if(index===0)out={requirements:[{id:'R1',kind:'interaction',acceptance:'增加可观察'}],modules:[{name:'main.cardspec'}],interfaces:'n'}
  else if(index===1)out={op:'write',files:[{name:'main.cardspec',content:'<card><state id="rows" type="array" initial={[]}/><each items={state.rows} as="r" itemKey={r.name}><text>{r.name}</text></each></card>'}],claims:[{id:'R1',modules:['main.cardspec']}]}
  else if(index===2){assert.equal(body.feedback.phase,'implementation');out={op:'write',files:[{name:'main.cardspec',version:body.files[0].version,content:'<card><state id="n" type="number" initial={0}/><button onPress="add">增加</button><text>{state.n}</text><action id="add"><increment target="n"/></action></card>'}]}}
  else out={op:'test',steps:[step]}
  index++;options.onPiece({content:JSON.stringify(out)})
 }})
 assert.equal(result.coverage.status,'checked');assert.match(seen[1][0].content,/REGISTERED_TOOL_SENTINEL/);assert.ok(!seen[3][0].content.includes('REGISTERED_TOOL_SENTINEL'))
})
