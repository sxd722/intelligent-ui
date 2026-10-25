import {chromium} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const browser=await chromium.launch({channel:'chrome',headless:true})
try{
 const page=await browser.newPage({viewport:{width:1440,height:980}}),errors=[],calls=[]
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',r=>{calls.push(new URL(r.request().url()).pathname);return r.fulfill({contentType:'application/json',body:'{}'})})
 await page.goto('http://127.0.0.1:8787/design-templates.html')
 await page.getByLabel('卡片尺寸',{exact:true}).selectOption('auto');await page.getByLabel('卡片动效',{exact:true}).selectOption('off')
 const pearl=page.locator('.cs-stage[data-layout-template=pearl]'),atlas=page.locator('.cs-stage[data-layout-template=atlas]'),persona=page.locator('.cs-stage[data-layout-template=rebel]')
 await pearl.getByRole('slider').fill('64');await pearl.getByRole('button',{name:'保存当前方案'}).click();assert.match(await pearl.innerText(),/已保存 64%/)
 await atlas.getByRole('button',{name:'雨 / d₃：0.4',exact:true}).click();assert.match(await atlas.innerText(),/所选数值 0.4/)
 await persona.getByRole('button',{name:/脉冲俱乐部/}).click();await persona.getByRole('button',{name:'加入我的行程'}).click();assert.match(await persona.innerText(),/已保存：脉冲俱乐部/)
 for(const stage of [pearl,atlas,persona])await stage.locator('.cs-template-scroll').evaluate(e=>e.scrollTop=0)
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'artifacts/design-templates/production-gallery.png',animations:'disabled'})
 for(const [id,stage]of [['pearl',pearl],['atlas',atlas],['persona',persona]])await stage.screenshot({path:`artifacts/design-templates/production-${id}.png`,animations:'disabled'})
 assert.deepEqual(errors,[]);assert.equal(calls.some(c=>c.includes('/invoke')),false)
 const record={url:page.url(),pass:true,loops:3,pageErrors:errors,toolInvocations:0,templates:await page.locator('.cs-stage').evaluateAll(es=>es.map(e=>({design:e.dataset.design,template:e.dataset.layoutTemplate,width:e.clientWidth,height:e.clientHeight}))),shader:await pearl.locator('.cs-host-effect').getAttribute('data-effect-renderer')}
 await writeFile('artifacts/design-templates/production-smoke.json',JSON.stringify(record,null,2));console.log(JSON.stringify(record,null,2))
}finally{await browser.close()}
