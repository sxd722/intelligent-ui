import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {TOOLS,selectToolIds,toolReference} from '../shared/cardspec/tools.mjs'
import {toolDiscoveryReference,expandedToolIds,requestedToolContracts} from '../shared/cardspec/tool-discovery.mjs'
import {handleCardSpec} from '../server/cardspec/handler.mjs'
const catalog=Object.values(TOOLS).map(t=>({...t,available:!t.unsupportedReason}))

test('every supported command is discoverable, unavailable tools are distinguished, schemas stay bounded',()=>{
 const c=catalog.map(t=>({...t,...(t.site==='spotify'?{available:false,reason:'需要 OAuth 授权'}:{})}))
 const reference=toolDiscoveryReference(c,'杭州饭店推荐')
 const groups=JSON.parse(reference.split('\n')[1])
 const discovered=groups.flatMap(g=>[...g.ready,...g.unavailable].map(t=>g.prefix+t[0]))
 assert.deepEqual(new Set(discovered),new Set(c.filter(t=>!t.unsupportedReason).map(t=>t.id)))
 assert.ok(reference.length<14500)
 assert.ok(groups.find(g=>g.prefix==='opencli.spotify.').unavailable.length)
 assert.ok(reference.includes('需要 OAuth 授权'));assert.ok(reference.includes('饭店美食'))
 assert.ok(reference.indexOf('opencli.dianping.')<reference.indexOf('autocli.hackernews.'))
 assert.ok(!expandedToolIds(c,'Spotify 播放音乐').includes('opencli.spotify.play'))
})
test('common natural language retrieves relevant capabilities without unconditional news exemplars',()=>{
 for(const [goal,expected] of [['杭州饭店推荐','opencli.dianping.search'],['有什么值得听的','opencli.apple-podcasts.search'],['周末出游','opencli.ctrip.search'],['上海天气','opencli.wttr.current']]){
  const ids=selectToolIds(catalog.map(t=>t.id),goal)
  assert.ok(ids.includes(expected),goal);assert.ok(!ids.includes('autocli.hackernews.top'))
  assert.ok(!toolReference(true,ids).includes('hackernews'))
 }
 assert.ok(selectToolIds(catalog.map(t=>t.id),'Hacker News 最新资讯').includes('autocli.hackernews.top'))
 const expanded=expandedToolIds(catalog,'休息一下',[{goal:'用 opencli.dianping.search 查附近餐馆'}])
 assert.equal(expanded[0],'opencli.dianping.search')
 assert.ok(expanded.filter(id=>id.startsWith('opencli.')).length<=18)
})
const card='<card><binding id="places" tool="opencli.dianping.search" input={{keyword:"饭店",city:"杭州"}} initial={{items:[],source:"",fetchedAt:"",truncated:false}} load="manual"/><text>查询饭店</text></card>'
async function generate(mode,{unavailable=false,repair=false}={}){
 const messages=[],frames=[],res=new EventEmitter();res.writeHead=()=>{};res.flushHeaders=()=>{};res.write=s=>{if(s.slice(6).trim()!=='[DONE]')frames.push(JSON.parse(s.slice(6)))};res.end=()=>res.writableEnded=true
 const c=catalog.map(t=>({...t,...(unavailable&&t.site==='dianping'?{available:false,reason:'需要连接'}:{})}))
 await handleCardSpec({},res,{mode,messages:[{role:'user',content:'帮我安排一下休息时间'}]}, {keyLoaded:true,model:'test',photo:async()=>null,toolCatalog:async()=>c,streamUpstream:async(m,o)=>{
  messages.push(m)
  if(o.responseFormat){o.onPiece({content:JSON.stringify(messages.length===1?{goal:'使用 opencli.dianping.search 寻找杭州饭店',interactions:[]}:{theme:{language:'soft',palette:'a'},regions:[],rules:['用 opencli.dianping.search 查找饭店']})});return}
  o.onPiece({content:repair&&messages.length===1?card.replace('city:"杭州"','unsupported:"杭州"'):card})
 }})
 return {messages,frames}
}
test('staged planning discovers beyond initial keyword selection and expands contracts without another planning call',async()=>{
 const {messages,frames}=await generate('staged')
 assert.equal(messages.length,3);assert.ok(messages[0][0].content.includes('饭店美食'))
 assert.ok(messages[2][0].content.includes('"id":"opencli.dianping.search"'))
 assert.equal(frames.find(f=>f.type==='message_stream_complete').status,'succeeded')
})
test('direct generation may choose a ready tool outside the shortlist; repair receives its real schema',async()=>{
 const result=await generate('direct');assert.equal(result.messages.length,1);assert.equal(result.frames.find(f=>f.type==='message_stream_complete').status,'succeeded')
 const fixed=await generate('direct',{repair:true});assert.equal(fixed.messages.length,2);assert.ok(fixed.messages[1].at(-1).content.includes('宿主补充实际所选工具的完整契约'));assert.equal(fixed.frames.find(f=>f.type==='message_stream_complete').status,'succeeded')
 const denied=await generate('direct',{unavailable:true});assert.equal(denied.frames.find(f=>f.type==='message_stream_complete').status,'failed')
 assert.equal(requestedToolContracts(card,catalog.map(t=>({...t,available:false}))), '')
})
