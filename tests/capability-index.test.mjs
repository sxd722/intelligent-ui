import test from 'node:test'
import assert from 'node:assert/strict'
import {COMPONENT_ROUTES,componentIndex,findCapabilities} from '../shared/cardspec/capability-index.mjs'
import {REGISTRY} from '../shared/cardspec/registry.mjs'
import {TOOLS} from '../shared/cardspec/tools.mjs'
import {toolDiscoveryReference} from '../shared/cardspec/tool-discovery.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
import {isolateCollectionRows} from '../shared/cardspec/collection-rows.mjs'
const catalog=Object.values(TOOLS).map(t=>({...t,available:!t.unsupportedReason&&t.site!=='spotify',reason:'需要授权'}))
test('quick index covers registry and compresses tool map without losing commands',()=>{
 assert.deepEqual(new Set(COMPONENT_ROUTES.flatMap(r=>r[2])),new Set(Object.keys(REGISTRY)))
 assert.ok(componentIndex().length<1600)
 const compact=toolDiscoveryReference(catalog,'天气',{compact:true}),old=toolDiscoveryReference(catalog,'天气')
 assert.ok(compact.length<old.length*.65,`${compact.length}/${old.length}`)
 for(const t of catalog.filter(t=>!t.unsupportedReason))assert.ok(compact.includes(t.command||t.id.split('.').at(-1)),t.id)
 assert.match(compact,/off:search,status,play/)
})
test('task retrieval points to precise live contracts, native mode does not recommend sandbox',()=>{
 for(const [q,component,tool] of [['播客片单','experience','opencli.apple-podcasts.search'],['矩阵激活','heatmap',null],['关系流程','mindmap',null],['图片海报','image',null],['图表','chart',null],['日历','calendar',null]]){
  const result=findCapabilities(q,{catalog});assert.ok(result.components.some(c=>c.name===component),q)
  if(tool)assert.ok(result.tools.some(t=>t.id===tool),JSON.stringify(result.tools))
 }
 assert.ok(!findCapabilities('sandbox',{catalog}).components.some(c=>c.name==='sandbox'))
 assert.equal(findCapabilities('sandbox',{catalog,renderMode:'hybrid'}).components[0].name,'sandbox')
 assert.equal(findCapabilities('opencli.spotify.play',{catalog}).tools[0].available,false)
 assert.throws(()=>findCapabilities(' '.repeat(5)),/query/)
})
test('capability lookup has zero effects and respects disabled tools',async()=>{
 let calls=0;const budget={policy:{profile:'adaptive-v1'}}
 const service=createGenerationTools({catalog,budget,invoke:()=>calls++})
 assert.ok(service.tools().some(t=>t.function.name==='capability_find'))
 const r=await service.execute('capability_find',{query:'播客片单'});assert.ok(r.tools.length)
 assert.equal(calls,0);assert.equal(service.snapshot().reads,0)
 const ordinary=createGenerationTools({catalog,invoke:()=>calls++})
 assert.ok(ordinary.tools().some(t=>t.function.name==='capability_find'))
 assert.match((await ordinary.execute('component_describe',{names:['chart']})).contract,/<chart>/)
 const disabled=createGenerationTools({catalog,budget,enabled:false})
 assert.equal((await disabled.execute('capability_find',{query:'播客片单'})).tools.length,0)
})
test('presentation recovery keeps action semantics and never erases unsupported logic',()=>{
 const r=compileCard('<card><state id="n" type="number" initial={0}/><text className="large"><bold>数量</bold><italic>{state.n}</italic></text><button class="primary" onPress="inc">增加</button><action id="inc"><increment target="n" value={1}/></action></card>',{final:true})
 assert.equal(r.complete,true,JSON.stringify(r.diagnostics));assert.equal(r.diagnostics.filter(d=>d.severity==='warning').length,4)
 assert.equal(r.spec.children[0].children[0].type,'strong');assert.equal(r.spec.children[0].props.className,undefined)
 const store=createStore();makeScope(r.spec,store);executeAction(r.spec,store,'inc');assert.equal(store.values.n,1)
 for(const source of ['<card><text className={state.missing}>x</text></card>','<card><text style="display:none">x</text></card>','<card><button onPress="missing">x</button></card>','<card><stat value={state.missing}/></card>'])assert.equal(compileCard(source,{final:true}).complete,false,source)
})
test('invalid live rows are inert; all duplicates are isolated and healthy keys recover unchanged',()=>{
 const source=[{id:'a'},{id:'x'},{id:'x'},{id:null},{id:'z'}]
 const r=isolateCollectionRows(source,item=>item.id)
 assert.deepEqual(r.filter(x=>!x.error).map(x=>x.key),['a','z'])
 assert.equal(r.filter(x=>x.error).length,3);assert.deepEqual(source.map(x=>x.id),['a','x','x',null,'z'])
 assert.equal(isolateCollectionRows([{id:0}],x=>x.id)[0].key,'0')
 assert.ok(isolateCollectionRows([{id:{}}],x=>x.id)[0].error)
 assert.ok(isolateCollectionRows([null],x=>x.id)[0].error)
 assert.deepEqual(isolateCollectionRows([{id:'a'},{id:'b'}],x=>x.id).map(x=>x.key),['a','b'])
})
