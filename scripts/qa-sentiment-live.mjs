import {chromium} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const base='http://127.0.0.1:8787',dir='artifacts/sentiment-fallback';await mkdir(dir,{recursive:true})
const before=await(await fetch(base+'/api/tools/connections')).json()
const browser=await chromium.launch({channel:'chrome',headless:true}),result={mode:'live CLI + live GLM',at:new Date().toISOString()}
try{
 const context=await browser.newContext({viewport:{width:700,height:900}}),page=await context.newPage(),errors=[]
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(120000)
 await context.tracing.start({screenshots:true,snapshots:true})
 await page.goto(`${base}/h5-baseline/index.html?case=sentiment&width=360&size=square`)
 const f=page.frameLocator('iframe')
 await f.getByRole('button',{name:'搜索新闻与用户反馈',exact:true}).click()
 await f.getByRole('button',{name:'AI 分析车辆态度',exact:true}).waitFor()
 await f.getByRole('button',{name:'AI 分析车辆态度',exact:true}).click()
 await f.getByRole('button',{name:'重新标注样本',exact:true}).waitFor()
 await page.locator('iframe').screenshot({path:`${dir}/live-overview.png`})
 result.metrics=await f.locator('.attitude-metrics').innerText()
 await f.getByRole('button',{name:'时间走势',exact:true}).click();assert.ok(await f.locator('.timeline-chart>button').count()>0)
 await page.locator('iframe').screenshot({path:`${dir}/live-timeline.png`})
 await f.locator('.timeline-chart>button').first().click();await f.locator('.result-row').first().click();await f.locator('.quote').waitFor()
 result.evidence=await f.getByRole('dialog').innerText();await page.locator('iframe').screenshot({path:`${dir}/live-evidence.png`})
 await f.getByRole('button',{name:'关闭面板'}).click();await f.getByRole('button',{name:'态度概览',exact:true}).click()
 result.storage=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('rsi-h5:'))))
 result.errors=errors;assert.deepEqual(errors,[]);result.passed=true
 await context.tracing.stop({path:`${dir}/live-ui.zip`})
}catch(e){result.passed=false;result.error=e.message;console.error(e.message)}finally{await browser.close()}
const after=await(await fetch(base+'/api/tools/connections')).json();result.connectionPreserved=before.browser?.binding?.session===after.browser?.binding?.session&&before.browser?.daemonPid===after.browser?.daemonPid
await writeFile(`${dir}/ui-live.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,metrics:result.metrics,error:result.error,connectionPreserved:result.connectionPreserved}))
if(!result.passed)process.exitCode=1
