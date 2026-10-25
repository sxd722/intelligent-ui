import test from 'node:test'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createCardSession} from '../src/cardspec/tool-session.mjs'

const tool='opencli.douban.top250'
const value=title=>({items:[{id:'1',rowKey:'r1',title}],source:'fixture',fetchedAt:new Date().toISOString(),truncated:false})
function fixture(){
 const original=value('初始'),context={datasets:{D1:original}}
 const result=compileCard(`<card><state id="limit" type="number" initial={5}/><state id="chosen" type="string" initial=""/><binding id="rows" tool="${tool}" input={{limit:state.limit}} initial={{items:[],source:"",fetchedAt:"",truncated:false}}/><text>{context.datasets.D1.items[0].title}</text><action id="choose"><set target="chosen" value={context.datasets.D1.items[0].title}/></action><action id="change"><set target="limit" value={10}/></action><action id="fail"><set target="chosen" value={null}/></action></card>`,{final:true,cardId:'refresh',context})
 assert.equal(result.complete,true,JSON.stringify(result.diagnostics));result.spec.prefetched=[{id:'D1',tool,input:{limit:5},value:original,updatedAt:new Date().toISOString()}];return result.spec
}
test('refresh updates prefetched rendering and action scopes, survives history/restoration, and keeps failure content',async()=>{
 const spec=fixture(),cache=new Map(),storage={getItem:k=>cache.get(k),setItem:(k,v)=>cache.set(k,v)},options={storage,persistenceKey:'refresh-test'}
 let fail=false
 const s=createCardSession(spec,{...options,transport:async()=>{if(fail)throw Error('offline');return {kind:'json',value:value('刷新')}}})
 s.setActivity({visible:true,complete:true});await s.invoke({binding:'rows'})
 assert.equal(s.scope().context.datasets.D1.items[0].title,'刷新');assert.equal(spec.context.datasets.D1.items[0].title,'初始')
 s.fire('choose');assert.equal(s.current().store.values.chosen,'刷新')
 fail=true;await s.invoke({binding:'rows'});assert.equal(s.scope().context.datasets.D1.items[0].title,'刷新')
 s.openResults('rows');s.navigate(-1);assert.equal(s.scope().context.datasets.D1.items[0].title,'刷新');s.save();s.dispose()
 const restored=createCardSession(spec,options);assert.equal(restored.scope().context.datasets.D1.items[0].title,'刷新');restored.dispose()
})
test('changed queries and cancelled/failed response transactions cannot overwrite another dataset',async()=>{
 const spec=fixture();let resolve
 const s=createCardSession(spec,{transport:()=>new Promise(r=>resolve=r)});s.setActivity({visible:true,complete:true})
 const old=s.invoke({binding:'rows'});s.fire('change');resolve({kind:'json',value:value('过期')});await old
 assert.equal(s.scope().context.datasets.D1.items[0].title,'初始')
 const other=s.invoke({binding:'rows'});resolve({kind:'json',value:value('不同查询')});await other
 assert.equal(s.scope().context.datasets.D1.items[0].title,'初始');s.dispose()
 const failed=createCardSession(fixture(),{transport:async()=>({kind:'json',value:value('不能提交')})});failed.setActivity({visible:true,complete:true})
 await failed.invoke({binding:'rows',onSuccess:'fail'});assert.equal(failed.scope().context.datasets.D1.items[0].title,'初始');failed.dispose()
})
