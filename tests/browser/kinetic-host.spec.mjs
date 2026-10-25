import {test,expect} from '@playwright/test'
import {mkdirSync} from 'node:fs'
const out='artifacts/kinetic-host';mkdirSync(out,{recursive:true})
test.beforeEach(async({page})=>{await page.route('**/api/**',r=>r.fulfill({contentType:'application/json',body:'{}'}))})
for(const id of ['kineticPearl','kineticAtlas','kineticRebel'])test(`${id}: six layouts, native interactions and material state preservation`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/cardspec-lab.html?fixture='+id)
 const stage=page.locator('.cs-stage');await expect(stage).toHaveAttribute('data-composition','visual')
 for(const size of ['square','auto'])for(const width of ['320','360','432']){
  await page.getByLabel('卡片尺寸',{exact:true}).selectOption(size);await page.getByLabel('宽度',{exact:true}).selectOption(width)
  await stage.scrollIntoViewIfNeeded();await expect(stage.locator('[data-cs-error]')).toHaveCount(0)
  await expect(stage).toHaveAttribute('data-cs-fit','fit')
  expect(await stage.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1)
  if(size==='auto')expect(await stage.evaluate(el=>el.clientHeight)).toBeLessThanOrEqual(680)
  if(id==='kineticPearl'){
   const slider=stage.getByRole('slider');await slider.fill('73');await stage.getByRole('button',{name:'保存当前方案'}).click();await expect(stage).toContainText('已保存 73%')
  }else if(id==='kineticAtlas'){
   await stage.getByRole('button',{name:'展开中间步骤',exact:true}).click();await stage.getByRole('button',{name:'变换',exact:true}).click();await expect(stage).toContainText('变换产生新的表示');await stage.getByRole('button',{name:'收起中间步骤',exact:true}).click()
  }else {
   await stage.getByRole('button',{name:/脉冲俱乐部/}).click();await stage.getByRole('button',{name:'加入我的行程'}).click();await expect(stage).toContainText('已保存：脉冲俱乐部')
  }
  await stage.screenshot({path:`${out}/${id}-${width}-${size}.png`,animations:'disabled'})
 }
 await page.getByLabel('设计配方',{exact:true}).selectOption('editorial');await page.getByLabel('设计配方',{exact:true}).selectOption('inherit')
 if(id==='kineticPearl')await expect(stage).toContainText('已保存 73%')
 if(id==='kineticRebel')await expect(stage).toContainText('已保存：脉冲俱乐部')
 expect(errors).toEqual([])
})
test('host painters pause offscreen, respect reduced motion and degrade without canvas',async({page})=>{
 await page.goto('/cardspec-lab.html?fixture=kineticPearl');const stage=page.locator('.cs-stage'),effect=page.locator('.cs-host-effect');await stage.scrollIntoViewIfNeeded()
 await expect(effect).toHaveAttribute('data-effect-status','ready');await expect(effect).toHaveAttribute('data-effect-running','true')
 await page.getByLabel('卡片动效',{exact:true}).selectOption('light');await expect(effect).toHaveAttribute('data-effect-running','false')
 await page.getByLabel('卡片动效',{exact:true}).selectOption('full');await page.emulateMedia({reducedMotion:'reduce'});await expect(effect).toHaveAttribute('data-effect-running','false')
 await page.emulateMedia({reducedMotion:'no-preference'});await stage.scrollIntoViewIfNeeded();await expect(effect).toHaveAttribute('data-effect-running','true')
 await page.evaluate(()=>{document.querySelector('.cs-shell').style.marginTop='4000px';scrollTo(0,0)});await expect(effect).toHaveAttribute('data-effect-running','false')
 await page.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=()=>null});await page.reload();await expect(page.locator('.cs-host-effect')).toHaveAttribute('data-effect-status','unavailable')
 await page.getByRole('button',{name:'保存当前方案'}).click();await expect(stage).toContainText('已保存 40%')
})
test('long list progressive disclosure preserves selection and reaches last item',async({page})=>{
 await page.goto('/cardspec-lab.html?fixture=kineticList');await page.getByLabel('卡片尺寸',{exact:true}).selectOption('square')
 const stage=page.locator('.cs-stage');await expect(stage.getByRole('button',{name:/^设备 /})).toHaveCount(3)
 await stage.getByRole('button',{name:'设备 2',exact:true}).click();await expect(stage).toContainText('已选 2')
 for(let i=0;i<4;i++)await stage.getByRole('button',{name:'下一组'}).click()
 await stage.getByRole('button',{name:'设备 13',exact:true}).click();await expect(stage).toContainText('已选 13')
 await page.getByLabel('卡片尺寸',{exact:true}).selectOption('auto');await expect(stage.getByRole('button',{name:'设备 13',exact:true})).toBeVisible()
 await stage.getByRole('button',{name:'上一组'}).click();await expect(stage).toContainText('已选 13')
})
test('SVG interpolation runs only in host and snaps on reduced motion without changing the state tree',async({page})=>{
 await page.goto('/cardspec-lab.html?fixture=kineticPearl')
 await page.evaluate(async()=>{
  const {sandboxDocument}=await import('/src/cardspec/sandbox-document.mjs');const frame=document.createElement('iframe');frame.id='svg-motion';frame.sandbox='allow-scripts';frame.srcdoc=sandboxDocument('','svg-test');document.body.append(frame);await new Promise(r=>frame.onload=r)
  const send=message=>frame.contentWindow.postMessage({sandbox:'svg-test',...message},'*');window.drawSvg=x=>send({type:'render',revision:x,tree:{type:'svg',props:{viewBox:'0 0 200 100'},children:[{type:'circle',props:{id:'dot',cx:x,cy:40,r:10},children:[]}]}})
  window.drawPair=ids=>send({type:'render',revision:999,tree:{type:'svg',props:{viewBox:'0 0 200 100'},children:ids.map((id,i)=>({type:'circle',props:{id,cx:i*40+20,cy:40,r:10},children:[]}))}})
  send({type:'environment',active:true,motionLevel:'full',theme:{}});window.drawSvg(20)
 })
 const dot=page.frameLocator('#svg-motion').locator('#dot');await expect(dot).toHaveAttribute('cx','20');await page.evaluate(()=>window.drawSvg(140))
 await expect.poll(async()=>{const x=Number(await dot.getAttribute('cx'));return x>20&&x<140}).toBe(true)
 await expect.poll(()=>dot.getAttribute('cx')).toBe('140')
 await page.evaluate(()=>window.drawSvg(60));await page.emulateMedia({reducedMotion:'reduce'});await expect(dot).toHaveAttribute('cx','60')
 await page.evaluate(()=>window.drawSvg(110));await expect(dot).toHaveAttribute('cx','110')
 const frame=page.frameLocator('#svg-motion');await dot.evaluate(el=>window.savedDot=el)
 await page.evaluate(()=>window.drawPair(['new','dot']));await expect(frame.locator('circle')).toHaveCount(2)
 expect(await dot.evaluate(el=>el===window.savedDot)).toBe(true)
 await page.evaluate(()=>window.drawPair(['dot','new']));await expect(dot).toHaveAttribute('cx','20')
 expect(await dot.evaluate(el=>el===window.savedDot)).toBe(true)
})
