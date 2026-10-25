import test from 'node:test'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createCardSession} from '../src/cardspec/tool-session.mjs'
import {createToolService} from '../server/tools/service.mjs'
import {toolErrorInfo} from '../shared/cardspec/tool-errors.mjs'
import {resultImage,resultContext,detailRequests} from '../shared/cardspec/result-view.mjs'
import {TOOLS,selectToolIds,validateToolInput} from '../shared/cardspec/tools.mjs'
const source='<card><binding id="rows" tool="opencli.douban.top250" input={{limit:3}} initial={{items:[],source:"",fetchedAt:"",truncated:false}} load="visible" refresh={30}/><title>片单</title></card>'
const spec=()=>compileCard(source,{final:true,cardId:'root'}).spec
const value={items:[{id:'a',rowKey:'a',title:'A'},{id:'b',rowKey:'b',title:'B'}],source:'test',fetchedAt:'2026-10-14T00:00:00Z',truncated:false}
const turn=()=>new Promise(r=>setTimeout(r,0))
test('error categories distinguish empty data, schema drift and access restrictions',()=>{
 assert.equal(toolErrorInfo(new Error('unexpected payload shape')).code,'SCHEMA_MISMATCH')
 assert.equal(toolErrorInfo(new Error('验证码')).code,'ACCESS_RESTRICTED')
 assert.equal(toolErrorInfo(new Error('HTTP 429')).code,'RATE_LIMITED')
 assert.equal(toolErrorInfo(new Error('fetch failed')).code,'NETWORK')
 assert.equal(toolErrorInfo(Object.assign(new Error('cancel'),{name:'AbortError'})).code,'CANCELLED')
 assert.doesNotMatch(toolErrorInfo(new Error('token=private')).detail,/private/)
})
test('server health is separate from installed availability; identical auto requests use a circuit, manual retries escape it',async()=>{
 let calls=0,fail=true
 const provider={status:async()=>({}),available:async()=>({available:true}),invoke:async()=>{calls++;if(fail)throw Error('unexpected payload shape');return value},close(){}}
 const svc=createToolService({keyLoaded:true,streamUpstream:async()=>{},cli:provider,opencli:provider})
 const p={tool:'opencli.douban.top250',input:{limit:3},target:'binding',pageId:'p',sessionId:'s',cause:'auto'}
 await assert.rejects(svc.invoke({...p,requestId:'1'},new AbortController().signal),e=>e.errorInfo.code==='SCHEMA_MISMATCH')
 await assert.rejects(svc.invoke({...p,requestId:'2'},new AbortController().signal));assert.equal(calls,1)
 let t=(await svc.catalog()).find(t=>t.id===p.tool);assert.equal(t.available,true);assert.equal(t.health.status,'degraded')
 fail=false;await svc.invoke({...p,requestId:'3',cause:'user'},new AbortController().signal);assert.equal(calls,2)
 t=(await svc.catalog()).find(t=>t.id===p.tool);assert.equal(t.health.status,'healthy');svc.close()
})
test('nonretryable errors pause polling and keep data, transient errors retry at most once',async()=>{
 let time=0,calls=0,fail=false
 const session=createCardSession(spec(),{now:()=>time,transport:async()=>{calls++;if(fail)throw Error('unexpected payload shape');return{kind:'json',value}}})
 session.setActivity({complete:true,visible:true});await turn();fail=true;time=31000;session.tick();await turn()
 assert.equal(session.current().bindings.rows.value.items.length,2)
 time=9999999;session.tick();await turn();assert.equal(calls,2)
 fail=false;await session.retry('rows');assert.equal(calls,3);session.dispose()
 let retries=0;const s=createCardSession(spec(),{now:()=>time,transport:async()=>{retries++;throw Error('network error')}})
 s.setActivity({complete:true,visible:true});await turn();time+=31000;s.tick();await turn();time+=31000;s.tick();await turn();assert.equal(retries,2);s.dispose()
})
test('result history preserves filters and shared favorites through back/forward and refresh',async()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)}
 const s=createCardSession(spec(),{storage,persistenceKey:'x',transport:async()=>({kind:'json',value})})
 s.setActivity({complete:true,visible:true});await turn();s.openResults('rows');s.setResultView({query:'A',layout:'gallery'});s.openDetail(value.items[0]);s.toggleFavorite('opencli.douban.top250',value.items[0]);s.navigate(-1)
 assert.equal(s.current().viewState.query,'A');assert.equal(s.current().viewState.layout,'gallery');assert.equal(s.isFavorite('opencli.douban.top250',value.items[0]),true)
 s.save();s.dispose();const restored=createCardSession(spec(),{storage,persistenceKey:'x'});assert.equal(restored.index,1);assert.equal(restored.isFavorite('opencli.douban.top250',value.items[0]),true);restored.openDetail(value.items[1]);assert.equal(restored.pages.length,3);restored.dispose()
})
test('adaptation is user-only, deduplicated and cannot overwrite changed data or a departed page',async()=>{
 let resolve,calls=0;const s=createCardSession(spec(),{transport:async p=>{if(p.tool!=='glm.generate')return{kind:'json',value};calls++;return new Promise(r=>resolve=r)}})
 s.setActivity({complete:true,visible:true});await turn();assert.equal(calls,0)
 const pending=s.adaptResults('rows');s.adaptResults('rows');assert.equal(calls,1)
 s.current().bindings.rows.value={...value,fetchedAt:'2026-10-15T00:00:00Z'}
 resolve({kind:'page',spec:{...spec(),cardId:'new'}});await pending;assert.equal(s.pages.length,1)
 const second=s.adaptResults('rows');s.openResults('rows');resolve({kind:'page',spec:{...spec(),cardId:'late'}});await second;assert.equal(s.pages.length,2);s.dispose()
})
test('result schemas, bounded context and trusted image URLs are checked without guessing',()=>{
 for(const request of detailRequests('opencli.douban.top250',{id:'1'}))validateToolInput(request.tool,request.input)
 for(const request of detailRequests('opencli.dongchedi.search',{series_id:'123'}))validateToolInput(request.tool,request.input)
 assert.equal(resultImage({image_url:'https://img1.doubanio.com/view/photo/a.jpg'}),'https://img1.doubanio.com/view/photo/a.jpg')
 for(const url of ['http://127.0.0.1/image','https://doubanio.com.evil.test/x','javascript:alert(1)'])assert.equal(resultImage({image_url:url}),null)
 assert.equal(resultContext('test',{...value,items:Array(10).fill(value.items[0])}).items.length,3)
 const selected=selectToolIds(Object.keys(TOOLS),'新能源车测试报告合集和舆情')
 assert.ok(selected.includes('opencli.dongchedi.search'));assert.ok(selected.some(id=>/google|bilibili|zhihu|weibo/.test(id)));assert.ok(selected.length<=23)
})
