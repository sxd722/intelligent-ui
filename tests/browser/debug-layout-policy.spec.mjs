import {test,expect} from '@playwright/test'
import {auditLayout} from '../../src/cardspec/layout-audit.js'
import {installDebugRandom} from '../../server/cardspec/debug-random.mjs'

for(const width of [320,432])test(`bounded scroll vs clipping at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:800})
 await page.setContent(`<style>body{margin:0;font:16px/24px sans-serif}.surface{width:280px;height:150px}.region{height:80px;overflow:auto}.long{height:250px}button{height:44px}</style><div class="surface"><div class="region"><div class="long">完整内容</div><button>滚动可达操作</button></div></div>`)
 const audit=options=>page.locator('.surface').evaluate(auditLayout,options)
 expect((await audit({allowCssScroll:true})).issues).toEqual([])
 await page.locator('.surface').evaluate(el=>el.style.overflow='hidden')
 expect((await audit({allowCssScroll:true})).issues).toEqual([])
 expect((await audit({})).issues.some(i=>i.code==='internal-overflow')).toBe(true)
 expect((await audit({allowCssScroll:true,noScroll:true})).issues.some(i=>i.code==='internal-overflow')).toBe(true)
 await page.locator('.region').evaluate(el=>el.style.overflow='hidden')
 const clipped=await audit({allowCssScroll:true})
 expect(clipped.issues.some(i=>i.code==='clipped-content')).toBe(true)
 expect(clipped.issues.some(i=>i.code==='control-not-fully-visible')).toBe(true)
 await page.locator('.region').evaluate(el=>{el.style.overflow='auto';el.style.height='12px'})
 expect((await audit({allowCssScroll:true})).issues.some(i=>i.code==='internal-overflow')).toBe(true)
})

test('fixed seed repeats in child frames across reload',async({browser})=>{
 const context=await browser.newContext()
 await context.addInitScript(installDebugRandom,73129)
 const page=await context.newPage();await page.goto('/cardspec-lab.html')
 const draw=()=>page.evaluate(async()=>{const f=document.createElement('iframe');f.srcdoc='<script>document.body.dataset.draw=JSON.stringify(Array.from({length:8},()=>Math.random()))<\/script><body></body>';document.body.append(f);await new Promise(r=>f.onload=r);return f.contentWindow.Math.random()})
 // The init script also runs before opaque production sandbox scripts.
 const a=await draw();const b=await draw();expect(a).toBe(b)
 await page.reload();expect(await draw()).toBe(a)
 await context.close()
})
