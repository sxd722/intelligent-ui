import {chromium} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import {auditLayout} from '../src/cardspec/layout-audit.js'
const out='artifacts/composition-v2';await mkdir(out,{recursive:true})
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[]
try{
 const page=await browser.newPage({viewport:{width:1200,height:1000}})
 await page.goto('http://127.0.0.1:8787/design-templates.html')
 for(const width of [432,320,360]){
  await page.getByLabel('卡片宽度').selectOption(String(width));await page.waitForTimeout(600)
  for(const family of ['pearl','atlas','rebel','default']){
   const stage=page.locator(`.cs-stage[data-composition-family="${family}"]`);await stage.scrollIntoViewIfNeeded();await page.waitForTimeout(200)
   const audit=await stage.evaluate(auditLayout,{noScroll:true}),dimensions=await stage.evaluate(el=>[...el.querySelectorAll('.cs-composition-body,.cs-composition-controls,.cs-composition-actions')].map(x=>({class:x.className,client:x.clientHeight,scroll:x.scrollHeight})))
   await stage.screenshot({path:`${out}/${family}-${width}.png`})
   results.push({family,width,pass:audit.pass,issues:audit.issues,dimensions,text:await stage.innerText()})
  }
 }
 await writeFile(out+'/initial.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results.map(({family,width,pass,issues,dimensions})=>({family,width,pass,issues,dimensions})),null,2))
}finally{await browser.close()}
