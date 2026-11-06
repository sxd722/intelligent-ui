import test from 'node:test'
import assert from 'node:assert/strict'
import {TOOL_PRESENTATIONS,mapToolPresentation} from '../shared/cardspec/tool-presentations.mjs'
import {TOOLS,toolReference} from '../shared/cardspec/tools.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {createCardSession} from '../src/cardspec/tool-session.mjs'
import {toolResultDiagnostics} from '../shared/cardspec/tool-result-diagnostics.mjs'
const envelope=items=>({items,source:'fixture',fetchedAt:'2026-10-26T12:00:00Z',truncated:false})
test('all reviewed mappings reference registered tools and known response columns',()=>{
 for(const [id,m] of Object.entries(TOOL_PRESENTATIONS)){
  assert.ok(TOOLS[id],id)
  for(const key of Object.values(m.fields).flat())assert.ok([...(TOOLS[id].columns||Object.keys(TOOLS[id].outputSchema.properties.items.items.properties)),...(TOOLS[id].additionalFields||[])].includes(key),id+':'+key)
 }
})
test('tool shorthand compiles to existing lifecycle without executing, both dialects',()=>{
 for(const expressionDialect of ['legacy','js-v1']){
  const r=compileCard('<card><title>天气</title><tool-view tool="opencli.wttr.current" input={{location:"Hangzhou"}} style="pearl"/></card>',{final:true,context:{expressionDialect}})
  assert.equal(r.complete,true,JSON.stringify(r.diagnostics));assert.equal(r.spec.bindings['toolview-1'].load,'visible');assert.equal(r.spec.children[1].props.binding.value,'toolview-1')
  assert.equal(toolResultDiagnostics(r.spec).length,0)
 }
})
test('write shorthand never auto-loads and unknown/scoped/ambiguous tools fail early',()=>{
 const r=compileCard('<card><title>控制</title><tool-view tool="opencli.spotify.pause"/></card>',{final:true})
 assert.equal(r.complete,true,JSON.stringify(r.diagnostics));assert.equal(r.spec.bindings['toolview-1'].load,'manual')
 for(const source of ['<tool-view tool="missing"/>','<tool-view binding="unknown"/>','<tool-view tool="opencli.spotify.pause" binding="x"/>','<each items={[]}><tool-view tool="opencli.spotify.pause"/></each>'])assert.equal(compileCard('<card>'+source+'</card>',{final:true}).complete,false)
})
test('missing is not zero, mapping drift yields explicit fallback, IDs remain original',()=>{
 assert.equal(mapToolPresentation('unknown',envelope([])).error.code,'VIEW_UNMAPPED')
 assert.equal(mapToolPresentation('opencli.douban.top250',envelope([{renamed:'A'}])).error.code,'VIEW_REQUIRED')
 assert.equal(mapToolPresentation('opencli.wttr.current',envelope([{location:'HZ',tempC:'unknown'}])).error.code,'VIEW_NUMBER')
 const row={rowKey:'row:1',id:'subject:1',title:'A',rating:null}
 const result=mapToolPresentation('opencli.douban.top250',envelope([row]));assert.equal(result.ok,true);assert.equal(result.items[0].metric,null);assert.equal(result.items[0].raw,row)
 assert.equal(mapToolPresentation('opencli.douban.top250',envelope([])).ok,true)
})
test('each display category has a valid minimal response and source metadata',()=>{
 const fixtures={
 'opencli.google.news':{title:'News'},'opencli.wikipedia.summary':{title:'Topic',extract:'Explanation'},'opencli.douban.top250':{title:'Film',rating:8},
 'opencli.12306.trains':{code:'G1',from_station:'A',to_station:'B',start_time:'08:00',arrive_time:'09:00',second_seat:'无'},
 'opencli.dianping.search':{name:'POI'},'opencli.wttr.current':{location:'City',tempC:0},'opencli.dongchedi.score':{dimension:'Safety',score:4},'opencli.spotify.pause':{status:'paused'}}
 const kinds=new Set();for(const [id,row] of Object.entries(fixtures)){const r=mapToolPresentation(id,{...envelope([row]),truncated:true});assert.equal(r.ok,true,id);assert.equal(r.partial,true);kinds.add(r.kind)}assert.equal(kinds.size,8)
 assert.match(toolReference(true,['opencli.wttr.current']),/tool-view/)
})
test('discovery exposes the mapping and prefetched shorthand never repeats the initial call',async()=>{
 const tool='opencli.douban.top250',input={limit:3},value=envelope([{rowKey:'r',id:'x',title:'Film'}])
 const generation=createGenerationTools({catalog:[{...TOOLS[tool],available:true}],enabled:true})
 const description=await generation.execute('cli_describe',{id:tool},new AbortController().signal)
 assert.equal(description.presentation.component,'tool-view')
 const result=compileCard('<card><tool-view tool="opencli.douban.top250" input={{limit:3}}/></card>',{final:true})
 assert.equal(result.complete,true,JSON.stringify(result.diagnostics))
 result.spec.prefetched=[{id:'D1',tool,input,value,updatedAt:new Date().toISOString()}]
 let calls=0;const session=createCardSession(result.spec,{transport:async()=>{calls++;return {kind:'json',value}}})
 session.setActivity({complete:true,visible:true});await new Promise(r=>setTimeout(r,10))
 assert.equal(session.current().bindings['toolview-1'].value.items[0].title,'Film');assert.equal(calls,0)
 session.dispose()
})
