import test from 'node:test'
import assert from 'node:assert/strict'
import {enrichDataset,plannedDataNeeds,resolveBuildDataNeeds} from '../server/cardspec/data-enrichment.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {TOOLS} from '../shared/cardspec/tools.mjs'
import {buildUnits,nextBuildUnit,assertUnitRetention} from '../server/cardspec/build-units.mjs'
import {createGenerationBudget,generationPolicy} from '../server/cardspec/budget.mjs'
import {buildDeepCard} from '../server/cardspec/deep-build.mjs'
import {createDebugSession} from '../server/cardspec/debug-session.mjs'
import {createBuildWorkspace} from '../server/cardspec/build-workspace.mjs'
import {createResearchSession} from '../server/research/session.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {buildDataflowDiagnostics} from '../server/cardspec/build-dataflow.mjs'
const value=items=>({items,source:'test fixture',fetchedAt:'2026-10-29',truncated:false})
test('field needs enrich arbitrary entities, preserve identity and existing values, stop at bounded prefix',async()=>{
 const record={value:value([{sku:'A',title:'Keep',price:0},{sku:'B'},{sku:'C'}])},calls=[]
 const result=await enrichDataset(record,{fields:['weight'],limit:2},{link:{tool:'product.detail',key:'sku',parameter:'product',resultKey:'sku'},read:async(tool,input)=>{calls.push(input);return value([{sku:input.product,title:'Overwrite',price:12,weight:3}])}})
 assert.equal(result.value.items[0].title,'Keep');assert.equal(result.value.items[0].price,0)
 assert.equal(result.report.after.weight.known,2);assert.equal(result.report.complete,false)
 assert.equal(result.report.outcomes.at(-1).status,'deferred');assert.deepEqual(calls,[{product:'A'},{product:'B'}])
 assert.equal(record.value.items[0].weight,undefined)
})
test('module-local needs are coalesced with plan needs and observed fields need no extra read',()=>{
 const needs=plannedDataNeeds({dataNeeds:[{dataset:'D1',fields:['title','weight'],limit:2}],modules:[{dataNeeds:[{dataset:'D1',fields:['weight','dimensions'],limit:3}]}]},[{id:'D1',value:value([{id:1,title:'A'}])}])
 assert.deepEqual(needs,[{dataset:'D1',fields:['weight','dimensions'],limit:3}])
})

test('tool aliases resolve to a verified collection; required IDs are never fabricated',async()=>{
 const records=[],calls=[],tools={list:{readOnly:true,inputSchema:{required:[],properties:{limit:{maximum:10}}},detail:{tool:'detail'}},detail:{readOnly:true,inputSchema:{required:['id']}},photo:{readOnly:true,inputSchema:{required:['id']}}}
 const result=await resolveBuildDataNeeds({dataNeeds:[{dataset:'list',fields:['title']},{dataset:'detail',fields:['weight']},{dataset:'photo',fields:['url']}]},{records:()=>records,tools,validateInput:()=>{},execute:async(name,input)=>{calls.push({name,input});records.push({id:'D1',tool:'list',value:value([{id:'real',title:'product'}])})}})
 assert.deepEqual(calls,[{name:'cli_read',input:{id:'list',input:{limit:3}}}])
 assert.deepEqual(result.needs,[{dataset:'D1',fields:['weight'],limit:3}]);assert.equal(result.diagnostics[0].dataset,'photo')
})

test('ambiguous source aliases do not choose an arbitrary user dataset',async()=>{
 const result=await resolveBuildDataNeeds({dataNeeds:[{dataset:'list',fields:['weight']}]},{records:()=>[{id:'D1',tool:'list'},{id:'D2',tool:'list'}],tools:{list:{readOnly:true}},execute:()=>assert.fail('no read'),validateInput:()=>{}})
 assert.deepEqual(result.needs,[]);assert.match(result.diagnostics[0].error,/ambiguous/)
})
test('wrong identity, absent IDs, partial errors and empty fields cannot become invented details',async()=>{
 const r=await enrichDataset({value:value([{id:1},{id:2},{title:'no ID'}])},{fields:['duration']},{link:{tool:'detail'},read:async(_,input)=>value([{id:input.id===1?99:2,duration:null}])})
 assert.equal(r.report.after.duration.known,0);assert.equal(r.report.outcomes[0].status,'failed');assert.equal(r.report.outcomes[2].status,'unavailable')
})
test('cancelled enrichment does not partially overwrite the source',async()=>{
 const c=new AbortController(),r={value:value([{id:1},{id:2}])}
 await assert.rejects(enrichDataset(r,{fields:['score']},{link:{tool:'detail'},signal:c.signal,read:async(_,input)=>{if(input.id===2)c.abort();return value([{id:input.id,score:5}])}}))
 assert.equal(r.value.items[0].score,undefined)
})
test('registered enrichment shares real read budget, caches details and updates full host dataset',async()=>{
 const ids=['opencli.douban.movie-hot','opencli.douban.subject'],calls=[]
 const budget=createGenerationBudget({...generationPolicy('x',{buildMode:'deep'}),reads:3})
 const tools=createGenerationTools({budget,catalog:ids.map(id=>({...TOOLS[id],available:true})),invoke:async p=>{calls.push(p);return {value:p.tool===ids[0]?value([{id:'1',title:'A'},{id:'2',title:'B'}]):value([{id:p.input.id,duration:p.input.id==='1'?90:170,genres:['测试']}])}}})
 await tools.execute('cli_read',{id:ids[0],input:{limit:2}})
 const enriched=await tools.execute('dataset_enrich',{dataset:'D1',fields:['duration','genres']})
 assert.equal(enriched.enrichmentReport.complete,true);assert.equal(budget.snapshot().reads,3)
 assert.deepEqual(tools.datasets().D1.items.map(r=>r.duration),[90,170])
 await tools.execute('dataset_enrich',{dataset:'D1',fields:['duration']});assert.equal(calls.length,3)
 const same=await tools.execute('cli_read',{id:ids[0],input:{limit:2}});assert.equal(same.items[1].duration,170)
})
test('long successful tool output is compacted, never reclassified as a failed read',async()=>{
 let reads=0
 const research=createResearchSession({maxContextChars:600,extensions:{tools:()=>[{function:{name:'dataset_enrich'}}],snapshot:()=>({reads}),execute:async()=>{reads+=2;return {dataset:'D1',path:'context.datasets.D1',totalObserved:2,items:[{text:'x'.repeat(3000)}]}}}})
 const result=await research.execute('dataset_enrich',{dataset:'D1',fields:['text']})
 assert.equal(result.status,'succeeded');assert.equal(result.path,'context.datasets.D1');assert.equal(result.summaryOnly,true)
 assert.equal(research.snapshot().calls,2);assert.ok(JSON.stringify(result).length<600)
})
test('units schedule separate commits without replacing requirement coverage',()=>{
 const units=buildUnits({requirements:[{id:'R1'}],modules:[{name:'main.cardspec',units:[{goal:'state',requirements:['R1']},{goal:'actions',requirements:['R1']}]},{name:'view.cardspec',units:[{goal:'controls'},{goal:'results'}]}]})
 const committed=new Set([units[0].id]);assert.equal(nextBuildUnit(units,committed).goal,'actions')
 committed.add(units[1].id);assert.equal(nextBuildUnit(units,committed).goal,'controls')
 assert.throws(()=>buildUnits({requirements:[],modules:[{name:'main.cardspec',units:[{goal:'x',requirements:['invented']}]}]}),/unknown/)
 assert.throws(()=>assertUnitRetention('<state id="chosen"/><include module="view.cardspec"/>','<text>new</text>'),/remove previously/)
 assertUnitRetention('<state id="chosen"/>','<state id="chosen"/><button>New</button>')
})
test('retrying the same loading state is not a data producer; real completion branches are permitted',()=>{
 const before='<card><state id="status" type="string" initial="loading"/><button onPress="retry">重试</button><if test={state.status==="ready"}><text>结果</text></if><action id="retry"><set target="status" value="loading"/></action>'
 assert.ok(buildDataflowDiagnostics(before+'</card>').some(d=>d.code==='build_guard_unreachable'))
 assert.ok(!buildDataflowDiagnostics(before+'<action id="loaded"><set target="status" value="ready"/></action></card>').some(d=>d.code==='build_guard_unreachable'))
})
test('enriched evidence cannot silently become a copied sample instead of a shared data source',()=>{
 const context={datasets:{D1:value([{id:'1',duration:90}])}},records=[{id:'D1',tool:'opencli.douban.movie-hot',enrichment:{fields:['duration']}}]
 assert.ok(buildDataflowDiagnostics('<card><text>sample 90</text></card>',{context,records}).some(d=>d.code==='build_enrichment_unused'))
 assert.ok(!buildDataflowDiagnostics('<card><each items={context.datasets.D1.items} as="r"><text>{r.duration}</text></each></card>',{context,records}).some(d=>d.code==='build_enrichment_unused'))
})
test('a locally invalid expression is rejected before more units depend on it',()=>{
 const w=createBuildWorkspace()
 assert.throws(()=>w.write([{name:'main.cardspec',content:'<card><derive id="x" value={context.items.filter(x=>{return true})}/><text>Results</text></card>'}],{checkSyntax:true}),/pure expression/)
 assert.equal(w.manifest().length,0)
 w.write([{name:'view.cardspec',content:'<text>{derived.later}</text>'}],{checkSyntax:true})
 assert.equal(w.manifest().length,1,'unresolved cross-unit references wait for linking')
 w.write([{name:'main.cardspec',content:'<card><include ref="view.cardspec"/></card>'}],{checkSyntax:true})
 assert.match(w.assemble().source,/derived.later/)
 assert.throws(()=>w.write([{name:'bad.cardspec',content:'<include ref="stage.jsx"/>'}],{checkSyntax:true}),/JSX needs/)
 w.write([{name:'wrapped.cardspec',content:'<fragment><text>Transparent wrapper</text></fragment>'}],{checkSyntax:true})
 w.write([{name:'actions.cardspec',content:'<button onPress="go">Go</button><action id="go"/>'}],{checkSyntax:true})
 assert.equal(w.manifest().some(f=>f.name==='bad.cardspec'),false)
})
test('one extra brace after a closed literal is tolerated without modifying expression or string contents',()=>{
 const source='<card><state id="v" type="string" initial="x"}/><text>ok</text><button onPress="set">Set</button><action id="set"><set target="v" value="y"}/></action></card>'
 const compiled=compileCard(source,{final:true})
 assert.equal(compiled.complete,true);assert.equal(compiled.spec.actions.set[0].value.value,'y')
 assert.equal(compiled.diagnostics.filter(d=>d.code==='literal_brace_ignored').length,2)
 assert.equal(compileCard('<card><text value="x"}}/></card>',{final:true}).complete,false)
 assert.equal(compileCard('<card><text>{1+}</text></card>',{final:true}).complete,false)
 assert.equal(compileCard('<card><text>literal }</text></card>',{final:true}).spec.children[0].children[0].value.value,'literal }')
})
test('multi-unit module commits valid partial source and patches only the next unit before testing',async()=>{
 const goal='点击增加计数',context={buildMode:'deep',expressionDialect:'js-v1',renderMode:'native'},bodies=[]
 const step={op:'click',name:'增加',requirement:'R1',expect:{state:{n:1},changed:true}}
 const debug=createDebugSession({context:()=>context,runner:async()=>({status:'tested',runs:[{scenario:'normal',initial:{errors:[]},final:{errors:[],controls:[],coverage:[]},actions:[{step,ok:true,changed:true,assertion:{passed:true}}],pageErrors:[]}]})})
 let n=0
 const r=await buildDeepCard({input:{prompt:goal},context,debug,cardId:'test-small-unit-commit',streamUpstream:async(messages,options)=>{
  const body=JSON.parse(messages[1].content);bodies.push(body)
  const response=n++===0?{requirements:[{id:'R1',kind:'interaction',acceptance:goal}],modules:[{name:'main.cardspec',units:[{goal:'state and output',requirements:['R1']},{goal:'button and action',requirements:['R1']}]}],interfaces:'state.n'}:n===2?'<card><state id="n" type="number" initial={0}/><text>{state.n}</text></card>':n===3?body.file.content.replace('</card>','<button onPress="inc">增加</button><action id="inc"><increment target="n"/></action></card>'):{op:'test',steps:[step]}
  options.onPiece({content:typeof response==='string'?response:JSON.stringify(response)})
 }})
 assert.equal(bodies[1].unit.goal,'state and output');assert.equal(bodies[2].unit.goal,'button and action')
 assert.match(bodies[2].file.content,/<text>/);assert.equal(r.coverage.status,'checked');assert.match(r.source,/<text>/)
})
test('rejected unit draft is returned to the next attempt instead of regenerating blind',async()=>{
 const context={buildMode:'deep',expressionDialect:'js-v1',renderMode:'native'},seen=[]
 const bad='<card><state id="n" type="number" initial={0}/><text>{state.n+}</text></card>'
 const debug=createDebugSession({context:()=>context,runner:async()=>({status:'tested',runs:[{scenario:'normal',initial:{errors:[]},final:{errors:[],controls:[],coverage:[]},actions:[],pageErrors:[]}]})})
 await assert.rejects(buildDeepCard({input:{prompt:'显示计数'},context,debug,cardId:'test-rejected-draft',streamUpstream:async(messages,options)=>{
  const body=JSON.parse(messages[1].content);seen.push(body)
  if(seen.length===1)return JSON.stringify({requirements:[{id:'R1',kind:'content',acceptance:'显示计数'}],modules:[{name:'main.cardspec',units:[{goal:'counter'}]}],interfaces:'n'})
  if(seen.length===2)return bad
  assert.equal(body.file.content,bad);assert.equal(body.file.uncommitted,true);assert.match(body.feedback.error,/Module unchanged/)
  throw Object.assign(Error('verified'),{code:'GENERATION_BUDGET'})
 }}),/verified/)
 assert.equal(seen.length,3)
})
