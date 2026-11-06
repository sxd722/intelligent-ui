import {chromium} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const dir='artifacts/tooling-p0p1-20261103/complex',base='http://127.0.0.1:8787',before=(await fetch(base+'/api/tools/connections').then(r=>r.json())).browser,browser=await chromium.launch({channel:'chrome',headless:true}),results=[]
try{for(const id of ['feed','trip','movie']){
 const page=await browser.newPage({viewport:{width:460,height:900}}),checks=[],errors=[],screenshots=[],capturedCalls=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message))
 const check=async(name,fn)=>{try{await fn();checks.push({name,passed:true})}catch(e){checks.push({name,passed:false,error:e.message.slice(0,500)})}}
 try{
 await page.goto(base+'/tooling-p0p1/complex/viewer.html?id='+id);await page.waitForFunction(()=>window.qaView?.()?.items.length>0)
 await check('sources-composed',async()=>{const v=await page.evaluate(()=>window.qaView());assert.ok(v.items.length>=3);if(id==='feed')assert.equal(v.counts.bySource.length,2)})
 await page.getByRole('button',{name:'候选',exact:true}).click()
 await check('selection-fetches-related-data',async()=>{
  await page.locator('.tb-row').first().click();await page.waitForFunction(()=>!!window.qaView()?.focus)
  if(id!=='feed'){
   await page.waitForFunction(()=>window.qaCalls.some(c=>c.events),{},{timeout:45000})
   const call=await page.evaluate(()=>window.qaCalls.find(c=>c.events)),v=await page.evaluate(()=>window.qaView());assert.ok(JSON.stringify(call.input).includes(v.focus.title));assert.ok(call.events.some(e=>e.type==='result'),'Real source returned error');await page.waitForFunction(()=>window.qaView().related.length>0,{},{timeout:10000})
  }else assert.equal((await page.evaluate(()=>window.qaCalls)).length,0)
 })
 await check('detail-and-return',async()=>{await page.getByRole('button',{name:'关联资料',exact:true}).click();await page.locator('[data-focus-title]').waitFor();if(id!=='feed')assert.ok(await page.locator('.tb-related').count()>0);await page.getByRole('button',{name:'候选',exact:true}).click();assert.equal(await page.locator('.tb-row[aria-pressed=true]').count(),1)})
 if(id==='feed')await check('source-facet',async()=>{await page.getByRole('button',{name:'xiaohongshu',exact:true}).click();assert.ok((await page.locator('.tb-row').count())>0);await page.getByRole('button',{name:'全部',exact:true}).click()})
 if(id==='trip')await check('weather-date-and-coordinate-integrity',async()=>{const dates=await page.getByRole('combobox',{name:'出游日期'}).locator('option').evaluateAll(xs=>xs.map(x=>x.value));assert.ok(dates.length>=2);await page.getByRole('combobox',{name:'出游日期'}).selectOption(dates[1]);const v=await page.evaluate(()=>window.qaView());assert.ok(v.observations.every(o=>o.title===dates[1]));assert.ok(v.unlocated.length>0,'Unknown coordinate CRS must remain unlocated')})
 capturedCalls.push(...await page.evaluate(()=>window.qaCalls));
 await check('reload-restores-selection',async()=>{const focus=await page.evaluate(()=>window.qaView().focus?.id);await page.evaluate(()=>window.qaSession.save());await page.reload();await page.waitForFunction(()=>window.qaView?.()?.items.length>0);assert.equal(await page.evaluate(()=>window.qaView().focus?.id),focus);assert.equal((await page.evaluate(()=>window.qaCalls)).length,0)})
 await check('layouts',async()=>{for(const width of [320,360,432]){await page.locator('main').evaluate((e,w)=>e.style.width=w+'px',width);await page.waitForTimeout(150);assert.ok(await page.locator('.cs-stage').evaluate(e=>e.scrollWidth<=e.clientWidth+2));const file=id+'-'+width+'.png';await page.locator('.cs-stage').screenshot({path:dir+'/'+file});screenshots.push(file)}})
 }catch(e){checks.push({name:'mount',passed:false,error:e.message})}
 const calls=[...capturedCalls,...await page.evaluate(()=>window.qaCalls||[]).catch(()=>[])];results.push({id,checks,errors,screenshots,calls,passed:checks.every(c=>c.passed)&&!errors.length});await page.close();console.log(id+' '+results.at(-1).passed)
}}finally{await browser.close()}
const after=(await fetch(base+'/api/tools/connections').then(r=>r.json())).browser;await writeFile(dir+'/browser.json',JSON.stringify({before,after,connectionPreserved:before.binding?.session===after.binding?.session&&before.daemonPid===after.daemonPid&&after.binding?.bound,results},null,2))
