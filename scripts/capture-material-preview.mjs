import {chromium} from '@playwright/test'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
const dir='artifacts/material-motion-qa/preview-video';await mkdir(dir,{recursive:true})
const credits=JSON.parse(await readFile('artifacts/material-motion-qa/photo-credits.json','utf8'))
const browser=await chromium.launch({channel:'chrome',headless:true})
try{
 const context=await browser.newContext({viewport:{width:520,height:650},recordVideo:{dir,size:{width:520,height:650}}})
 const page=await context.newPage()
 await page.route('**/api/**',async route=>{const u=new URL(route.request().url());if(u.pathname==='/api/image'){const seed=u.searchParams.get('seed')||'',p=credits[/forest/i.test(seed)?'forest':/mountain/i.test(seed)?'mountain':'lake'];return route.fulfill({contentType:'image/jpeg',body:await readFile('.cache/pexels/'+p.content.split('/').pop())})}return route.fulfill({contentType:'application/json',body:'{}'})})
 await page.goto('http://127.0.0.1:8787/cardspec-lab.html?fixture=materials')
 const stage=page.locator('.cs-stage');await stage.scrollIntoViewIfNeeded()
 // Presentation-only crop; source and card geometry are unchanged.
 await page.evaluate(()=>{document.querySelector('main').style.padding='0';document.querySelector('.cs-shell').scrollIntoView({block:'center'})})
 await page.waitForTimeout(6500)
 await stage.locator('.cs-carousel-nav button').last().click();await page.waitForTimeout(1200)
 await stage.getByRole('button',{name:'加入周末灵感',exact:true}).click();await page.waitForTimeout(6500)
 const video=page.video();await context.close();await writeFile(dir+'/record.json',JSON.stringify({path:await video.path(),network:'mock image responses from existing local Pexels cache; all other API calls intercepted'}))
}finally{await browser.close()}
