import test from 'node:test'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {makeScope,createStore,executeAction} from '../shared/cardspec/store.mjs'
import {evaluate} from '../shared/cardspec/expression.mjs'
import {plannerPresentation,plannerSelectedIds} from '../shared/cardspec/planner-presentation.mjs'
import {COMPACT_PLANNER,compactPlannerTransport} from '../shared/cardspec/compact-planner-fixture.mjs'
import {createCardSession} from '../src/cardspec/tool-session.mjs'
import {generationLayout,generationViewport} from '../shared/cardspec/generation-layout.mjs'
import {collectionPage} from '../shared/cardspec/collection.mjs'
import {isSupportingContent} from '../shared/cardspec/supporting-content.mjs'
const compiled=()=>{const r=compileCard(COMPACT_PLANNER,{final:true,cardId:'planner-qa'});assert.deepEqual(r.diagnostics.filter(d=>d.severity==='error'),[]);return r.spec}
test('existing selectable map presentation preserves action and data semantics',()=>{
 const spec=compiled(),before=JSON.stringify(spec),p=plannerPresentation(spec.children,spec.bindings),store=createStore()
 assert.deepEqual(p.settings.map(n=>n.type),['row']);assert.equal(p.collections.length,1)
 for(const id of ['p2','p4'])executeAction(spec,store,'choose',{...makeScope(spec,store),args:{id}})
 assert.deepEqual(plannerSelectedIds(p.collections,makeScope(spec,store),evaluate),['p2','p4'])
 assert.equal(JSON.stringify(spec),before)
 executeAction(spec,store,'choose',{...makeScope(spec,store),args:{id:'p2'}})
 assert.deepEqual(plannerSelectedIds(p.collections,makeScope(spec,store),evaluate),['p4'])
 assert.equal(plannerPresentation(spec.children,{}).collections.length,0)
})
test('settings and native choice contract compile without tools',()=>{
 const r=compileCard('<card><title>偏好</title><state id="n" type="number" initial={2}/><settings><slider label="人数" value={state.n} onChange="change"/></settings><choice-grid><choice-item label="公园" onPress="pick" selected={true}><image query="park" mediaRole="thumbnail"/><text>免费</text></choice-item></choice-grid><action id="change"><set target="n" value={event.value}/></action><action id="pick"><increment target="n" value={1}/></action></card>',{final:true})
 assert.deepEqual(r.diagnostics.filter(d=>d.severity==='error'),[])
})

test('image pressable grids use the same choice presentation without changing actions or scope',()=>{
 const spec=compiled(),each={type:'each',id:'tiles',props:{items:{type:'literal',value:[]}},children:[{type:'grid-item',id:'tile',children:[{type:'pressable',id:'pick',props:{label:{type:'literal',value:'候选'},selected:{type:'literal',value:true},onPress:{type:'literal',value:'choose'},args:{type:'literal',value:{id:'p2'}}},children:[{type:'image',id:'photo',props:{alt:{type:'literal',value:'图片'}}},{type:'strong',id:'name',children:[]},{type:'if',id:'check',children:[{type:'icon',id:'mark',props:{name:{type:'literal',value:'check'}}}]}]}]}]}
 const nodes=[{type:'map',id:'map'}, {type:'grid',id:'grid',children:[each]}],before=JSON.stringify(nodes)
 const adapted=plannerPresentation(nodes,spec.bindings)
 const grid=adapted.nodes[1],tile=grid.children[0].children[0]
 assert.equal(grid.type,'choice-grid');assert.equal(tile.type,'choice-item')
 assert.equal(tile.props.onPress.value,'choose');assert.deepEqual(tile.props.args.value,{id:'p2'})
 assert.equal(Object.hasOwn(tile.props,'variant'),false)
 assert.deepEqual(tile.children.map(n=>n.type),['image','strong']);assert.equal(JSON.stringify(nodes),before)
 // Arbitrary clickable layouts do not become planners without a generation binding.
 assert.equal(plannerPresentation(nodes,{}).nodes[1].type,'grid')
})
test('long page has no content pagination and keeps generation budget',()=>{
 assert.equal(generationViewport({cardSize:'full'}).height,null)
 assert.equal(generationLayout('full').maxTokens,generationLayout('square').maxTokens)
 assert.match(generationLayout('full').instruction,/高度不限/)
 assert.deepEqual(collectionPage(20,{pageStart:12},'full'),{pageSize:20,count:1,page:0,start:0,end:20})
})
test('supporting disclosure recognizes explicit details but never hides controls',()=>{
 const r=compileCard('<card><title>说明</title><region role="details" label="依据"><text>估算方法</text></region><region label="参考来源"><caption>来源说明</caption><link url="https://example.com" label="原文"/></region><region label="来源筛选"><button onPress="pick">切换</button></region><state id="n" type="number" initial={0}/><action id="pick"><increment target="n" value={1}/></action></card>',{final:true})
 assert.deepEqual(r.diagnostics.filter(d=>d.severity==='error'),[])
 assert.deepEqual(r.spec.children.filter(n=>n.type==='region').map(isSupportingContent),[true,true,false])
})
test('planning receives latest preferences and selection; history preserves them',async()=>{
 const calls=[],session=createCardSession(compiled(),{transport:async payload=>{calls.push(payload);return compactPlannerTransport(payload)}})
 session.setActivity({complete:true,enabled:true})
 try{
  session.fire('budget',{event:{value:500}});session.fire('choose',{args:{id:'p2'}})
  await session.invoke({binding:'plan',target:'page'},{cause:'user'})
  assert.equal(calls.length,1);assert.deepEqual(calls[0].input.context,{budget:500,ids:['p2']})
  session.navigate(-1);assert.equal(session.current().store.values.budget,500);assert.deepEqual(session.current().store.values.chosen,['p2'])
 }finally{session.dispose()}
})
