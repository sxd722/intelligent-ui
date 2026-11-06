import {test,expect} from '@playwright/test'
import {mkdirSync} from 'node:fs'
mkdirSync('artifacts/svg-readability-qa',{recursive:true})
for(const runtime of ['strict','web'])for(const design of ['academy','pearl','rebel','default','atlas'])test(`${runtime} ${design}: surface, type and author overrides`,async({page})=>{
 await page.goto('/cardspec-lab.html', {waitUntil:'domcontentloaded'})
 const theme=await page.evaluate(async({runtime,design})=>{
  const {DESIGNS}=await import('/shared/cardspec/designs.mjs')
  const {readDesignEnvironment}=await import('/src/cardspec/design-environment.js')
  const {sandboxDocument}=await import('/src/cardspec/sandbox-document.mjs')
  const {webDocument}=await import('/src/cardspec/web-document.mjs')
  document.body.innerHTML='<div id="host"></div>'
  const host=document.querySelector('#host');for(const [k,v]of Object.entries(DESIGNS[design].tokens))host.style.setProperty(k,v)
  const theme=readDesignEnvironment(host)
  const markup='<svg viewBox="0 0 320 160"><text x="20" y="40">计算舞台 · 清晰标签</text><rect x="20" y="65" width="280" height="40" rx="12" fill="var(--cs-accent)"/></svg><svg style="background:white" fill="#111" viewBox="0 0 320 70"><text x="20" y="38" font-size="18">Explicit light surface</text></svg><svg style="background:transparent" fill="none" viewBox="0 0 320 20"></svg>'
  const iframe=document.createElement('iframe');iframe.id='graphic';iframe.style.cssText='width:320px;height:290px;border:0';iframe.sandbox='allow-scripts'
  let doc=runtime==='strict'?sandboxDocument('','graphics'):webDocument({kind:'web',code:''},'graphics')
  doc=doc.replace('<div id="root"></div>','<div id="root">'+markup+'</div>');iframe.srcdoc=doc;host.append(iframe)
  await new Promise(resolve=>iframe.onload=resolve)
  iframe.contentWindow.postMessage({sandbox:'graphics',web:'graphics',type:'environment',theme,active:true},'*')
  return theme
 },{runtime,design})
 const frame=page.frameLocator('#graphic')
 await expect.poll(()=>frame.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--cs-base'))).toBe(theme['--cs-base'])
 for(const width of [320,432]){
  await page.locator('#graphic').evaluate((el,w)=>el.style.width=w+'px',width)
  const colors=await frame.locator('svg').first().evaluate(el=>{
   const c=document.createElement('canvas').getContext('2d');function lum(s){c.fillStyle=s;c.fillRect(0,0,1,1);return [...c.getImageData(0,0,1,1).data].slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0)}
   const s=getComputedStyle(el),t=getComputedStyle(el.querySelector('text')),a=lum(s.backgroundColor),b=lum(t.fill)
   return {bg:s.backgroundColor,font:t.fontSize,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)}
  })
  expect(colors.bg).toBe(theme['--cs-graphic-surface']);expect(colors.contrast).toBeGreaterThanOrEqual(4.5);expect(colors.font).toBe('16px')
  await page.locator('#graphic').screenshot({path:`artifacts/svg-readability-qa/${runtime}-${design}-${width}.png`})
 }
 await expect(frame.locator('svg').nth(1)).toHaveCSS('background-color','rgb(255, 255, 255)')
 await expect(frame.locator('svg').nth(1).locator('text')).toHaveCSS('fill','rgb(17, 17, 17)')
 await expect(frame.locator('svg').nth(1).locator('text')).toHaveCSS('font-size','18px')
 await expect(frame.locator('svg').nth(2)).toHaveCSS('fill','none')
 await expect(frame.locator('svg').nth(2)).toHaveCSS('background-color','rgba(0, 0, 0, 0)')
})
