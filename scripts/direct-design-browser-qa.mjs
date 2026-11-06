import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {chromium} from '@playwright/test'
const root='artifacts/direct-image-qa',web='dist/direct-image-qa'
await fs.mkdir(web+'/runs',{recursive:true})
await build({entryPoints:['scripts/native-golden/viewer.jsx'],outfile:web+'/viewer.js',bundle:true,jsx:'automatic',format:'esm',platform:'browser',define:{'process.env.NODE_ENV':'"production"'},loader:{'.woff2':'file','.ttf':'file','.woff':'file','.png':'file'},logLevel:'error'})
await fs.writeFile(web+'/viewer.html','<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Direct image QA</title><link rel="stylesheet" href="viewer.css"><style>body{margin:0;background:#e8edf3;font-family:system-ui}.qa-toolbar{display:flex;gap:8px;justify-content:center;padding:16px;flex-wrap:wrap}.qa-prompt{margin:20px auto;max-width:650px}</style><div id="root"></div><script type="module" src="viewer.js"></script></html>')
for(const profile of ['deepseek-flash','gpt-instant','default'])await fs.copyFile(root+'/live-'+profile+'.json',web+'/runs/'+profile+'.json')
const browser=await chromium.launch({channel:'chrome',headless:true}),ctx=await browser.newContext({viewport:{width:800,height:900}}),page=await ctx.newPage(),checks=[],errors=[]
page.on('pageerror',e=>errors.push(e.message));await ctx.tracing.start({screenshots:true,snapshots:true})
try{for(const profile of ['deepseek-flash','gpt-instant','default']){
 try{
  await page.goto('http://127.0.0.1:8787/direct-image-qa/viewer.html?id='+profile);await page.waitForFunction(()=>!!window.qaSession)
  await page.locator('.cs-mock-composition').waitFor();await page.waitForTimeout(300)
  const before=await page.evaluate(()=>window.qaSession.current().store.values)
  const click=page.locator('button').filter({hasText:'夜晚'}).or(page.locator('button[aria-label*="夜晚"]')).first();await click.click();await page.waitForTimeout(250)
  const after=await page.evaluate(()=>window.qaSession.current().store.values);assert.notDeepEqual(after,before);assert(Object.values(after).includes('night'))
  await page.screenshot({path:root+'/'+profile+'-night.png'});const audit=await page.evaluate(()=>window.qaAudit())
  await page.evaluate(()=>window.qaSession.save());await page.reload();await page.waitForFunction(()=>!!window.qaSession)
  assert.deepEqual(await page.evaluate(()=>window.qaSession.current().store.values),after)
  assert.equal(await page.evaluate(()=>window.qaCalls.length),0)
  const sizes={}
  for(const width of ['320','432']){await page.getByLabel('验收宽度').selectOption(width);await page.waitForTimeout(200);sizes[width]=await page.evaluate(()=>window.qaAudit());await page.screenshot({path:root+'/'+profile+'-'+width+'.png'})}
  checks.push({profile,interaction:true,restoration:true,modelCallsOnInteraction:0,audit,sizes})
 }catch(e){checks.push({profile,interaction:false,error:e.message});console.log('FAIL',profile,e.message)}
}}finally{await ctx.tracing.stop({path:root+'/browser-trace.zip'});await browser.close()}
await fs.writeFile(root+'/browser-checks.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}))
if(checks.some(c=>!c.interaction)||errors.length)process.exitCode=1

