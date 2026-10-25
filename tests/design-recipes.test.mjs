import test from 'node:test'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {DESIGNS,designReference} from '../shared/cardspec/designs.mjs'
import {TEMPLATE_IDS} from '../shared/cardspec/layout-templates.mjs'
import {VISUAL_STYLE_IDS} from '../shared/cardspec/styles.mjs'
import {planningConversation,validatePlanVisualStyle} from '../server/cardspec/planning.mjs'
import {CARD_DSL_PROMPT,CARD_PLAN_PROMPT} from '../server/cardspec/prompt.mjs'
import {COMPACT_CARD_PROMPT} from '../server/cardspec/compact-prompt.mjs'
import {counter} from '../shared/cardspec/fixtures.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
const compile = attrs => compileCard(counter.replace('<card ',`<card ${attrs} `),{final:true})
test('recipes are optional, literal and independent of all five existing materials',()=>{
 assert.equal(compile('').spec.design,undefined)
 for(const design of Object.keys(DESIGNS)){
  assert.equal(compile(`design="${design}"`).complete,true)
  for(const visual of VISUAL_STYLE_IDS){
   const result=compile(`design="${design}" visualStyle="${visual}" backgroundQuery="quiet lake"`)
   assert.equal(result.complete,true,JSON.stringify(result.diagnostics))
   assert.equal(result.spec.design,design);assert.equal(result.spec.visualStyle,visual)
  }
 }
 assert.equal(compile('design={"friendly"}').complete,true) // A constant expression is still a literal AST.
 for(const value of ['"unknown"','{state.count}','""'])assert.equal(compile(`design=${value}`).complete,false,value)
})
test('planning, history and both generation prompts share the recipe contract',()=>{
 for(const id of Object.keys(DESIGNS)){
  validatePlanVisualStyle({design:id})
  const source=counter.replace('<card ',`<card design="${id}" `)
  assert.equal(planningConversation([{role:'assistant',content:source}],{})[0].summary.design,id)
  if(TEMPLATE_IDS.includes(id))for(const prompt of [CARD_DSL_PROMPT,CARD_PLAN_PROMPT,COMPACT_CARD_PROMPT])assert.ok(prompt.includes(`${id}=`))
 }
 assert.throws(()=>validatePlanVisualStyle({design:'invented'}))
 assert.ok(designReference().length<450,'one short shared disclosure, no full DESIGN.md in prompt')
})
test('styling does not change the state transaction or restored spec',()=>{
 const a=compile('').spec,b=JSON.parse(JSON.stringify(compile('design="cinematic"').spec))
 const left=createStore(),right=createStore()
 for(const id of Object.keys(a.actions)){
  executeAction(a,left,id,{event:{value:'note'},args:{}})
  executeAction(b,right,id,{event:{value:'note'},args:{}})
 }
 assert.deepEqual(makeScope(a,left).state,makeScope(b,right).state)
})
