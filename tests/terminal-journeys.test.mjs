import test from 'node:test'
import assert from 'node:assert/strict'
import {assertSnapshot} from '../shared/cardspec/debug-assertions.mjs'
import {terminalJourneyCoverage,expandJourneySteps} from '../server/cardspec/terminal-journeys.mjs'
import {validateDebugInput} from '../server/cardspec/debug-session.mjs'
import {generationPolicy,createGenerationBudget} from '../server/cardspec/budget.mjs'
import {modelCost,appendCost,costTotal} from '../shared/model-cost.mjs'
const state=ending=>({state:{},componentState:{'/game':{webSandbox:{state:{ending}}}}})
const terminal={outcome:'win',owner:'game',key:'ending',value:'win'}
test('success text cannot hide terminal overwrite',()=>{const a=assertSnapshot({terminal},state(null),{...state('mind'),text:'Victory!'});assert.equal(a.passed,false);assert.match(a.failures[0],/mind/)})
test('missing and ambiguous sandbox state do not pass',()=>{assert.equal(assertSnapshot({terminal},state(null),{text:'win'}).passed,false);assert.equal(assertSnapshot({terminal},state(null),{componentState:{'/a/game':{},'/b/game':{}}}).passed,false)})
test('independent terminal paths and meaningful restore evidence',()=>{
 const run=(outcome)=>({scenario:'normal',path:outcome,initial:state(null),final:state(outcome),actions:[{ok:true,changed:true,step:{op:'click',expect:{terminal:{...terminal,outcome,value:outcome}}},assertion:{passed:true}}]})
 const restore={scenario:'normal',initial:state(null),final:state(null),actions:[{ok:true,changed:true,step:{op:'click'}},{ok:true,restored:true,step:{op:'reload'}},{ok:true,changed:true,step:{op:'click'},assertion:{passed:true}}]}
 assert.equal(terminalJourneyCoverage('游戏',{runs:[run('win'),run('loss'),restore]}).status,'checked')
 assert.equal(terminalJourneyCoverage('游戏',{runs:[{...run('win'),initial:state('win')}]}).checked.length,0)
 assert.ok(terminalJourneyCoverage('游戏',{runs:[{...restore,actions:[restore.actions[1]]}]}).remaining.includes('restore'))
 assert.equal(terminalJourneyCoverage('旅行计划',{runs:[]}).required,false)
})
test('bounded repeat applies expectation only after final real click',()=>{const steps=[{op:'click',name:'推进',repeat:30,path:'win',expect:{state:{n:30}}}];validateDebugInput({source:'<card/>',steps});const expanded=expandJourneySteps(steps);assert.equal(expanded.length,30);assert.equal(expanded[0].expect,undefined);assert.equal(expanded[29].expect.state.n,30);assert.throws(()=>validateDebugInput({source:'<card/>',steps:[{...steps[0],repeat:31}]}));assert.throws(()=>validateDebugInput({source:'<card/>',steps:Array(6).fill(steps[0])}))})
test('time presets reserve validation without permitting infinite budgets',()=>{for(const minutes of [2,5,10]){const p=generationPolicy('game',{generationMinutes:minutes,extendedGeneration:true});assert.equal(p.timeoutMs,minutes*60000);let now=0;const b=createGenerationBudget(p,{now:()=>now});b.model();now=p.timeoutMs-p.validationReserveMs+1;assert.throws(()=>b.model(),/验证/);now=p.timeoutMs;assert.throws(()=>b.check(),/时间/)} })
test('cost includes cached tokens once, unknown usage is not zero billed',()=>{const c=modelCost('chat-latest',{prompt_tokens:1000000,prompt_tokens_details:{cached_tokens:200000},completion_tokens:100000});assert.equal(c.usd,7.1);const e={type:'model_cost',callId:'one',cost:c};const ledger=appendCost(appendCost([],e),e);assert.equal(ledger.length,1);assert.equal(costTotal(appendCost(ledger,{...e,callId:'two',cost:modelCost('chat-latest',null)})).unknown,1);assert.equal(modelCost('other',{}),null)})
