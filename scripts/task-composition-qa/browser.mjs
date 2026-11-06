import {chromium} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {cases,ROOT} from './cases.mjs'
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[]
const jobs=cases.flatMap(c=>['native','hybrid'].flatMap(mode=>[320,360,432].flatMap(width=>['square','auto'].map(size=>({c,mode,width,size})))))
async function inspect({c,mode,width,size}){
 const id=c.id+'-'+mode,p=await browser.newPage({viewport:{width:width+24,height:900}}),checks=[],errors=[]
 p.on('pageerror',e=>errors.push(e.message))
 const check=async(name,fn)=>{try{await fn();checks.push({name,passed:true})}catch(e){checks.push({name,passed:false,error:e.message.slice(0,900)})}}
 const view=()=>p.evaluate(()=>window.qaView())
 const select=async n=>{if(mode==='native'){await p.getByRole('button',{name:'候选',exact:true}).click();await p.locator('.tb-row').nth(n).click()}else await p.getByRole('button',{name:n?'选择第二项':'选择第一项',exact:true}).click()}
 try{
 await p.goto(`http://127.0.0.1:8787/task-composition-qa.html?id=${id}&width=${width}&size=${size}`);await p.waitForFunction(()=>window.qaView?.().items.length>0)
 if(mode==='hybrid')await p.frameLocator('iframe').getByRole('button',{name:/探索/}).first().waitFor({timeout:15000})
 await check('initial-data-and-no-replay',async()=>{const v=await view();assert.equal(v.items.length,c.id==='feed'?4:2);assert.equal(await p.evaluate(()=>window.qaCalls.length),0);if(c.id==='trip')assert.equal(v.mapItems.length,2)})
 await check('select-and-dependent-data',async()=>{await select(0);await p.waitForFunction(()=>window.qaView().focus!==null);if(c.id!=='feed')await p.waitForFunction(()=>window.qaView().related.length===1);const v=await view();assert.equal(v.focus.title,c.rows[0].title||c.rows[0].name);if(c.id!=='feed'){assert.ok(v.related[0].title.startsWith(v.focus.title));assert.equal(v.related[0].relation,'related-search');assert.equal((await p.evaluate(()=>window.qaCalls))[0].input[c.id==='trip'?'keyword':'query'],v.focus.title)}})
 if(mode==='native')await check('detail-and-return',async()=>{await p.getByRole('button',{name:'关联资料',exact:true}).click();await p.locator('[data-focus-title]').waitFor();if(c.id!=='feed')assert.ok((await p.locator('.tb-related').innerText()).includes((await view()).focus.title));await p.getByRole('button',{name:'候选',exact:true}).click();assert.equal(await p.locator('.tb-row[aria-pressed="true"]').count(),1)})
 else await check('sandbox-to-host-and-back',async()=>{const second=c.rows[1].title||c.rows[1].name;await p.frameLocator('iframe').getByRole('button',{name:'探索 '+second,exact:true}).click();await p.waitForFunction(title=>window.qaView().focus?.title===title,second);await select(0);await p.frameLocator('iframe').getByLabel('共享焦点').filter({hasText:c.rows[0].title||c.rows[0].name}).waitFor()})
 if(c.id==='trip')await check('date-and-map-link',async()=>{if(mode==='native')await p.getByRole('combobox',{name:'出游日期'}).selectOption('2026-11-05');else await p.getByRole('radio',{name:'2026-11-05',exact:true}).click();assert.equal((await view()).observations[0].summary,'雨');if(mode==='native'){await p.getByRole('button',{name:'地图',exact:true}).click();await p.locator('.cs-map-pin').nth(1).click();await p.waitForFunction(()=>window.qaView().focus?.title==='探索馆');assert.equal(await p.locator('.cs-map-pin[aria-pressed="true"]').count(),1);assert.ok((await p.locator('.tb-map').boundingBox()).height>=80)}})
 if(c.id!=='feed')await check('out-of-order-and-local-failure',async()=>{
  await p.evaluate(()=>{window.qaDelay=160});await select(0);await p.evaluate(()=>{window.qaDelay=0});await select(1);await p.waitForFunction(()=>window.qaView().related[0]?.title.startsWith(window.qaView().focus?.title));await p.waitForTimeout(220);assert.ok((await view()).related[0].title.startsWith(c.rows[1].title||c.rows[1].name))
  await p.evaluate(()=>window.qaFail=true);await select(0);await p.waitForFunction(()=>window.qaView().issues.some(i=>i.code==='SOURCE_ERROR'));assert.equal((await view()).items.length,2);assert.equal((await view()).related.length,0)
  await p.evaluate(()=>window.qaFail=false);await select(1);await p.waitForFunction(()=>window.qaView().related.length===1)
 })
 if(c.id==='trip'&&mode==='native')await p.getByRole('button',{name:'地图',exact:true}).click()
 const trace=await p.evaluate(()=>window.qaCalls)
 await check('refresh-restores-without-tool-replay',async()=>{const before=(await view()).focus?.id;await p.evaluate(()=>window.qaSession.save());await p.reload();await p.waitForFunction(()=>window.qaView?.().items.length>0);assert.equal((await view()).focus?.id,before);assert.equal(await p.evaluate(()=>window.qaCalls.length),0)})
 await check('layout-stability-and-runtime',async()=>{await p.waitForTimeout(300);const samples=[];for(let i=0;i<20;i++){samples.push(await p.locator('.cs-stage').evaluate(el=>{const r=el.getBoundingClientRect();return {w:r.width,h:r.height,scroll:el.scrollWidth,client:el.clientWidth}}));await p.waitForTimeout(100)}assert.ok(samples.every(x=>x.scroll<=x.client+2));assert.ok(Math.max(...samples.map(s=>s.h))-Math.min(...samples.map(s=>s.h))<=1);assert.deepEqual(errors,[])})
 const screenshot=`${id}-${width}-${size}.png`;await p.locator('.cs-stage').screenshot({path:ROOT+'/'+screenshot});results.push({id,width,size,checks,passed:checks.every(x=>x.passed),screenshot,trace,restoredTrace:await p.evaluate(()=>window.qaCalls),view:await view()});console.log(JSON.stringify({id,width,size,passed:results.at(-1).passed,failed:checks.filter(x=>!x.passed)}))
 }catch(e){results.push({id,width,size,passed:false,error:e.message})}finally{await p.close()}
}
try{await Promise.all(Array.from({length:3},async()=>{while(jobs.length)await inspect(jobs.shift())}))}finally{await browser.close()}
await writeFile(ROOT+'/browser.json',JSON.stringify(results,null,2));console.log(`${results.filter(r=>r.passed).length}/${results.length} passed`)
