import {test,expect} from '@playwright/test'
import {mkdirSync} from 'node:fs'
import {DESIGNS} from '../../shared/cardspec/designs.mjs'
mkdirSync('artifacts/design-recipes-qa',{recursive:true})
test.beforeEach(async({page})=>{
 // Never contact the live tool service or touch its browser binding.
 await page.route('**/api/**',route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}))
 await page.goto('/cardspec-lab.html?fixture=counter')
})
for(const design of Object.keys(DESIGNS))test(`${design}: both sizes, three widths, retained input and contrast`,async({page})=>{
 const stage=page.locator('.cs-stage')
 await page.getByLabel('设计配方',{exact:true}).selectOption(design)
 await expect(stage).toHaveAttribute('data-design',design)
 for(const size of ['square','auto'])for(const width of ['320','360','432']){
  await page.getByLabel('卡片尺寸',{exact:true}).selectOption(size)
  await page.getByLabel('宽度',{exact:true}).selectOption(width)
  await expect(stage).toHaveAttribute('data-cs-fit','fit')
  const geometry=await stage.evaluate(el=>({w:el.clientWidth,h:el.clientHeight,overflow:el.scrollWidth-el.clientWidth,inner:el.querySelector('.cs-card').scrollWidth-el.querySelector('.cs-card').clientWidth}))
  expect(geometry.overflow).toBeLessThanOrEqual(1);expect(geometry.inner).toBeLessThanOrEqual(1)
  if(size==='square')expect(Math.abs(geometry.w-geometry.h)).toBeLessThanOrEqual(1)
  await expect(page.locator('[data-cs-error]')).toHaveCount(0)
 }
 const input=stage.locator('input').first()
 await input.fill('保留输入')
 await page.getByLabel('设计配方',{exact:true}).selectOption('inherit')
 await expect(input).toHaveValue('保留输入')
 await expect(stage).not.toHaveAttribute('data-design')
 await page.getByLabel('设计配方',{exact:true}).selectOption(design)
 await expect(input).toHaveValue('保留输入')
 // Actual primary-button foreground/background contrast, not just palette hexes.
 const contrast=await stage.locator('.cs-button[data-variant=primary]').first().evaluate(el=>{
  const c=document.createElement('canvas').getContext('2d');const lum=s=>{c.clearRect(0,0,1,1);c.fillStyle=s;c.fillRect(0,0,1,1);return [...c.getImageData(0,0,1,1).data].slice(0,3).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0)}
  const s=getComputedStyle(el),a=lum(s.color),b=lum(s.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)
 })
 expect(contrast).toBeGreaterThanOrEqual(4.5)
 await page.getByLabel('卡片尺寸',{exact:true}).selectOption('square')
 await stage.screenshot({path:`artifacts/design-recipes-qa/${design}.png`})
})
test('iframe consumes the same resolved design colors, radius and typography',async({page})=>{
 await page.getByLabel('设计配方',{exact:true}).selectOption('editorial')
 const expected=await page.evaluate(async()=>{
  const {readDesignEnvironment}=await import('/src/cardspec/design-environment.js')
  const {sandboxDocument}=await import('/src/cardspec/sandbox-document.mjs')
  const theme=readDesignEnvironment(document.querySelector('.cs-stage'))
  const iframe=document.createElement('iframe');iframe.id='theme-test';iframe.setAttribute('sandbox','allow-scripts');iframe.srcdoc=sandboxDocument('','theme-test');document.body.append(iframe)
  await new Promise(resolve=>iframe.onload=resolve)
  iframe.contentWindow.postMessage({sandbox:'theme-test',type:'environment',theme,active:true},'*')
  return theme
 })
 const frame=page.frameLocator('#theme-test')
 await expect.poll(()=>frame.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--cs-radius'))).toBe(expected['--cs-radius'])
 for(const name of ['--cs-ink','--cs-accent','--cs-title-size','--font-title'])expect(await frame.locator('html').evaluate((el,n)=>getComputedStyle(el).getPropertyValue(n),name)).toBe(expected[name])
 expect(await frame.locator('body').evaluate(el=>getComputedStyle(el).fontFamily)).toBe(expected.font)
})
