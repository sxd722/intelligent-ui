import {existsSync} from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {toolResultDiagnostics} from '../shared/cardspec/tool-result-diagnostics.mjs'
import {createCardSession} from '../src/cardspec/tool-session.mjs'
import {observableContent} from '../shared/cardspec/feedback-diagnostics.mjs'

const tool='opencli.douban.top250',context={expressionDialect:'js-v1'}
const envelope=title=>({items:[{id:'a',rowKey:'a',title}],source:'fixture',fetchedAt:'2026-10-21T00:00:00Z',truncated:false})
function compile(body,input='{}',ctx=context){
 const r=compileCard(`<card><binding id="feed" tool="${tool}" input={${input}} load="manual"/>${body}<action id="refresh"><invoke binding="feed"/></action></card>`,{final:true,context:ctx})
 assert.equal(r.complete,true,JSON.stringify(r.diagnostics));return r.spec
}
test('literal copy with a working refresh and status indicator is a warning, not a compile failure',()=>{
 const s=compile('<data id="rows" value={[{title:"Old"}]}/><text>{data.rows[0].title}</text><caption>{bindings.feed.status}</caption>')
 assert.deepEqual(toolResultDiagnostics(s).map(d=>[d.code,d.severity]),[['tool_result_unconsumed','warning']])
})
test('live data through nested derives is consumed; unreachable declarations are not',()=>{
 const body='<data id="rows" value={bindings.feed.value.items}/><derive id="names" value={data.rows.map(x=>x.title).join(",")}/>'
 assert.equal(toolResultDiagnostics(compile(body+'<text>{derived.names}</text>')).length,0)
 assert.equal(toolResultDiagnostics(compile(body+'<text>Static</text>')).length,1)
})
test('response callback is an explicit consumer; state initialization alone is frozen',()=>{
 const s=compile('<state id="answer" type="string" initial=""/><text>{state.answer}</text><action id="save"><set target="answer" value={event.result.items[0].title}/></action>')
 s.actions.refresh[0].onSuccess='save';assert.equal(toolResultDiagnostics(s).length,0)
 assert.equal(toolResultDiagnostics(compile('<state id="copy" type="array" initial={bindings.feed.value.items}/><text>{state.copy.length}</text>')).length,1)
})
test('matching prefetched dataset bridges refresh, different query does not',()=>{
 const s=compile('<text>{context.datasets.D1.items[0].title}</text>','{limit:5}',{...context,datasets:{D1:envelope('Before')}})
 s.prefetched=[{id:'D1',tool,input:{limit:5},value:envelope('Before')}]
 assert.equal(toolResultDiagnostics(s).length,0)
 s.prefetched[0].input.limit=10;assert.equal(toolResultDiagnostics(s).length,1)
})
test('tool chains consume upstream values and page outputs are not mistaken for unused binding results',()=>{
 const s=compile('<binding id="analysis" tool="dataset.analyze" input={{items:bindings.feed.value.items,instruction:"classify"}}/><text>{bindings.analysis.value.items.length}</text>')
 assert.equal(toolResultDiagnostics(s).length,0)
 s.actions.refresh[0].target='page';assert.equal(toolResultDiagnostics(s).length,0)
})
test('real session commits a refreshed value but literal content stays unchanged; live content changes',async()=>{
 for(const live of [false,true]){
  const s=compile(live?'<text>{bindings.feed.value.items.map(x=>x.title).join(",")}</text>':'<text>Before</text>')
  const session=createCardSession(s,{storage:null,transport:async()=>({kind:'json',value:envelope('After')})})
  try{
   session.setActivity({visible:true,complete:true})
   const observe=()=>observableContent(s,session.current().store,{bindings:session.current().bindings})
   const before=observe();await session.invoke({binding:'feed'})
   assert.equal(session.current().bindings.feed.value.items[0].title,'After')
   assert.equal(observe()!==before,live)
  }finally{session.dispose()}
 }
})
test('immutable R13 sentiment source exposes all three unconsumed read results',{skip: ["artifacts/javascript-upgrade/deep-baselines-r13/sentiment.json"].every(existsSync) ? false : "Private historical replay artifacts excluded from source export"}, ()=>{
 const r=JSON.parse(readFileSync('artifacts/javascript-upgrade/deep-baselines-r13/sentiment.json','utf8'))
 const issues=toolResultDiagnostics(r.output.spec)
 assert.equal(issues.length,3)
 for(const id of ['newsSrc','xhsSrc','biliSrc'])assert.ok(issues.some(x=>x.message.startsWith(id+':')))
})
