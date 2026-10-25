import {test,expect} from '@playwright/test'
import {mkdirSync,writeFileSync} from 'node:fs'
import {auditLayout} from '../../src/cardspec/layout-audit.js'
const out='artifacts/six-styles/browser';mkdirSync(out,{recursive:true})
for(const family of ['parchment','business','academy'])test(family+' six sizes, core loop and restoration',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('/design-templates.html?preset='+family);const stage=page.locator('.cs-stage')
 for(const size of ['square','auto'])for(const width of [320,360,432]){
  await page.getByLabel('卡片尺寸',{exact:true}).selectOption(size);await page.getByLabel('卡片宽度').selectOption(String(width));await stage.scrollIntoViewIfNeeded();await page.waitForTimeout(300)
  if(family==='parchment'){
   const next=stage.getByRole('button',{name:'后一章',exact:true});if(await next.isDisabled())await stage.getByRole('button',{name:'前一章',exact:true}).click()
   await next.click();const copy=stage.locator('.cs-study-copy p'),before=await copy.innerText(),chapter=await stage.locator('.cs-study-copy h3').innerText();await stage.getByRole('button',{name:'揭开观众视角',exact:true}).click();await expect(copy).not.toHaveText(before);await expect(stage.locator('.cs-study-copy h3')).toHaveText(chapter);await stage.getByRole('button',{name:'返回人物视角',exact:true}).click();await expect(copy).toHaveText(before)
  }else if(family==='business'){
   await stage.getByRole('radio',{name:'本月',exact:true}).click()
   const selected=stage.getByRole('button',{name:'组合 B：-0.8%',exact:true}),next=stage.getByRole('button',{name:'下一组',exact:true})
   if(!(await selected.isVisible()))await next.click();await selected.click();await stage.getByRole('radio',{name:'单日',exact:true}).click();await expect(stage.getByRole('button',{name:'组合 B：0.2%',exact:true})).toHaveAttribute('aria-pressed','true');await stage.getByRole('button',{name:'记录快照'}).click();await expect(stage).toContainText('已记录 b / day')
  }else{
   const show=stage.getByRole('button',{name:'揭示三张牌',exact:true});if(await show.isVisible()){await show.focus();await show.press('Enter')};await page.waitForTimeout(1000)
   await stage.getByRole('button',{name:'星星',exact:true}).click();await expect(stage).toContainText('把下一步缩小到可以开始的程度。')
  }
  await page.waitForTimeout(400);const audit=await stage.evaluate(auditLayout,{noScroll:true});writeFileSync(`${out}/${family}-${width}-${size}.json`,JSON.stringify({...audit,mainVisiblePx:await stage.locator('.cs-composition-body').evaluate(e=>e.clientHeight),horizontalOverflow:audit.issues.some(i=>i.axis==='x'),primaryReachable:audit.controls.every(c=>c.visible&&!c.occluded)},null,2));await stage.screenshot({path:`${out}/${family}-${width}-${size}.png`});expect(audit.issues).toEqual([])
 }
 await page.reload();await expect(stage).toHaveAttribute('data-composition-family',family)
 if(family==='business')await expect(stage).toContainText('已记录 b / day')
 if(family==='academy')await expect(stage.getByRole('button',{name:'星星',exact:true})).toHaveAttribute('aria-pressed','true')
 await page.emulateMedia({reducedMotion:'reduce'});if(family==='academy')expect(await stage.locator('.cs-study-card-inner').first().evaluate(e=>getComputedStyle(e).transitionDuration)).toBe('0s')
 expect(errors).toEqual([])
})
