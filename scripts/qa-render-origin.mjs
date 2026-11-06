import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import {chromium,expect} from '@playwright/test'
import {compileCard} from '../shared/cardspec/compiler.mjs'
const root='artifacts/render-origin-qa'
await fs.mkdir(root,{recursive:true})
const evidence='artifacts/generation-debug/7f2ce2dd-c581-421d-ac5e-1f0707499d41/0a3f3f57a77ea3bf4b9d'
const source=await fs.readFile(evidence+'/candidate.cardspec','utf8')
const result=compileCard(source,{final:true,context:{renderMode:'native',cardSize:'auto',expressionDialect:'js-v1'}})
assert(result.complete,JSON.stringify(result.diagnostics))
await fs.writeFile(root+'/movie.cardspec',source)
await fs.copyFile(evidence+'/normal-432.png',root+'/before-432.png')
const browser=await chromium.launch({channel:'chrome',headless:true})
const ctx=await browser.newContext({viewport:{width:540,height:1000},reducedMotion:'reduce'})
await ctx.tracing.start({screenshots:true,snapshots:true})
const blocked=[]
await ctx.route('**/*',route=>{
 const url=new URL(route.request().url())
 if(url.pathname==='/api/health')return route.fulfill({json:{cardSandbox:true,cardWebSandbox:true}})
 if(url.origin==='http://127.0.0.1:8787'&&(url.pathname==='/card-debug.html'||url.pathname.startsWith('/assets/'))&&route.request().method()==='GET')return route.continue()
 blocked.push(url.pathname);return route.abort()
})
const page=await ctx.newPage(),checks=[]
try{
 await page.goto('http://127.0.0.1:8787/card-debug.html')
 await page.waitForFunction(()=>!!window.cardDebug)
 for(const size of ['square','auto'])for(const width of [320,432]){
  await page.evaluate(({spec,width,size})=>window.cardDebug.mount(spec,{width,size}),{spec:result.spec,width,size})
  await page.getByRole('button',{name:'下一部',exact:true}).waitFor()
  await expect(page.getByRole('button',{name:'下一部',exact:true})).toBeEnabled()
  const frame=await page.locator('.cs-stage').evaluate(el=>({background:getComputedStyle(el).backgroundColor,border:getComputedStyle(el).borderWidth,shadow:getComputedStyle(el).boxShadow,padding:getComputedStyle(el.querySelector('.cs-card')).padding,iframeCount:el.querySelectorAll('iframe').length,scrollWidth:el.scrollWidth,width:el.clientWidth}))
  assert.equal(frame.background,'rgba(0, 0, 0, 0)');assert.equal(frame.shadow,'none');assert.equal(frame.padding,'0px');assert.equal(frame.iframeCount,0);assert(frame.scrollWidth<=frame.width+2)
  await page.getByRole('radio',{name:'影院',exact:true}).click()
  await page.getByLabel('城市',{exact:true}).fill('上海')
  await page.getByRole('button',{name:'下一部',exact:true}).click()
  await expect(page.locator('.nd-caption h3')).toHaveText('DEBUG_SAMPLE_2')
  await page.getByRole('button',{name:'选择对比',exact:true}).click()
  await expect(page.getByRole('button',{name:'选择对比',exact:true})).toHaveAttribute('aria-pressed','true')
  await page.getByRole('button',{name:'看详情 ↗',exact:true}).click()
  await expect(page.locator('.nd-sheet')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.nd-sheet')).toHaveCount(0)
  await page.locator('.cs-shell').screenshot({path:root+`/after-${size}-${width}.png`})
  const before=await page.locator('.nd-view').boundingBox()
  await page.getByRole('button',{name:'标注 CardSpec / Web',exact:true}).click()
  await expect(page.locator('.cs-render-origin-region').filter({hasText:'tool-view · 宿主复合组件'})).toHaveCount(1)
  assert(await page.locator('.cs-render-origin-region').count()>=2)
  await expect(page.locator('.cs-render-origin-region[data-web=true]')).toHaveCount(0)
  assert(!(await page.evaluate(()=>window.cardDebug.snapshot().controls)).some(c=>c.name.includes('标注 CardSpec')))
  assert.deepEqual(await page.locator('.nd-view').boundingBox(),before)
  await page.locator('.cs-tool-card').screenshot({path:root+`/annotated-${size}-${width}.png`})
  // Overlay is non-intercepting: switching the current item still works.
  await page.getByRole('button',{name:'上一部',exact:true}).click()
  await expect(page.locator('.nd-caption h3')).toHaveText('DEBUG_SAMPLE_1')
  checks.push({size,width,frame,interaction:true,annotations:true,annotationChangesLayout:false})
 }
 const multi=JSON.parse(await fs.readFile('artifacts/strict-stack-qa/multi.json','utf8'))
 await page.evaluate(spec=>window.cardDebug.mount(spec,{width:432,size:'auto'}),multi.spec)
 await page.waitForFunction(()=>document.querySelectorAll('.cs-sandbox[data-sandbox-ready=true]').length===2)
 // Inspector remains enabled across remount only if its state was preserved;
 // drive it explicitly via aria-pressed to avoid assuming that lifecycle.
 const toggle=page.getByRole('button',{name:'标注 CardSpec / Web',exact:true})
 if(await toggle.getAttribute('aria-pressed')!=='true')await toggle.click()
 await expect(page.locator('.cs-render-origin-region[data-web=true]')).toHaveCount(2)
 await expect(page.locator('.cs-render-origin-region[data-web=false]')).not.toHaveCount(0)
 await page.locator('.cs-tool-card').screenshot({path:root+'/mixed-annotated.png'})
 const mixed=await page.locator('.cs-stage').evaluate(el=>({padding:getComputedStyle(el.querySelector('.cs-card')).padding,unframed:el.matches('.cs-stage:has(> .cs-card > .nd-view):not(:has(.cs-sandbox,.cs-web-sandbox)):not(:has(.nd-view ~ .nd-view))')}))
 assert.equal(mixed.unframed,false)
 await fs.writeFile(root+'/checks.json',JSON.stringify({sourceEvidence:evidence,movieSandboxCount:0,checks,mixed:{webRegions:2,nativeRegions:true,...mixed},data:'Controlled debug transport; no live CLI invocation',blocked},null,2))
 console.log(JSON.stringify({checks:checks.length,mixed:true}))
}finally{await ctx.tracing.stop({path:root+'/browser-trace.zip'});await browser.close()}
