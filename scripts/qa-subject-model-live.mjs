import {readFile,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'
import assert from 'node:assert/strict'
const dir='artifacts/subject-composition-qa',r=JSON.parse(await readFile(dir+'/model-rail-v2/result.json','utf8')),spec=structuredClone(r.spec);spec.prefetched=[]
const turn={id:'subject-live-ui',role:'assistant',format:'cardspec',status:'succeeded',phases:[{id:'qa',kind:'cardspec',status:'succeeded',live:false,message:{status:'succeeded',content:{parts:[r.source]},metadata:{format:'cardspec',card_spec:spec}}}]}
const browser=await chromium.launch({channel:'chrome',headless:true}),trace=[],errors=[];let summary={}
try{
 const page=await browser.newPage({viewport:{width:800,height:1100},reducedMotion:'reduce'}),responses=[];page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(({turn})=>{if(window!==window.top)return;localStorage.setItem('cardspec:render-mode:v1','native');localStorage.setItem('cards:display:size:v1','full');sessionStorage.setItem('cardspec:conversation:v1',JSON.stringify({version:1,messages:[turn],toolsEnabled:true}))},{turn})
 await page.route('**/api/rsi-journal/**',route=>route.fulfill({json:{saved:true}}))
 page.on('response',response=>{if(response.url().endsWith('/api/tools/invoke'))responses.push((async()=>{const request=response.request().postDataJSON();try{const frames=(await response.text()).split('\n').filter(s=>s.startsWith('data:')).map(s=>JSON.parse(s.slice(5)));trace.push({request,frames,at:new Date().toISOString()})}catch(e){trace.push({request,error:e.message})}})())})
 await page.goto('http://127.0.0.1:8787/');await page.getByRole('button',{name:/查看车次 · 40 项/}).waitFor({timeout:60000});console.log('initial real rail visible')
 await page.getByRole('radio',{name:'杭沪',exact:true}).click();await page.getByRole('button',{name:/查看车次 · 118 项/}).waitFor({timeout:60000});console.log('selected real rail visible')
 await page.getByRole('button',{name:/查看车次 · 118 项/}).click();await page.getByRole('button',{name:'后一组 →',exact:true}).click();await page.getByText('4–6 / 118',{exact:true}).waitFor()
 await page.locator('.cs-stage').screenshot({path:dir+'/model-live-all.png'});await page.getByRole('button',{name:'← 返回概览',exact:true}).click()
 await page.reload();await page.getByRole('radio',{name:'杭沪',exact:true}).waitFor();assert.equal(await page.getByRole('radio',{name:'杭沪',exact:true}).getAttribute('aria-checked'),'true')
 await page.getByRole('button',{name:/查看车次 · 118 项/}).waitFor({timeout:60000})
 await page.locator('.cs-stage').screenshot({path:dir+'/model-live-restored.png'});await Promise.all(responses)
 assert.ok(trace.some(t=>t.request.tool==='opencli.12306.trains'&&t.request.input.from==='杭州东'&&t.frames?.some(f=>f.type==='result'&&f.result.value.items.length===118)))
 assert.deepEqual(errors,[])
 summary={status:'passed',errors,calls:trace.length,restored:true,allRowsReachable:true,text:await page.locator('.cs-stage').innerText(),images:await page.locator('.cs-stage img').evaluateAll(imgs=>imgs.map(i=>({src:i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0}))) }
 console.log(JSON.stringify(summary))
}catch(e){summary={status:'failed',error:e.message,errors};throw e}finally{await writeFile(dir+'/model-live-trace.json',JSON.stringify(trace,null,2));await writeFile(dir+'/model-live-summary.json',JSON.stringify(summary,null,2));await browser.close()}
