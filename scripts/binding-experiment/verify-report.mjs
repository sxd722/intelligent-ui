import {chromium} from '@playwright/test'
import {writeFile,copyFile} from 'node:fs/promises'
const dir='artifacts/tool-binding-qa/deepseek-v4-flash-20261102-v2'
const browser=await chromium.launch({channel:'chrome',headless:true})
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 const response=await page.goto('http://127.0.0.1:8787/tool-binding-qa/report.html')
 await page.getByRole('heading',{name:'内容质量门控：当前各组均未达标'}).waitFor()
 const links=await page.locator('a[href]').evaluateAll(xs=>[...new Set(xs.map(x=>x.href))])
 const failures=[]
 for(const url of links.filter(x=>!x.includes('viewer.html'))){const r=await page.request.get(url);if(!r.ok())failures.push({url,status:r.status()})}
 await page.screenshot({path:dir+'/report-preview.png'})
 await copyFile(dir+'/report-preview.png','dist/tool-binding-qa/report-preview.png')
 const result={status:response.status(),linksChecked:links.filter(x=>!x.includes('viewer.html')).length,failures,pageErrors:errors}
 await writeFile(dir+'/report-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result))
 if(failures.length||errors.length)process.exitCode=1
}finally{await browser.close()}
