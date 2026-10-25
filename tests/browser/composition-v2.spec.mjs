import {test,expect} from '@playwright/test'
import {mkdirSync,writeFileSync} from 'node:fs'
import {auditLayout} from '../../src/cardspec/layout-audit.js'
import {compileCard} from '../../shared/cardspec/compiler.mjs'
const out=process.env.COMPOSITION_EVIDENCE_DIR||'artifacts/composition-v2/browser';mkdirSync(out,{recursive:true})
for(const family of ['pearl','atlas','rebel','default'])test(`${family}: six sizes, core loop, recovery and no internal scroll`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('/design-templates.html?preset='+family)
 const stage=page.locator('.cs-stage[data-composition-version="2"]')
 for(const size of ['square','auto'])for(const width of [320,360,432]){
  await page.getByLabel('卡片尺寸',{exact:true}).selectOption(size);await page.getByLabel('卡片宽度').selectOption(String(width));await stage.scrollIntoViewIfNeeded();await page.waitForTimeout(400)
  if(family==='atlas'){
   const target=stage.getByRole('button',{name:'雨 / d₃：0.4',exact:true})
   for(let n=0;n<4&&!(await target.count());n++)await stage.getByRole('button',{name:'后组',exact:true}).click()
   await target.click();await stage.getByRole('button',{name:'观察残差更新',exact:true}).click()
   await expect(stage.getByRole('button',{name:'雨 / d₃：0.5',exact:true})).toHaveAttribute('aria-pressed','true');await expect(stage).toContainText('雨 / d3 · 0.5')
   await stage.getByRole('button',{name:'返回输入表示',exact:true}).click()
  }else if(family==='rebel'){
   const target=stage.getByRole('button',{name:/脉冲俱乐部/})
   for(let n=0;n<3&&!(await target.count());n++)await stage.getByRole('button',{name:'下一组',exact:true}).click()
   await target.click();await stage.getByRole('button',{name:'加入我的行程',exact:true}).click();await expect(stage).toContainText('已保存：脉冲俱乐部')
  }else{
   await stage.getByRole('slider').fill('61');await stage.getByRole('button',{name:'保存当前方案',exact:true}).click();await expect(stage).toContainText('已保存 61%')
  }
  await page.waitForTimeout(250);const audit=await stage.evaluate(auditLayout,{noScroll:true});expect(audit.issues).toEqual([])
  await stage.screenshot({path:`${out}/${family}-${width}-${size}.png`});writeFileSync(`${out}/${family}-${width}-${size}.json`,JSON.stringify(audit,null,2))
 }
 await page.waitForTimeout(150);await page.reload();await expect(stage).toHaveAttribute('data-composition-family',family)
 if(family==='atlas')await expect(stage).toContainText('雨 / d3 · 0.4')
 else await expect(stage).toContainText(family==='rebel'?'已保存：脉冲俱乐部':'已保存 61%')
 expect(errors).toEqual([])
})
test('host capability error is retryable and never masquerades as a native-only policy',async({page})=>{
 let attempts=0;await page.route('**/api/health',route=>{attempts++;return route.fulfill({status:attempts===1?503:200,contentType:'application/json',body:JSON.stringify({cardSandbox:true})})})
 await page.goto('/');await expect(page.getByRole('button',{name:'重试能力检测'})).toBeVisible();await expect(page.getByLabel('UI能力',{exact:true})).toBeDisabled()
 await page.getByRole('button',{name:'重试能力检测'}).click();await expect(page.getByLabel('UI能力',{exact:true})).toBeEnabled();await page.getByLabel('UI能力',{exact:true}).selectOption('hybrid')
 await expect(page.getByLabel('UI能力',{exact:true})).toHaveValue('hybrid')
})
test('resolved photo crop and mask are independent; image failure retains controls and persisted design',async({page})=>{
 const spec=compileCard('<card design="pearl" visualStyle="photo-glass" backgroundQuery="night light" backgroundPosition="right" backgroundMask="fade-left"><state id="n" type="number" initial={0}/><title>光的实验</title><stat label="已调整" value={state.n}/><button onPress="inc">调整</button><action id="inc"><increment target="n"/></action></card>',{final:true}).spec
 let failed=false,queries=0
 await page.route('**/api/photo?*',r=>{queries++;return r.fulfill({contentType:'application/json',body:JSON.stringify({url:'/api/media/'+'a'.repeat(64)+'.jpg',status:'loaded',provider:'Pexels',photographer:'测试摄影师',photographerUrl:'https://www.pexels.com',avgColor:'#284966'})})})
 await page.route('**/api/media/*.jpg',r=>failed?r.abort():r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#54677b"/></svg>'}))
 await page.goto('/card-debug.html');await page.waitForFunction(()=>!!window.cardDebug)
 await page.evaluate(spec=>window.cardDebug.mount(spec,{width:320}),spec)
 await expect(page.locator('.cs-photo-stage')).toHaveAttribute('data-status','loaded')
 expect(await page.locator('.cs-photo-stage img').evaluate(e=>getComputedStyle(e).objectPosition)).toBe('75% 35%')
 await expect(page.locator('.cs-photo-stage')).toHaveAttribute('data-mask','fade-left')
 await page.getByRole('button',{name:'调整',exact:true}).click();await page.waitForTimeout(150);await page.evaluate(()=>window.cardDebug.save())
 const saved=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('debug-only')).pages[0].viewState.designSelection);expect(saved.crop).toBe('right');expect(saved.mask).toBe('fade-left')
 failed=true;await page.reload();await page.waitForFunction(()=>!!window.cardDebug);await page.evaluate(spec=>window.cardDebug.mount(spec,{width:320,restore:true}),spec)
 await expect(page.locator('.cs-photo-stage')).toHaveAttribute('data-status','error')
 await page.getByRole('button',{name:'调整',exact:true}).click();expect((await page.evaluate(()=>window.cardDebug.snapshot())).state.n).toBe(2)
 expect((await page.locator('.cs-stage').evaluate(auditLayout,{noScroll:true})).issues).toEqual([])
 expect(queries).toBe(1)
})
