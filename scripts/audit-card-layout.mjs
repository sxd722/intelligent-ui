// Run against an existing local app. Opens an isolated Chrome profile, never Owl.
// node scripts/audit-card-layout.mjs --url http://127.0.0.1:8787/pearl-review.html --selector .pearl-reference --no-scroll
import {chromium} from '@playwright/test'
import {writeFile,mkdir} from 'node:fs/promises'
import {auditLayout} from '../src/cardspec/layout-audit.js'
const args=process.argv.slice(2),get=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback
const url=get('--url','http://127.0.0.1:8787/pearl-review.html'),selector=get('--selector','.cs-stage'),noScroll=args.includes('--no-scroll'),output=get('--output','artifacts/layout-audit.json')
const browser=await chromium.launch({channel:'chrome',headless:true})
try{
 const page=await browser.newPage({viewport:{width:1100,height:1000}})
 await page.goto(url);await page.locator(selector).first().waitFor()
 await page.waitForTimeout(1500)
 const records=[]
 for(const el of await page.locator(selector).all()){
  await el.scrollIntoViewIfNeeded();const root=await el.evaluate(auditLayout,{noScroll});records.push({scope:'host',...root})
  for(const handle of await el.locator('iframe').elementHandles()){
   const frame=await handle.contentFrame();if(frame)records.push({scope:'sandbox',...await frame.locator('html').evaluate(auditLayout,{noScroll})})
  }
 }
 await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true})
 await writeFile(output,JSON.stringify({url,selector,noScroll,at:new Date().toISOString(),records},null,2))
 console.log(JSON.stringify({output,pass:records.every(r=>r.pass),issues:records.reduce((n,r)=>n+r.issues.length,0)}))
 if(records.some(r=>!r.pass))process.exitCode=1
}finally{await browser.close()}
