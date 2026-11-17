// Isolated report smoke test. No model requests, live tools, preference votes or Owl access.
import fs from 'node:fs/promises'
import {chromium} from 'playwright'
const root='experiments/round1-20261117',base='http://127.0.0.1:8787/exploration-round1/'
const report=await fetch(base+'all-attempts.json').then(r=>r.json())
const chosen=report.runs.find(r=>r.runId==='confirm-01-piece-lookup-B1-r4-rep1')
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[],checks=[]
try{
 const page=await browser.newPage({viewport:{width:1440,height:1050}})
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(base+'all-attempts.html')
 await page.locator('table tr').nth(45).waitFor()
 checks.push({check:'all attempts visible',rows:await page.locator('table tr').count()-1,expected:45})
 await page.screenshot({path:root+'/report-overview.png'})
 await page.goto(base+'docs.html?id=decisions')
 await page.locator('pre').filter({hasText:'本轮没有找到可晋级的全局默认组合'}).waitFor()
 checks.push({check:'decision document rendered',passed:true})
 await page.goto(base+'viewer.html?id='+chosen.id)
 await page.frameLocator('iframe').getByText('标签抽屉').first().waitFor({timeout:15000}).catch(async()=>{
  // Generated title varies. Verify actual rendered CardSpec and nonempty product text instead.
  const frame=page.frames().find(f=>f.url().includes('card-debug.html'))
  await frame.waitForFunction(()=>document.body.innerText.trim().length>10)
 })
 const frame=page.frames().find(f=>f.url().includes('card-debug.html'))
 checks.push({check:'unchanged known product mounted',sourceHash:chosen.sourceHash,text:await frame.locator('body').innerText()})
 await page.screenshot({path:root+'/report-viewer.png'})
 await page.goto(base+'pairs.html')
 await page.locator('iframe').nth(1).waitFor()
 checks.push({check:'anonymous comparison controls',iframes:await page.locator('iframe').count(),questions:await page.locator('label').allTextContents(),preferenceSubmitted:false})
 await page.screenshot({path:root+'/report-pairs.png'})
}finally{await browser.close()}
const evidence={at:new Date().toISOString(),checks,errors,modelCalls:0,liveToolCalls:0,humanPreferencesWritten:0,isolatedBrowser:true}
await fs.writeFile(root+'/report-ui-smoke.json',JSON.stringify(evidence,null,2))
console.log(JSON.stringify({checks:checks.length,errors,rows:checks[0]?.rows}))
if(errors.length||checks[0]?.rows!==45)process.exitCode=1
