import test from 'node:test'
import assert from 'node:assert/strict'
import {openMeteoForecast,readWithWeatherFallback} from '../server/tools/weather-fallback.mjs'
import {browseTools,contractVersion} from '../server/tools/discovery-tree.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {TOOLS} from '../shared/cardspec/tools.mjs'
const catalog=Object.entries(TOOLS).map(([id,t])=>({...t,id,available:true}))
const weather={timezone:'Asia/Shanghai',daily_units:{temperature_2m_min:'°C',temperature_2m_max:'°C',temperature_2m_mean:'°C'},daily:{time:['2026-11-03'],temperature_2m_min:[0],temperature_2m_max:[10],temperature_2m_mean:[5],weather_code:[3]}}
const fetchImpl=async url=>({ok:true,json:async()=>url.includes('geocoding')?{results:[{name:'杭州',latitude:30,longitude:120}]}:weather})
test('fallback keeps zero, units, provenance and actual coordinates',async()=>{const v=await openMeteoForecast({location:'Hangzhou',days:1},{fetchImpl});assert.equal(v.items[0].minTempC,0);assert.equal(v.items[0].coordSystem,'WGS84');assert.equal(v.items[0].provider,'Open-Meteo');assert.equal(v.items[0].description,'阴')})
test('only network failures of forecast can fallback; auth and abort never do',async()=>{
 const bad=async()=>{throw Object.assign(Error('fetch failed'),{code:'AUTH_REQUIRED'})}
 await assert.rejects(readWithWeatherFallback('opencli.wttr.forecast',{},bad,{fetchImpl}),/fetch failed/)
 await assert.rejects(readWithWeatherFallback('opencli.douban.top250',{},bad,{fetchImpl}),/fetch failed/)
 const ctrl=new AbortController();ctrl.abort();await assert.rejects(readWithWeatherFallback('opencli.wttr.forecast',{},async()=>{throw Error('network')},{signal:ctrl.signal,fetchImpl}),/network/)
 let notices=[];const v=await readWithWeatherFallback('opencli.wttr.forecast',{location:'30,120'},async()=>{throw Error('ECONNRESET')},{fetchImpl,emit:x=>notices.push(x)});assert.equal(v.items.length,1);assert.equal(notices.find(n=>n.type==='warning').code,'WEATHER_PROVIDER_FALLBACK')
})
test('weather rejects coordinate and unit drift',async()=>{
 await assert.rejects(openMeteoForecast({location:'91,120'},{fetchImpl}),/coordinates/)
 await assert.rejects(openMeteoForecast({location:'30,120'},{fetchImpl:async()=>({ok:true,json:async()=>({...weather,daily_units:{}})})}),/units/)
})
test('structured network errors fallback without requiring English user-facing text',async()=>{
 const value=await readWithWeatherFallback('opencli.wttr.forecast',{location:'30,120'},async()=>{throw Object.assign(Error('暂时无法连接数据来源'),{code:'NETWORK',errorInfo:{code:'NETWORK',detail:'fetch failed'}})},{fetchImpl})
 assert.equal(value.items[0].provider,'Open-Meteo')
})
test('hierarchy accounts for every eligible command, unknown scopes rejected',()=>{
 const root=browseTools(catalog),sources=browseTools(catalog,{level:'sources'}),leaves=browseTools(catalog,{level:'tools'})
 assert.ok(root.domains.length>4);assert.equal(sources.sources.reduce((n,s)=>n+s.count,0),leaves.total)
 assert.ok(leaves.tools.every(t=>t.version));assert.throws(()=>browseTools(catalog,{domains:['nonexistent']}),/domain/)
})
test('batch contracts are versioned, preserve availability, no invocations',async()=>{
 let calls=0;const g=createGenerationTools({catalog,invoke:async()=>{calls++},discover:async(_,query)=>({tools:[{id:'global'}],query})})
 const ids=['opencli.douban.top250','opencli.wttr.forecast'];const v=await g.execute('cli_describe',{ids});assert.equal(v.contracts.length,2);assert.equal(calls,0)
 const next=await g.execute('cli_describe',{ids,knownVersions:Object.fromEntries(v.contracts.map(t=>[t.id,t.version]))});assert.ok(next.contracts.every(t=>t.unchanged&&!t.input))
 const global=await g.execute('cli_discover',{query:'今晚看什么',domains:['life']});assert.equal(global.tools[0].id,'global')
 assert.equal(contractVersion(catalog.find(t=>t.id===ids[0])),v.contracts[0].version)
 await assert.rejects(g.execute('cli_describe',{ids:[...ids,...ids,'x']}),/1–4/)
})
