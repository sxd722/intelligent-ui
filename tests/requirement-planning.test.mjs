import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {requestClauses} from '../server/cardspec/requirements.mjs'
import {requirementSeeds,inspectRequirementPlan,mergeRequirementPatch} from '../server/cardspec/requirement-plan.mjs'
import {createResearchSession} from '../server/research/session.mjs'
import {generationCallOptions} from '../server/cardspec/build-policy.mjs'
import {buildDeepCard} from '../server/cardspec/deep-build.mjs'
import {createBuildWorkspace} from '../server/cardspec/build-workspace.mjs'
import {buildFeedback} from '../server/cardspec/build-feedback.mjs'

test('Markdown titles and explicitly optional extensions do not become requirements; tail is balanced',()=>{
 const goal='# 游戏\n## 目标\n做一个回合游戏。\n## 用户旅程\n'+Array.from({length:20},(_,i)=>`${i+1}. 功能${i}：选择对象并展示结果${i}。`).join('\n')+'\n## 可选建议\n战绩排行榜\n## 边界情况\n重开清除日志';
 const parts=requestClauses(goal)
 assert.ok(parts.length<=12);assert.ok(!parts.some(p=>/^#+[^\n]+$/.test(p)))
 assert.ok(parts.every(p=>goal.includes(p)));assert.ok(parts.at(-1).includes('重开清除日志'))
 assert.ok(Math.max(...parts.map(p=>p.length))<180)
 assert.ok(!parts.some(p=>p==='战绩排行榜'))
})

test('real failed input no longer has a giant final clause',()=>{
 const goal=readFileSync(new URL('./fixtures/requirements-game.md',import.meta.url),'utf8')
 const parts=requestClauses(goal)
 assert.ok(Math.max(...parts.map(p=>p.length))<400)
 for(const word of ['结束回合','体力','胜负','再来一局','AI','牌堆'])assert.ok(parts.some(p=>p.includes(word)))
 assert.ok(!parts.includes('## 目标'));assert.ok(!parts.includes('如各 2–4 张）'))
})

test('local patch retains valid requirements and modules, ignores attempts to overwrite them',()=>{
 const goal='选择城市，调整预算，生成行程',seeds=requirementSeeds(goal)
 const draft={requirements:[{id:'R1',acceptance:'选择显示城市'},{id:'R2',acceptance:'预算改变'}],modules:[{name:'main.cardspec',interfaces:'state.city, state.budget'}]}
 const r=inspectRequirementPlan(goal,draft,seeds)
 assert.deepEqual(r.missing.map(r=>r.id),['R3']);assert.match(r.plan.interfaces,/state.city/)
 const merged=mergeRequirementPatch(r.plan,{requirements:[{id:'R1',acceptance:'恶意覆盖'},{id:'R3',acceptance:'行程按选择生成'}],modules:[]},r.issues)
 assert.equal(merged.requirements[0].acceptance,'选择显示城市');assert.deepEqual(merged.modules,draft.modules)
 assert.deepEqual(inspectRequirementPlan(goal,merged,seeds).issues,[])
})

test('duplicate and malformed requirements need explicit repair, never implicit acceptance',()=>{
 const r=inspectRequirementPlan('一步',{requirements:[{id:'R1',acceptance:'a'},{id:'R1',acceptance:'b'}],modules:[{name:'main.cardspec'}],interfaces:'无'})
 assert.deepEqual(r.missing.map(r=>r.id),['R1']);assert.equal(r.plan.requirements.length,0)
})

test('module unit errors enter targeted repair instead of failing after successful requirement planning',()=>{
 const r=inspectRequirementPlan('可玩模拟',{requirements:[{id:'R1',acceptance:'完整闭环'}],modules:[{name:'main.cardspec',units:Array.from({length:9},(_,i)=>({goal:'step'+i}))}],interfaces:'state'});
 assert.deepEqual(r.issues.map(i=>i.field),['modules','interfaces']);assert.match(r.issues[0].message,/1–8/)
 assert.doesNotThrow(()=>inspectRequirementPlan('任务',{modules:{bad:true}}))
})

test('one stateful Web runtime can keep four small commits without splitting into isolated modules',()=>{
 const base={requirements:[{id:'R1',acceptance:'完整闭环'}],modules:[{name:'main.cardspec'},{name:'app.jsx',units:Array.from({length:4},(_,i)=>({goal:'step'+i}))}],interfaces:'app owns state'}
 assert.deepEqual(inspectRequirementPlan('可玩模拟',base,undefined,{renderMode:'web'}).issues,[])
 const split=inspectRequirementPlan('可玩模拟',{...base,modules:[...base.modules,{name:'ai.jsx'}]},undefined,{renderMode:'web'})
 assert.match(split.issues[0].message,/one JSX/)
 const native=inspectRequirementPlan('可玩模拟',base,undefined,{renderMode:'native'})
 assert.match(native.issues[0].message,/native/)
})

test('discovery truncation or unexpected prose retries at the original planning budget',async()=>{
 for(const truncated of [true,false]){
  const s=createResearchSession({providers:{search:async()=>{throw Error('must not execute')},read:async()=>{throw Error('must not execute')}}});let calls=0
  const result=await s.run(async(messages,o)=>{
   if(!calls++){assert.equal(o.maxTokens,2048);assert.match(messages.at(-1).content,/仅探测/);if(truncated)throw Object.assign(Error('length'),{code:'OUTPUT_TRUNCATED'});return {message:{content:'partial plan'}}}
   assert.equal(o.maxTokens,6144);assert.deepEqual(o.responseFormat,{type:'json_object'});assert.notEqual(o.toolChoice,'required')
   assert.ok(!messages.some(m=>m.content==='partial plan'));return {message:{content:'{"complete":true}'}}
  },[],{requireToolUse:true,maxTokens:6144,responseFormat:{type:'json_object'},onPiece:()=>{}})
  assert.equal(result,'{"complete":true}');assert.equal(calls,2)
 }
})

test('extended mode does not turn brief planning into high-effort unbounded output',()=>{
 const options=generationCallOptions({extendedGeneration:true,modelProfile:'default'},{buildPhase:'plan',maxTokens:1024})
 assert.equal(options.maxTokens,6144);assert.equal(options.reasoningEffort,'low')
})

test('deep orchestration patches only the missing entry without redoing research or accepted plan',async()=>{
 const calls=[],goal='调整参数，观察结果'
 await assert.rejects(buildDeepCard({input:{prompt:goal},context:{renderMode:'web'},cardId:'test-requirement-patch',research:{lockPlan(){}},planningTools:[{id:'opencli.any'}],streamUpstream:async(messages,options)=>{
  const body=JSON.parse(messages[1].content);calls.push({body,options})
  options.onPiece({content:'先说明操作；结构化提交以最终返回值为准。'})
  if(calls.length===1)return JSON.stringify({requirements:[{id:'R1',kind:'interaction',acceptance:'参数改变'}],modules:[{name:'main.cardspec',interfaces:'n'}]})
  if(calls.length===2){assert.deepEqual(body.missing.map(r=>r.id),['R2']);assert.equal(body.request,undefined);assert.equal(options.research,undefined);return JSON.stringify({requirements:[{id:'R2',kind:'content',acceptance:'结果改变'}]})}
  throw Object.assign(Error('stop after planning'),{code:'BUILD_STALLED'})
 }}),/stop after planning/)
 assert.equal(calls[0].options.requireToolUse,false);assert.equal(calls.length,3)
})

test('JSX implementation does not receive the native expression and component grammar',async()=>{
 let count=0
 await assert.rejects(buildDeepCard({input:{prompt:'互动舞台'},context:{renderMode:'web'},cardId:'test-jsx-context',streamUpstream:async(messages)=>{
  const body=JSON.parse(messages[1].content)
  if(!count++)return JSON.stringify({requirements:[{id:'R1',acceptance:'交互有反馈'}],interfaces:'app owns state',modules:[{name:'main.cardspec',units:[{goal:'mount'}]},{name:'app.jsx',units:[{goal:'interaction'}]}]})
  if(body.file?.name==='main.cardspec')return '<card><sandbox id="app" brief="互动舞台" source="@module:app.jsx"/></card>'
  assert.equal(body.file.name,'app.jsx');assert.match(body.outputContract,/JSX module/)
  assert.doesNotMatch(messages[0].content,/【事务动作】|<action id=|所有组件共有/)
  throw Object.assign(Error('checked JSX prompt'),{code:'BUILD_STALLED'})
 }}),/checked JSX prompt/)
})

test('a sandbox runtime failure targets its JSX module, not its host mounting tag',()=>{
 const w=createBuildWorkspace();w.write([{name:'main.cardspec',content:'<card><sandbox id="app" source="@module:app.jsx"/></card>'},{name:'app.jsx',content:'export default function App(){return null}'}])
 const a=w.assemble(),f=buildFeedback({diagnostics:[{severity:'error',code:'debug_runtime',node:'app',offset:a.source.indexOf('<sandbox'),message:'undefined.length'}]},null,a)
 assert.equal(f.module,'app.jsx');assert.equal(f.phase,'implementation')
 const layout=buildFeedback({diagnostics:[]},{runs:[{scenario:'normal',width:320,initial:{layout:{issues:[{code:'internal-overflow',element:'app / iframe / html',webFrame:true}]}},actions:[]}]},a)
 assert.equal(layout.module,'app.jsx')
})

test('resuming an already committed unit does not regenerate it or skip its browser tests',async()=>{
 const source='<card><text>完成</text></card>',goal='展示内容',step={op:'check',requirement:'R1',expect:{text:'完成'}}
 const plan={requirements:[{id:'R1',kind:'content',quote:goal,acceptance:'展示完成'}],modules:[{name:'main.cardspec',units:[{goal:'正文',requirements:['R1']}]}],interfaces:'无'}
 let calls=0,checks=0
 const debug={test:async()=>{checks++;return {version:'test',status:'passed',diagnostics:[]}},evidence:()=>({runs:[{scenario:'normal',initial:{},final:{},actions:[{step,ok:true,assertion:{passed:true}}]}]}),commit:()=>({source,version:'test',status:'passed'})}
 await buildDeepCard({input:{prompt:goal},context:{renderMode:'native'},cardId:'test-committed-resume',debug,resume:{goal,plan,workspace:{'main.cardspec':{content:source}},committedUnits:['main.cardspec:0'],claims:[],trace:[]},streamUpstream:async(messages,options)=>{
  calls++;assert.equal(options.buildPhase,'test');return JSON.stringify({op:'test',claims:[{id:'R1',modules:['main.cardspec']}],steps:[step]})
 }})
 assert.equal(calls,1);assert.equal(checks,2)
})
