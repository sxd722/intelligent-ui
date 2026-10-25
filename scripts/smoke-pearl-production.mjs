import {chromium} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {auditLayout} from '../src/cardspec/layout-audit.js'
const baseUrl=process.env.PEARL_BASE_URL||'http://127.0.0.1:8787'
const evidencePrefix=process.env.PEARL_EVIDENCE_PREFIX||'production'
const browser=await chromium.launch({channel:'chrome',headless:true})
try{
 const page=await browser.newPage({viewport:{width:1100,height:1000}}),errors=[],calls=[],layouts=[]
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/Content Security Policy|inline script/i.test(m.text()))errors.push(m.text())});page.on('request',r=>{if(r.url().includes('/invoke'))calls.push(r.url())})
 await page.goto(baseUrl+'/pearl-review.html')
 const frame=page.frameLocator('iframe[title="Pearl 整卡样板"]'),stage=page.locator('.pearl-reference .cs-stage')
 await frame.getByRole('slider').waitFor({timeout:15000})
 for(const size of ['square','auto'])for(const width of [320,360,432]){
  await page.getByLabel('宽度',{exact:true}).selectOption(String(width));await page.getByLabel('尺寸',{exact:true}).selectOption(size);await stage.scrollIntoViewIfNeeded()
  await page.waitForTimeout(150)
  const host=await stage.evaluate(auditLayout,{noScroll:true}),inner=await frame.locator('html').evaluate(auditLayout,{noScroll:true})
  assert.equal(host.pass,true,JSON.stringify(host.issues));assert.equal(inner.pass,true,JSON.stringify(inner.issues))
  layouts.push({width,size,mainVisiblePx:await frame.locator('.pearl-hero').evaluate(el=>el.getBoundingClientRect().height),horizontalOverflow:false,primaryReachable:true,host,inner})
 }
 // Actual mobile viewport, in addition to fixed card-width tests.
 await page.setViewportSize({width:360,height:800});await page.getByLabel('宽度',{exact:true}).selectOption('320');await page.getByLabel('尺寸',{exact:true}).selectOption('square')
 await stage.scrollIntoViewIfNeeded();await stage.screenshot({path:`artifacts/pearl-composition/${evidencePrefix}-mobile-320.png`})
 assert.equal((await frame.locator('html').evaluate(auditLayout,{noScroll:true})).pass,true)
 await frame.getByRole('slider').press('End');await page.waitForTimeout(150);await frame.getByRole('button',{name:'保存当前方案 ↗'}).click()
 await page.waitForFunction(()=>JSON.parse(sessionStorage.getItem('cardspec:pearl-reference:v1')).pages[0].store.values.saved===100)
 await page.reload();await frame.getByRole('slider').waitFor({timeout:15000})
 assert.equal(await frame.getByRole('slider').inputValue(),'100')
 await page.getByLabel('视图',{exact:true}).selectOption('native')
 assert.equal(await page.locator('.pearl-reference').getByRole('slider').inputValue(),'100')
 await page.locator('.pearl-reference').getByRole('slider').press('Home')
 await page.getByLabel('视图',{exact:true}).selectOption('hybrid')
 await frame.getByRole('slider').waitFor({timeout:15000})
 assert.equal(await frame.getByRole('slider').inputValue(),'0')
 await page.setViewportSize({width:1100,height:1000});await page.getByLabel('宽度',{exact:true}).selectOption('432')
 await page.screenshot({path:`artifacts/pearl-composition/${evidencePrefix}-comparison.png`})
 assert.deepEqual(errors,[]);assert.deepEqual(calls,[])
 await writeFile(`artifacts/pearl-composition/${evidencePrefix}.json`,JSON.stringify({pass:true,baseUrl,errors,calls,layouts,restoration:true,nativeBridge:true},null,2));console.log('Production: six layouts, mobile viewport, trusted interaction, reload and native bridge; no tool calls.')
}finally{await browser.close()}
