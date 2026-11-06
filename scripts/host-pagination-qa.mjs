import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {build} from 'esbuild'
import {chromium} from '@playwright/test'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {normalizeOpenCli} from '../server/tools/opencli.mjs'
const root='artifacts/host-pagination',web='dist/host-pagination',base='http://127.0.0.1:8787'
await fs.mkdir(web+'/runs',{recursive:true})
const input={from:'杭州',to:'上海',date:'2026-11-06',limit:8,departureAfter:'12:00',departureBefore:'18:00',exactStations:false}
const payload={tool:'opencli.12306.trains',input,requestId:randomUUID(),pageId:'pagination-qa',sessionId:'pagination-qa',target:'binding',cause:'user'}
const started=Date.now(),response=await fetch(base+'/api/tools/invoke',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(payload)})
const raw=await response.text(),events=raw.split('\n').filter(l=>l.startsWith('data:')).map(l=>JSON.parse(l.slice(5)))
await fs.writeFile(root+'/real-query.json',JSON.stringify({input,status:response.status,elapsedMs:Date.now()-started,events},null,2))
const value=events.find(e=>e.type==='result')?.result?.value
assert(value,raw.slice(0,2000));assert(value.items.length>100);assert.equal(value.items.length,value.coverage.matched);assert.equal(value.truncated,false)
const source='<card schemaVersion="1"><state id="after" type="string" initial="12:00"/><binding id="trains" tool="opencli.12306.trains" input={'+JSON.stringify(input).replace('"departureAfter":"12:00"','"departureAfter":state.after')+'} load="visible" initial={{items:[],source:"",fetchedAt:"",truncated:false}}/><tool-view id="results" binding="trains" label="杭州 → 上海 · 下午"/><action id="changeWindow"><set target="after" value="13:00"/></action></card>'
const compiled=compileCard(source,{final:true,cardId:'host-pagination-real'})
assert(compiled.complete,JSON.stringify(compiled.diagnostics))
compiled.spec.prefetched=[{tool:payload.tool,input,value,updatedAt:new Date().toISOString()}]
const run={status:'succeeded',title:'宿主分页：真实下午车次',prompt:'验证完整工具结果的分页、选择和恢复。此处为确定性宿主测试卡，不是新的模型生成。',source,spec:compiled.spec}
await fs.writeFile(root+'/rail.json',JSON.stringify(run,null,2));await fs.writeFile(web+'/runs/rail.json',JSON.stringify(run))
// Cross-domain deterministic collection; explicitly fixture, no real-source claim.
const genericValue=normalizeOpenCli('opencli.hackernews.search',Array.from({length:130},(_,i)=>({id:String(i+1),title:'QA Article '+String(i+1).padStart(3,'0'),score:i,author:'QA author',url:'https://example.org/'+(i+1)})),{limit:20})
const generic=compileCard('<card><binding id="games" tool="opencli.hackernews.search" input={{query:"pagination QA",limit:20}} load="visible" initial={{items:[],source:"",fetchedAt:"",truncated:false}}/><tool-view id="games-view" binding="games"/></card>',{final:true,cardId:'host-pagination-games'})
assert(generic.complete,JSON.stringify(generic.diagnostics));generic.spec.prefetched=[{tool:'opencli.hackernews.search',input:{query:'pagination QA',limit:20},value:genericValue,updatedAt:new Date().toISOString()}]
await fs.writeFile(web+'/runs/games.json',JSON.stringify({status:'succeeded',title:'文章列表 · 130条可控测试数据',prompt:'可控工具替身：验证跨领域完整集合展示，不代表真实文章数据。',spec:generic.spec}))
await build({entryPoints:['scripts/native-golden/viewer.jsx'],bundle:true,jsx:'automatic',format:'esm',platform:'browser',outfile:web+'/viewer.js',define:{'process.env.NODE_ENV':'"production"'},loader:{'.woff2':'file','.ttf':'file','.woff':'file','.png':'file'},logLevel:'error'})
await fs.writeFile(web+'/viewer.html','<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Host pagination QA</title><link rel="stylesheet" href="viewer.css"><style>body{margin:0;background:#e8edf3;font-family:system-ui}.qa-toolbar{display:flex;gap:8px;align-items:center;justify-content:center;padding:16px;flex-wrap:wrap;font-size:14px}.qa-toolbar select{margin:6px}.qa-prompt{margin:20px auto;max-width:650px;font-size:13px;color:#465567;padding:16px}main{padding:0}</style><div id="root"></div><script type="module" src="viewer.js"></script></html>')
const browser=await chromium.launch({channel:'chrome',headless:true}),ctx=await browser.newContext({viewport:{width:850,height:900}}),page=await ctx.newPage(),errors=[],checks=[]
page.on('pageerror',e=>errors.push(e.message));await ctx.tracing.start({screenshots:true,snapshots:true})
const check=async(name,fn)=>{try{const detail=await fn();checks.push({name,pass:true,detail});console.log('PASS',name)}catch(e){checks.push({name,pass:false,error:e.message});console.log('FAIL',name,e.message)}}
try{
 await page.goto(base+'/host-pagination/viewer.html?id=rail');await page.waitForSelector('.nd-trains button')
 await check('真实结果超过旧8/100条限制，末页可达',async()=>{
  const select=page.getByLabel('车次页码'),last=(await select.locator('option').count())-1
  await select.selectOption(String(last));await page.waitForTimeout(250)
  const tail=value.items.toSorted((a,b)=>a.start_time.localeCompare(b.start_time)).at(-1)
  assert((await page.locator('.nd-trains').innerText()).includes(tail.start_time))
  await page.screenshot({path:root+'/rail-last-432.png'});return {loaded:value.items.length,pages:last+1,lastDeparture:tail.start_time}
 })
 await check('末页车次详情与选择',async()=>{
  await page.locator('.nd-trains button').last().click();await page.waitForSelector('.nd-sheet')
  await fs.writeFile(root+'/rail-detail.txt',await page.locator('.nd-sheet').innerText())
  const pick=page.locator('.nd-sheet button').filter({hasText:/固定|选定|选为|选择/}).last();await pick.click();await page.waitForTimeout(200)
  await page.screenshot({path:root+'/rail-selected.png'})
  const state=await page.evaluate(()=>window.qaSession.current().viewState);await fs.writeFile(root+'/selected-state.json',JSON.stringify(state,null,2));assert(Object.values(state.components||{}).some(c=>Object.values(c).some(v=>v?.selection?.trains?.keys?.length===1)));return state
 })
 await check('刷新保留页码和选择且不重查',async()=>{
  await page.evaluate(()=>window.qaSession.save());const before=await page.getByLabel('车次页码').inputValue(),selection=await page.evaluate(()=>window.qaSession.current().viewState.components['/results']['native-decision'].selection);await page.reload();await page.waitForSelector('.nd-trains button')
  assert.equal(await page.getByLabel('车次页码').inputValue(),before)
  assert.deepEqual(await page.evaluate(()=>window.qaSession.current().viewState.components['/results']['native-decision'].selection),selection)
  assert.equal(await page.evaluate(()=>window.qaCalls.length),0)
  return {page:before,networkCalls:0}
 })
 await check('查询条件变化后回到第一页',async()=>{
  await page.evaluate(()=>window.qaSession.fire('changeWindow',{}))
  await page.waitForTimeout(300);assert.equal(await page.getByLabel('车次页码').inputValue(),'0')
  await page.waitForFunction(()=>{const b=window.qaSession.current().bindings.trains;return b.status==='success'&&JSON.parse(b.valueInputKey).departureAfter==='13:00'},null,{timeout:30000})
  const times=await page.evaluate(()=>window.qaSession.current().bindings.trains.value.items.map(r=>r.start_time));assert(times.length>0);assert(times.every(t=>t>='13:00'))
  await fs.writeFile(root+'/rail-calls.json',JSON.stringify(await page.evaluate(()=>window.qaCalls),null,2))
  return {after:'13:00',loaded:times.length,first:times[0],last:times.at(-1)}
 })
 for(const width of [320,432])for(const size of ['square','auto'])await check(`${width}px ${size} 布局`,async()=>{
  await page.getByLabel('验收宽度').selectOption(String(width));await page.getByLabel('验收尺寸').selectOption(size);await page.waitForTimeout(300)
  await page.screenshot({path:root+`/rail-${width}-${size}.png`})
  const audit=await page.evaluate(()=>window.qaAudit());await fs.writeFile(root+`/layout-${width}-${size}.json`,JSON.stringify(audit,null,2))
  assert(await page.getByLabel('车次页码').isVisible());assert.equal(audit.pass,true,JSON.stringify(audit.issues));return audit
 })
 await page.goto(base+'/host-pagination/viewer.html?id=games');await page.waitForSelector('.cs-tool-view')
 await fs.writeFile(root+'/games-dom.txt',await page.locator('body').innerText())
 await check('跨领域130条均保留，局部筛选能找到末项',async()=>{
  const filter=page.getByLabel('筛选候选');if(await filter.isVisible())await filter.click()
  const search=page.getByLabel('筛选已获取候选');await search.fill('QA Article 130');
  if(await filter.isVisible())await filter.click()
  assert((await page.locator('.cs-tool-view').innerText()).includes('QA Article 130'))
  const count=await page.evaluate(()=>window.qaSession.current().bindings.games.value.items.length);assert.equal(count,130)
  await page.screenshot({path:root+'/games-last.png'});return {loaded:count}
 })
 await fs.writeFile(root+'/calls.json',JSON.stringify(await page.evaluate(()=>window.qaCalls),null,2))
 assert.equal(errors.length,0,errors.join('\n'))
}finally{await ctx.tracing.stop({path:root+'/browser-trace.zip'});await browser.close()}
const connection=await fetch(base+'/api/tools/connections').then(r=>r.json()),before=JSON.parse(await fs.readFile(root+'/connection-before.json','utf8'))
assert.equal(connection.browser.binding.session,before.browser.binding.session);assert.equal(connection.browser.daemonPid,before.browser.daemonPid);assert.equal(connection.browser.ready,true)
await fs.writeFile(root+'/connection-after.json',JSON.stringify(connection,null,2));await fs.writeFile(root+'/checks.json',JSON.stringify({checks,errors},null,2))
console.log(JSON.stringify({passed:checks.filter(c=>c.pass).length,total:checks.length,loaded:value.items.length,connectionPreserved:true}))
if(checks.some(c=>!c.pass))process.exitCode=1
