import test from 'node:test'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
import {checklistChange,checklistProgress,validateEditorial,editorialConnections,editorialPages} from '../shared/cardspec/editorial.mjs'
import {normalizeDesignBrief,designBriefTokens} from '../shared/cardspec/design-brief.mjs'
import {componentSelection,componentSelectionReference} from '../shared/cardspec/component-selection.mjs'
import {taskOutputSnapshot} from '../shared/cardspec/task-behavior.mjs'
import {activeBindings} from '../shared/cardspec/binding-schedule.mjs'

export const editorialSource=`<card schemaVersion="1" design="business">
<state id="mode" type="string" initial="a"/><state id="done" type="array" initial={[]}/>
<title>出发准备</title>
<segmented id="modePicker" label="路线选择" variant="cards" value={state.mode} options={[{value:'a',label:'轻装',description:'步行探索'},{value:'b',label:'远行',description:'增加过夜准备'}]} onChange="mode"/>
<facts id="summary" items={[{label:'路线',value:state.mode=='a'?'步行':'过夜'},{label:'准备',value:state.done.length,unit:'项'},{label:'报价',value:null}]}/>
<checklist id="packing" label="准备清单" items={[{id:'water',label:'饮水',group:'随身'},{id:'coat',label:'外套',group:'随身',description:'用于降温时'}]} value={state.done} onChange="pack"/>
<region id="extra" overflow="inline" label="查看路线依据"><text>根据停留时间选择行李。预计的降温要单独确认。</text></region>
<action id="mode"><set target="mode" value={event.value}/></action>
<action id="pack"><set target="done" value={event.value}/></action></card>`

test('native editorial contract compiles and produces observable state-linked results',()=>{
 const c=compileCard(editorialSource,{final:true,context:{expressionDialect:'js-v1'}})
 assert.equal(c.complete,true,JSON.stringify(c.diagnostics));assert.ok(!c.diagnostics.some(x=>x.severity==='error'),JSON.stringify(c.diagnostics))
 const s=createStore(),before=taskOutputSnapshot(c.spec,makeScope(c.spec,s))
 executeAction(c.spec,s,'pack',{event:{value:['water'],id:'water',checked:true}})
 executeAction(c.spec,s,'mode',{event:{value:'b'}})
 const after=taskOutputSnapshot(c.spec,makeScope(c.spec,s))
 assert.notDeepEqual(before.summary,after.summary);assert.deepEqual(s.values.done,['water']);assert.equal(s.values.mode,'b')
})
test('checklist preserves hidden selections and counts only visible records',()=>{
 const items=[{id:'a',label:'A'}]
 assert.deepEqual(checklistChange(items,['hidden'],'a',true),['hidden','a'])
 assert.deepEqual(checklistChange(items,['hidden','a'],'a',false),['hidden'])
 assert.deepEqual(checklistChange(items,['hidden'],'unknown',true),['hidden'])
 assert.deepEqual(checklistProgress(items,['hidden','a']),{done:1,total:1})
})
test('renderer contracts reject objects as scalar facts and ambiguous checklist IDs',()=>{
 assert.throws(()=>validateEditorial('facts',{items:[{label:'A',value:{raw:'x'}}]}))
 assert.throws(()=>validateEditorial('checklist',{items:[{id:'x',label:'A'},{id:'x',label:'B'}]}))
 assert.doesNotThrow(()=>validateEditorial('facts',{items:[{label:'Missing',value:null}]}))
})
test('bounded component hints expose native recipes without another model call',()=>{
 const s=componentSelection('比较旅行方案，分阶段准备行李清单',{renderMode:'native'})
 assert.equal(s.extraModelCalls,0);for(const name of ['facts','checklist','segmented','region'])assert.ok(s.names.includes(name))
 assert.ok(!s.names.includes('sandbox'));assert.match(componentSelectionReference(s),/event.value/)
})
test('pagination keeps an explicitly linked selector and its result together without flattening',()=>{
 const {spec}=compileCard(editorialSource,{final:true,context:{expressionDialect:'js-v1'}})
 assert.ok(editorialConnections(spec,spec.children).has('modePicker'))
 const items=[{id:'picture',height:180},{id:'selector',height:60,keepNext:true},{id:'result',height:80},{id:'other',height:70}]
 assert.deepEqual(editorialPages(items,280,8),[['picture'],['selector','result','other']])
 assert.deepEqual(editorialPages([{id:'control',height:100,keepNext:true},{id:'large-result',height:500}],280),[['control','large-result']],'oversize pair remains scrollable, not clipped or silently dropped')
})
test('detail-stage changes are observable content, not a missing output snapshot',()=>{
 const {spec}=compileCard('<card><state id="s" type="string" initial="A"/><detail-stage id="result" title={state.s} description={state.s}/><action id="change"><set target="s" value="B"/></action></card>',{final:true})
 const store=createStore(),before=taskOutputSnapshot(spec,makeScope(spec,store));executeAction(spec,store,'change');const after=taskOutputSnapshot(spec,makeScope(spec,store))
 assert.ok(before.result);assert.notDeepEqual(before.result,after.result)
})
test('visual brief discards HTML, content claims and arbitrary CSS',()=>{
 const b=normalizeDesignBrief({version:1,palette:{base:'#112233',ink:'#112233',accent:'url(https://invalid)',panel:'#ffffff'},regions:['facts','javascript:evil','facts'],html:'<script/>',title:'fake price',typography:'url(evil)'})
 assert.deepEqual(b.regions,['facts']);assert.ok(!JSON.stringify(b).includes('fake price'));assert.notEqual(b.palette.ink,b.palette.base)
 assert.equal(b.palette.panel,b.palette.base);assert.equal(b.typography,'sans')
 assert.equal(normalizeDesignBrief({version:1,palette:{base:'url(evil)'}}),null)
 assert.ok(!JSON.stringify(designBriefTokens(b)).includes('url('))
})

test('inline disclosure does not load hidden tool consumers before opening',()=>{
 const {spec}=compileCard('<card><binding id="news" tool="hackernews.top" params={{}}/><region id="extra" overflow="inline" label="News"><text>{bindings.news.status}</text></region></card>',{final:true})
 const scope=makeScope(spec,createStore())
 assert.equal(activeBindings(spec,scope).has('news'),false)
 assert.equal(activeBindings(spec,scope,{extra:true}).has('news'),true)
 assert.equal(activeBindings(spec,scope,{extra:false}).has('news'),false)
})
