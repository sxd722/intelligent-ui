import test from 'node:test'
import assert from 'node:assert/strict'
import {generateCard} from '../server/cardspec/generation.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {cardGenerationPrompt} from '../server/cardspec/prompt.mjs'
import {generationSettings,generationModelOptions} from '../shared/cardspec/generation-settings.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import {toolReference} from '../shared/cardspec/tools.mjs'
import {registryReference} from '../shared/cardspec/registry.mjs'
import {createDatasetAnalyzer} from '../server/cardspec/model-analysis.mjs'
import {collectionBindings,collectionRowBindings} from '../shared/cardspec/tool-collection-state.mjs'
import {parseExpression,evaluate} from '../shared/cardspec/expression.mjs'
import {checkValue} from '../shared/cardspec/registry.mjs'

test('explicit action arguments accept finite JSON without requiring object wrappers',()=>{
 for(const value of [0,false,'',null,[1,'a'],{id:'a'}]){
  const source=`<card><state id="saved" type="record" initial={{}}/><button onPress="save" args={${JSON.stringify(value)}}>Save</button><action id="save"><set target="saved" value={{value:args}}/></action></card>`
  for(const expressionDialect of ['legacy','js-v1']){
   const r=compileCard(source,{final:true,context:{expressionDialect}});assert.equal(r.complete,true,JSON.stringify(r.diagnostics))
   const store=createStore();makeScope(r.spec,store);executeAction(r.spec,store,'save',{args:value});assert.deepEqual(store.values.saved,{value})
  }
 }
 for(const value of [undefined,NaN,Infinity,()=>1,new Date(),[undefined]])assert.equal(checkValue('json',value),false)
})

test('JS intro/outro braces are inert prose; markup and card expressions stay checked',()=>{
 const context={expressionDialect:'js-v1'}
 const source='<intro>例子 {{i:0}}，未闭合 { 也只是文字</intro><card><text>{1+1}</text></card><outro>{fetch("https://example.com")} &lt;文字&gt;</outro>'
 const result=compileCard(source,{final:true,context})
 assert.equal(result.complete,true,JSON.stringify(result.diagnostics))
 assert.match(result.spec.intro,/\{\{i:0\}\}/);assert.equal(result.spec.outro,'{fetch("https://example.com")} <文字>')
 assert.equal(compileCard('<intro><button>非法</button></intro><card/>',{final:true,context}).complete,false)
 assert.equal(compileCard('<card><text>{fetch("x")}</text></card>',{final:true,context}).complete,false)
 assert.equal(compileCard('<intro>{1}</intro><card/>',{final:true}).spec.intro,'1')
 const partial=compileCard('<intro>说明 {',{context});assert.ok(partial.diagnostics.some(d=>d.code==='incomplete'));assert.ok(!partial.diagnostics.some(d=>d.code==='expression'))
})

test('saved tool rows warn when labels depend on editable source inputs',()=>{
 const make=(savedLabel)=>`<card><binding id="answer" tool="glm.generate" input={{prompt:"Plan",context:{chosen:state.chosen},schema:{type:"object"}}}/><state id="chosen" type="record" initial={{a:"Alpha"}}/><state id="saved" type="record" initial={{}}/><derive id="labels" value={state.chosen}/><each items={state.saved.rows??[]} as="row" itemKey={row.id}><text>{${savedLabel}}</text></each><action id="save"><set target="saved" value={bindings.answer.value??{}}/></action></card>`
 const bad=compileCard(make('derived.labels[row.id]??row.id'),{final:true,context:{expressionDialect:'js-v1'}})
 assert.equal(bad.complete,true,JSON.stringify(bad.diagnostics))
 assert.ok(bad.diagnostics.some(d=>d.code==='saved_tool_live_read'&&d.severity==='warning'))
 const good=compileCard(make('row.label'),{final:true,context:{expressionDialect:'js-v1'}})
 assert.equal(good.complete,true,JSON.stringify(good.diagnostics));assert.ok(!good.diagnostics.some(d=>d.code==='saved_tool_live_read'))
})

test('projected visual event identities are validated even before tool data arrives',()=>{
 const card=(projection,read)=>`<card><data id="rows" value={[]}/><state id="picks" type="array" initial={[]}/><derive id="points" value={data.rows.map(row=>(${projection}))}/><map items={derived.points} onSelect="selectPoint"/><action id="selectPoint"><remove target="picks" key={${read}}/><append target="picks" value={{id:${read}}}/></action></card>`
 const context={expressionDialect:'js-v1'}
 const bad=compileCard(card('{id:row.rowKey,name:row.name,latitude:row.lat,longitude:row.lon}','event.item.rowKey'),{final:true,context})
 assert.equal(bad.complete,false);assert.ok(bad.diagnostics.some(d=>d.code==='event_projection_identity'))
 for(const [projection,read]of [['{id:row.rowKey,name:row.name,latitude:row.lat,longitude:row.lon}','event.item.id'],['{...row,id:row.rowKey,latitude:row.lat,longitude:row.lon}','event.item.rowKey']]){
  const good=compileCard(card(projection,read),{final:true,context});assert.equal(good.complete,true,JSON.stringify(good.diagnostics))
 }
})

test('mapped tool facets retain data dependencies without becoming entity rows',()=>{
 const spec={data:{},derived:{},bindings:{r:{tool:'opencli.douban.movie-hot'}}}
 const parse=s=>parseExpression(s,{dialect:'js-v1'})
 for(const expression of ['bindings.r.value.items.map(row=>row.title)','bindings.r.value.items.map(row=>({id:row.id,label:row.title}))','bindings.r.value.items.map(row=>({...row,rowKey:"new"}))','bindings.r.value.items.map(row=>({...row,...other}))','flag ? bindings.r.value.items : ["label"]']){
  const ast=parse(expression);assert.deepEqual(collectionBindings(spec,ast),['r']);assert.deepEqual(collectionRowBindings(spec,ast),[],expression)
 }
 for(const expression of ['bindings.r.value.items.map(row=>row)','bindings.r.value.items.map(row=>({...row,label:row.title}))','bindings.r.value.items.map(row=>({rowKey:row.rowKey,title:row.title}))','bindings.r.value.items?.filter(row=>row.rating>8) ?? []'])assert.deepEqual(collectionRowBindings(spec,parse(expression)),['r'],expression)
 const source='<card><binding id="r" tool="opencli.douban.movie-hot" input={{limit:5}} initial={{items:[],source:"",fetchedAt:"",truncated:false}}/><derive id="titles" value={bindings.r.value.items.map(row=>row.title)}/><each items={derived.titles} as="title" itemKey={title}><text>{title}</text></each></card>'
 const result=compileCard(source,{final:true,context:{expressionDialect:'js-v1'}})
 assert.equal(result.complete,true,JSON.stringify(result.diagnostics));assert.ok(!result.diagnostics.some(d=>d.code==='tool_identity_normalized'))
 assert.equal(evaluate(result.spec.children[0].props.itemKey,{title:'电影'}),'电影')
})

test('JS tool disclosure uses JS predicates and numeric component types are explicit',async()=>{
 const ids=['opencli.douban.movie-hot','dataset.analyze','glm.generate']
 const js=toolReference(true,ids,{expressionDialect:'js-v1'})
 assert.match(js,/state\.picks\.some\(pick=>pick.rowKey===entry.rowKey\)/)
 assert.doesNotMatch(js,/count\(state.picks/)
 assert.match(toolReference(true,ids),/count\(state.picks/)
 assert.match(js,/dataset.analyze只能load="manual"/)
 const contract=registryReference({names:['text','grid']})
 assert.match(contract,/clamp:integer\(1–6\)/);assert.match(contract,/columns:integer\(1–12\)/)
 let system
 await generateCard({catalog:ids.map(id=>({id,available:true})),input:{prompt:'电影选择'},view:{expressionDialect:'js-v1',generationMode:'direct'},signal:AbortSignal.timeout(5000),streamUpstream:async(m,o)=>{system=m[0].content;o.onPiece({content:'<card><text>请选择电影</text></card>'})}})
 assert.doesNotMatch(system,/count\(state.picks/)
})

test('classification keeps the production low-reasoning profile and charges before calling',async()=>{
 const calls=[],events=[]
 const analyze=createDatasetAnalyzer(async(m,o)=>{calls.push({m,o});return {message:{content:'{"annotations":[]}'}}},{model:kind=>events.push(kind)})
 assert.deepEqual(await analyze({rows:[],instruction:'按原文分类'}),{annotations:[]})
 assert.deepEqual(events,['analyze']);assert.equal(calls[0].o.reasoningEffort,'low');assert.equal(calls[0].o.maxTokens,4096);assert.equal(calls[0].o.modelOverride,undefined)
 const blocked=createDatasetAnalyzer(()=>assert.fail('must not call a model'),{model:()=>{throw Error('reserved')}})
 await assert.rejects(()=>blocked({}),/reserved/)
})

test('JS generation replaces the old grammar, rather than appending contradictory advice',()=>{
 const js=cardGenerationPrompt(null,{compact:true,adaptive:true,expressionDialect:'js-v1'})
 const legacy=cardGenerationPrompt(null,{compact:true,adaptive:true})
 assert.match(js,/纯JavaScript/);assert.doesNotMatch(js,/不能调用JS方法或箭头函数|无展开语法|不能调用.includes/)
 assert.match(legacy,/不能调用JS方法或箭头函数/)
 assert.ok(js.length<legacy.length*1.15,`${js.length}/${legacy.length}`)
 assert.deepEqual(generationSettings({expressionDialect:'evil',modelProfile:'arbitrary'}),{expressionDialect:'legacy',modelProfile:'default'})
})
test('initial/slot generation keeps dialect and model settings, with one model call on valid output',async()=>{
 for(const target of ['page','slot:detail']){
  const calls=[],source='<card actionMode="snapshot"><state id="n" type="number" initial={0}/><stat label="n" value={Math.max(0,state.n)}/><button onPress="add">Add</button><action id="add"><set target="n" value={state.n+1}/></action></card>'
  const result=await generateCard({input:{prompt:'计数卡'},target,view:{expressionDialect:'js-v1',modelProfile:'deep',generationMode:'direct'},signal:AbortSignal.timeout(5000),streamUpstream:async(m,o)=>{calls.push({m,o});o.onPiece({content:source})}})
  assert.equal(calls.length,1);assert.equal(calls[0].o.modelOverride,'glm-5.3');assert.equal(calls[0].o.reasoningEffort,'high');assert.deepEqual(calls[0].o.thinking,{type:'enabled'})
  assert.equal(result.spec.context.expressionDialect,'js-v1');assert.equal(result.spec.context.modelProfile,'deep')
  const restored=JSON.parse(JSON.stringify(result.spec)),store=createStore();makeScope(restored,store);executeAction(restored,store,'add');assert.equal(store.values.n,1)
 }
})
test('gateway sends allowlisted deep-thinking settings and records returned model identity',async()=>{
 let body
 const client=createModelClient({base:'https://gateway',key:'test',model:'glm-5.3-flash',fetchImpl:async(url,request)=>{body=JSON.parse(request.body);return new Response('data: '+JSON.stringify({model:'glm-5.3',choices:[{delta:{content:'ok'},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n')}})
 const result=await client([],{...generationModelOptions('deep')})
 assert.equal(body.model,'glm-5.3');assert.equal(body.reasoning_effort,'high');assert.deepEqual(body.thinking,{type:'enabled'});assert.equal(result.model,'glm-5.3')
})
test('JS arrows preserve tool identity scope diagnostics even with empty data',()=>{
 const source='<card><binding id="search" tool="opencli.steam.search" input={{query:"a"}} initial={{items:[],source:"",fetchedAt:"",truncated:false}}/><binding id="detail" tool="opencli.steam.app" input={{id:"1"}} initial={{items:[],source:"",fetchedAt:"",truncated:false}}/><state id="pick" type="string" initial=""/><action id="pick"><set target="pick" value={String(args.key)}/></action><derive id="detail" value={bindings.detail.value.items.find(row=>row.rowKey===state.pick) ?? null}/><each items={bindings.search.value.items} itemKey={item.rowKey}><button onPress="pick" args={{key:item.rowKey}}>选择</button></each></card>'
 const result=compileCard(source,{final:true,context:{expressionDialect:'js-v1'}})
 assert.ok(result.diagnostics.some(d=>d.code==='tool_identity_scope'),JSON.stringify(result.diagnostics))
})

test('final JS generation harness detects isolated initialization failures without invoking host actions',async()=>{
 for(const body of ['return {n:NaN}','while(true){}','return {n:"wrong type"}']){
  const source='<card><logic id="sim" reactive={true} initial={{n:0}} source={'+JSON.stringify('function update(s,e){'+body+'}')+'}><slider label="n" value={local.n} min={0} max={10}/></logic></card>'
  const result=compileCard(source,{final:true,context:{expressionDialect:'js-v1'}})
  assert.equal(result.complete,true,'compilation itself must not execute JS')
  await validateRichContent(result);assert.equal(result.complete,false);assert.ok(result.diagnostics.some(d=>d.code==='rich_content'))
 }
})

test('final logic probes use real option payloads and validate a newly visible view without host effects',async()=>{
 const source=(options,body)=>`<card><state id="outside" type="number" initial={0}/><action id="host"><increment target="outside" value={1}/></action><logic id="sim" initial={{view:"start",index:0,rows:[1,2]}} actions={{pick:"host"}} source={${JSON.stringify('function update(s,e){'+body+';return s}')}}><segmented label="Choice" options={${options}} value={String(local.index)} onChange="pick"/><button onPress="detail">Detail</button><if test={local.view==="detail"}><stat value={local.rows[local.index].toFixed(1)}/></if></logic></card>`
 const compile=s=>compileCard(s,{final:true,context:{expressionDialect:'js-v1'}})
 const bad=compile(source('["T0","T1"]','if(e.type==="pick")s.index=Number(e.value);if(e.type==="detail")s.view="detail"'))
 assert.equal(bad.complete,true,JSON.stringify(bad.diagnostics));await validateRichContent(bad);assert.equal(bad.complete,false);assert.match(bad.diagnostics.at(-1).message,/event pick/)
 const outOfRange=compile(source('["0","5"]','if(e.type==="pick")s.index=Number(e.value);if(e.type==="detail")s.view="detail"'))
 await validateRichContent(outOfRange);assert.equal(outOfRange.complete,false);assert.match(outOfRange.diagnostics.at(-1).message,/event detail/)
 const good=compile(source('[{value:"0",label:"T0"},{value:"1",label:"T1"}]','if(e.type==="pick")s.index=Number(e.value);if(e.type==="detail")s.view="detail"'))
 await validateRichContent(good);assert.equal(good.complete,true,JSON.stringify(good.diagnostics));assert.ok(good.logicProbes[0].probes>0&&good.logicProbes[0].probes<=16)
 const store=createStore();makeScope(good.spec,store);assert.equal(store.values.outside,0)
})

test('bounded logic probes prioritize newly exposed controls over repeating first-branch controls',async()=>{
 const js='function update(s,e){if(e.type==="slider")s.n=e.value;if(e.type==="tab")s.tab=e.value;if(e.type==="row")s.n=Number(e.rowId.slice(1));return s}'
 const source=`<card><logic id="sim" initial={{n:0,tab:"start"}} source={${JSON.stringify(js)}}><slider label="Value" value={local.n} min={0} max={10} onChange="slider"/><segmented label="Tabs" value={local.tab} options={["start","a","b","c","end"]} onChange="tab"/><if test={local.tab==="end"}><table label="Results" columns={[{key:"name",label:"Name"}]} rows={[{id:"r1",name:"row"}]} onSelect="row"/></if></logic></card>`
 const result=compileCard(source,{final:true,context:{expressionDialect:'js-v1'}})
 assert.equal(result.complete,true,JSON.stringify(result.diagnostics));await validateRichContent(result)
 assert.equal(result.complete,false);assert.match(result.diagnostics.at(-1).message,/event row/)
})


