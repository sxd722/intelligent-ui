import {chromium,expect} from '@playwright/test'
import {readFileSync,writeFileSync} from 'node:fs'
const saved=JSON.parse(readFileSync('artifacts/sandbox-inline/live.json','utf8'))
const spec=saved.message.metadata.card_spec
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[]
try{for(const width of [320,432]){
 const page=await browser.newPage({viewport:{width,height:900}}),calls=[]
 await page.route('**/api/tools/invoke',async r=>{calls.push(r.request().postDataJSON());await r.abort()})
 await page.addInitScript(spec=>{if(window!==window.top)return;localStorage.setItem('cardspec:render-mode:v1','hybrid');localStorage.setItem('cards:display:motion:v1','off');if(sessionStorage.getItem('live-seed'))return;sessionStorage.clear();sessionStorage.setItem('live-seed','1');sessionStorage.setItem('cardspec:conversation:v1',JSON.stringify({messages:[{id:'live',role:'assistant',format:'cardspec',status:'succeeded',phases:[{id:'p',kind:'cardspec',phase:'dsl',status:'succeeded',message:{status:'succeeded',metadata:{format:'cardspec',card_spec:spec}}}]}],toolsEnabled:false}))},spec)
 await page.goto('http://127.0.0.1:8787/');await page.locator('.cs-sandbox').scrollIntoViewIfNeeded();const f=page.frameLocator('.cs-sandbox iframe')
 await expect(f.getByRole('button',{name:'记录本次观察'})).toBeVisible({timeout:15000})
 await page.getByRole('slider',{name:'能量设定'}).fill('55');await expect(f.getByText('55%',{exact:true})).toBeVisible()
 await f.locator('g rect').click();await expect(page.getByRole('slider',{name:'能量设定'})).toHaveValue('65')
 await f.getByRole('button',{name:'记录本次观察'}).press('Enter');await expect(f.locator('strong')).toHaveText('1')
 await page.reload();await page.locator('.cs-sandbox').scrollIntoViewIfNeeded();await expect(f.locator('strong')).toHaveText('1',{timeout:15000});await expect(page.getByRole('slider',{name:'能量设定'})).toHaveValue('65');expect(calls).toEqual([])
 await page.locator('.cs-stage').screenshot({path:`artifacts/sandbox-inline/live-${width}.png`});results.push({width,sharedState:true,localState:true,restored:true,extraModelCalls:calls.length});await page.close()
}}finally{await browser.close()}
writeFileSync('artifacts/sandbox-inline/live-browser.json',JSON.stringify(results,null,2));console.log(results)
