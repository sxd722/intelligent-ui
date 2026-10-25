import test from 'node:test'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {TEMPLATE_FIXTURES} from '../shared/cardspec/template-fixtures.mjs'
import {designReference} from '../shared/cardspec/designs.mjs'
import {requestedDesign,projectComposition} from '../shared/cardspec/compositions.mjs'
import {generationSettings} from '../shared/cardspec/generation-settings.mjs'
for(const [design,key] of [['parchment','templateParchment'],['business','templateBusiness'],['academy','templateAcademy']])test(design+' shared contract, host preference and native composition',()=>{
 const r=compileCard(TEMPLATE_FIXTURES[key],{final:true});assert.equal(r.complete,true,JSON.stringify(r.diagnostics));assert.equal(projectComposition(r.spec.children,design).family,design)
 assert.equal(generationSettings({designPreference:design}).designPreference,design)
 assert.equal(compileCard('<card><title>新任务</title><text>正文</text></card>',{final:true,context:{designPreference:design}}).spec.design,design)
 assert.ok(designReference().includes(design))
})
test('style intent routes correctly and comparison cannot silently clip values',()=>{
 assert.equal(requestedDesign('采用辉石学院风格'),'academy');assert.equal(requestedDesign('用商务风格做报表'),'business')
 const card=v=>`<card><title>比较</title><chart label="真实数据" kind="comparison" scaleMax={2} data={[{id:"a",label:"A",value:${v}}]}/></card>`
 assert.equal(compileCard(card(-1),{final:true}).complete,true);assert.equal(compileCard(card(4),{final:true}).complete,false)
})
