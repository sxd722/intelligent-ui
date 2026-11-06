import {chromium} from '@playwright/test'
import {readFile,writeFile,copyFile} from 'node:fs/promises'
import {ROOT,DEST} from './engine-v3.mjs'
const errors=[],requests=[],browser=await chromium.launch({channel:'chrome',headless:true})
try{
 const page=await browser.newPage({viewport:{width:1440,height:1050}})
 page.on('pageerror',e=>errors.push(e.message))
 const url='http://127.0.0.1:8787/tool-binding-v3/report.html'
 await page.goto(url);await page.getByRole('heading',{name:'S2 · 原20需求＋8绑定挑战'}).waitFor()
 for(const path of ['report.html','report.md','summary.json','live-slots.json','movies-A2S-trace.json','../tool-binding-s2/01-movies-A2S-1-trace.json','../tool-binding-s2/01-movies-A2S-1-432-square.png']){
  const r=await page.request.get(new URL(path,url).href);requests.push({path,status:r.status()});if(!r.ok())errors.push(path+' HTTP '+r.status())
 }
 const count=await page.locator('textarea').count();if(count!==128)errors.push('Missing feedback rows: '+count)
 await page.locator('textarea').first().fill('验证反馈保存');await page.reload();if(await page.locator('textarea').first().inputValue()!=='验证反馈保存')errors.push('Feedback not restored')
 await page.locator('textarea').first().fill('')
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:ROOT+'/report-overview.png'});await copyFile(ROOT+'/report-overview.png',DEST+'/report-overview.png')
 const result={passed:!errors.length,feedbackRows:count,errors,requests,screenshot:'report-overview.png',checkedAt:new Date().toISOString()};await writeFile(ROOT+'/report-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result))
 if(errors.length)process.exitCode=1
}finally{await browser.close()}
