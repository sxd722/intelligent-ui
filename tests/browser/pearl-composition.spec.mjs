import {test,expect} from '@playwright/test'
import {mkdirSync,writeFileSync} from 'node:fs'
import {auditLayout} from '../../src/cardspec/layout-audit.js'
const out='artifacts/pearl-composition';mkdirSync(out,{recursive:true})
const measure=async locator=>locator.evaluate(auditLayout,{noScroll:true})
// Bridge requires real browser gestures; range.fill dispatches synthetic input.
async function adjust(slider,value){
 await slider.focus()
 if(value===0||value===100){await slider.press(value===0?'Home':'End');await expect(slider).toHaveValue(String(value));return}
 let current=Number(await slider.inputValue())
 while(current!==value){await slider.press(current<value?'ArrowRight':'ArrowLeft');current+=current<value?1:-1;await expect(slider).toHaveValue(String(current))}
}
test.beforeEach(async({page})=>{await page.route('**/api/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({cardSandbox:true})}))})
for(const size of ['square','auto'])for(const width of [320,360,432])test(`whole Pearl ${width} ${size}: visible controls, feedback and restoration`,async({page})=>{
 const errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/invoke'))calls.push(r.url())})
 await page.goto('/pearl-review.html');await page.getByLabel('宽度',{exact:true}).selectOption(String(width));await page.getByLabel('尺寸',{exact:true}).selectOption(size)
 const stage=page.locator('.pearl-reference .cs-stage'),frame=page.frameLocator('iframe[title="Pearl 整卡样板"]')
 await expect(frame.getByRole('slider',{name:'储能比例'})).toBeVisible({timeout:15000});await stage.scrollIntoViewIfNeeded()
 await expect(frame.getByLabel('已储能 40%',{exact:true})).toBeVisible()
 const before=await measure(frame.locator('html'));expect(before.issues).toEqual([])
 expect(before.controls.filter(c=>['input','button.pearl-save'].includes(c.element)).every(c=>c.height>=44)).toBe(true)
 await stage.screenshot({path:`${out}/${width}-${size}-initial.png`})
 await adjust(frame.getByRole('slider'),64);await expect(frame.getByText('剩余 36%',{exact:true})).toBeVisible()
 await frame.getByRole('button',{name:'保存当前方案 ↗'}).click();await expect(frame.getByRole('status')).toHaveText('已保存 64%')
 const after=await measure(frame.locator('html'));expect(after.issues).toEqual([])
 expect((await measure(stage)).issues).toEqual([])
 await stage.screenshot({path:`${out}/${width}-${size}-saved.png`})
 await expect.poll(()=>page.locator('.pearl-reference .cs-sandbox').getAttribute('data-layout-audit')).toContain('pearl-save')
 await expect.poll(async()=>JSON.parse(await page.locator('.pr-diagnostics pre').textContent()).reference.controls.some(c=>c.element.includes('/ iframe /'))).toBe(true)
 await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('cardspec:pearl-reference:v1')?.includes('"saved":64'))).toBe(true)
 await page.reload();await expect(frame.getByRole('status')).toHaveText('已保存 64%',{timeout:15000})
 await page.getByLabel('视图',{exact:true}).selectOption('native');await expect(stage.getByRole('slider')).toHaveValue('64')
 await stage.getByRole('slider').fill('23');await stage.getByRole('button',{name:'保存当前方案',exact:true}).click();await expect(stage).toContainText('已保存 23%')
 await page.getByLabel('视图',{exact:true}).selectOption('hybrid');await expect(frame.getByRole('status')).toHaveText('已保存 23%',{timeout:15000})
 for(const n of [0,100]){await adjust(frame.getByRole('slider'),n);await expect(frame.getByText(`剩余 ${100-n}%`,{exact:true})).toBeVisible()}
 expect(errors).toEqual([]);expect(calls).toEqual([])
 writeFileSync(`${out}/${width}-${size}.json`,JSON.stringify({width,size,before,after,errors,calls},null,2))
})
test('old Pearl reports nested overflow at 432 and 320 without declaring outer emergency',async({page})=>{
 await page.goto('/pearl-review.html');const evidence=[]
 for(const width of [432,320]){
  await page.getByLabel('宽度',{exact:true}).selectOption(String(width))
  await expect.poll(async()=>JSON.parse(await page.locator('.pr-diagnostics pre').textContent()).original?.containers.some(c=>c.element==='卡片内容'&&c.overflow>0)).toBe(true)
  const metrics=JSON.parse(await page.locator('.pr-diagnostics pre').textContent()).original
  expect(metrics.overflow).toBeGreaterThan(0);expect(metrics.pass).toBe(false)
  evidence.push({width,...metrics});await page.locator('.pearl-original .cs-stage').screenshot({path:`${out}/old-${width}.png`})
 }
 writeFileSync(`${out}/old-overflow.json`,JSON.stringify(evidence,null,2))
})
test('audit catches 294/311, 206/311, hidden clipping and overlapping controls; allowed scrolling remains reported',async({page})=>{
 await page.goto('/pearl-review.html');await page.evaluate(()=>{const e=document.createElement('div');e.id='audit-fixture';e.style='position:fixed;top:10px;left:10px;width:320px;background:white;z-index:99999';e.innerHTML='<div id="inner" style="height:294px;overflow:auto"><div style="height:311px"><button style="height:44px">start</button><button style="display:block;margin-top:220px;height:44px">end</button></div></div>';document.body.append(e)})
 const root=page.locator('#audit-fixture'),records=[]
 for(const height of [294,206]){await page.locator('#inner').evaluate((e,h)=>e.style.height=h+'px',height);const d=await measure(root);expect(d.containers).toEqual(expect.arrayContaining([expect.objectContaining({element:'inner',available:height,demand:311,overflow:311-height})]));expect(d.issues.some(i=>i.code==='control-not-fully-visible')).toBe(true);records.push(d)}
 await page.locator('#inner').evaluate(e=>e.style.overflow='hidden');expect((await measure(root)).issues.some(i=>i.code==='clipped-content')).toBe(true)
 await page.locator('#inner').evaluate(e=>e.style.height='0px');expect((await measure(root)).issues.some(i=>i.code==='clipped-content')).toBe(true)
 await page.locator('#inner').evaluate(e=>e.style.height='206px')
 await page.locator('#inner').evaluate(e=>{e.style.overflow='auto';e.setAttribute('data-layout-scroll','allow')})
 const allowed=await root.evaluate(auditLayout);expect(allowed.containers.some(c=>c.allowed)).toBe(true)
 await root.evaluate(e=>{const overlay=document.createElement('div');overlay.style='position:absolute;inset:0;background:gray';e.append(overlay)});expect((await measure(root)).issues.some(i=>i.code==='control-occluded')).toBe(true)
 writeFileSync(`${out}/synthetic-overflow.json`,JSON.stringify(records,null,2))
})
test('sandbox motion follows reduced motion and no network permissions are added',async({page})=>{
 await page.goto('/pearl-review.html');const f=page.frameLocator('iframe[title="Pearl 整卡样板"]');await expect(f.locator('.pearl-orbit')).toBeVisible()
 await expect(page.locator('.pearl-reference iframe')).toHaveAttribute('sandbox','allow-scripts')
 await page.emulateMedia({reducedMotion:'reduce'});expect(await f.locator('.pearl-orbit').evaluate(e=>getComputedStyle(e).animationName)).toBe('none')
})



