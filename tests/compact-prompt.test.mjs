import {compileCard} from '../shared/cardspec/compiler.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {COMPACT_CARD_PROMPT,planningPolicy} from '../server/cardspec/compact-prompt.mjs'
import {CARD_DSL_PROMPT,cardGenerationPrompt} from '../server/cardspec/prompt.mjs'
import {REGISTRY,registryReference} from '../shared/cardspec/registry.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {CASES} from '../scripts/direct-benchmark-cases.mjs'
test('compact disclosure retains every component, required data and event shape',()=>{
 const reference=registryReference({compact:true})
 for(const [name,def] of Object.entries(REGISTRY)){
  assert.ok(reference.includes(`<${name}>`),name)
  if(def.shape)assert.ok(reference.includes(def.shape),name+' shape')
  if(def.events)assert.ok(reference.includes(JSON.stringify(def.events)),name+' events')
 }
 assert.ok(COMPACT_CARD_PROMPT.length<CARD_DSL_PROMPT.length*.5)
 assert.ok(cardGenerationPrompt(null,{compact:true}).length<CARD_DSL_PROMPT.length*.7)
 assert.ok(cardGenerationPrompt(null,{compact:true}).includes('【可运行短例】'))
 for(const rule of ['snapshot','next','全部通过才提交','保存历史','when=','assetRef','禁止onclick'])assert.ok(cardGenerationPrompt(null,{compact:true}).includes(rule),rule)
})
test('standalone tasks skip planning while explicit decks and exploratory work retain it',async()=>{
 for(const goal of ['计数器与备注','多步报销表单','three step form',...CASES.slice(0,3).map(c=>c.prompt)])assert.equal(planningPolicy(goal).allowPlanning,false,goal)
 for(const goal of ['做三张卡分别比较预算与行程','multi-card travel guide','查询旅游地点并比较候选，规划后续探索'])assert.equal(planningPolicy(goal).allowPlanning,true,goal)
 const t=createGenerationTools({enabled:false,goal:'计数器'})
 const metadata=['capability_find','component_describe']
 assert.deepEqual(t.tools().map(t=>t.function.name),metadata)
 assert.deepEqual((await t.execute('capability_find',{query:'播客片单'})).tools,[])
 await assert.rejects(t.execute('cli_read',{id:'autocli.hackernews.top',input:{}}),/工具增强已关闭/)
 assert.ok(!t.prompt.includes('cli_read'))
 await assert.rejects(t.execute('plan_cards',{cards:[{title:'x',goal:'y'}],followups:[]}),/直接生成单卡/)
 const deck=createGenerationTools({enabled:false,goal:'做三张卡'})
 assert.deepEqual(deck.tools().map(t=>t.function.name),[...metadata,'plan_cards'])
 await deck.execute('plan_cards',{cards:[{title:'x',goal:'y'}],followups:[]})
 deck.lockPlan();assert.deepEqual(deck.tools().map(t=>t.function.name),metadata)
})

test('published complete example compiles with the real validator',()=>{
 const prompt=cardGenerationPrompt(null,{compact:true}); const example=prompt.slice(prompt.indexOf('【可运行短例】')); const source=example.slice(example.indexOf('<intro>'),example.indexOf('</outro>')+8); const result=compileCard(source,{final:true,context:{localDate:'2026-10-16'}}); assert.equal(result.complete,true,JSON.stringify(result.diagnostics));
})
