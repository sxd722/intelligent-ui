import {test,expect} from '@playwright/test'
import {compileSandbox} from '../../server/cardspec/sandbox.mjs'
import {LINKED_REACT} from '../../shared/cardspec/sandbox-linked-fixture.mjs'
import {existsSync,readFileSync} from 'node:fs'
let module
test.beforeAll(async()=>{module=await compileSandbox(LINKED_REACT,{input:{level:30,count:0,status:'idle'},capabilities:['adjust','refresh']})})
async function setup(page,{sourceModule=module,beforeReady,gate,initialText='强度 30 · 结果 0 · idle'}={}){
 const calls=[]
 await page.addInitScript(()=>{if(window===window.top)localStorage.setItem('cardspec:render-mode:v1','hybrid')})
 await page.route('**/api/tools/invoke',async route=>{
  const p=route.request().postDataJSON();calls.push(p)
  if(p.target?.startsWith('sandbox:')&&gate)await gate
  const result=p.target?.startsWith('sandbox:')?{kind:'sandbox',module:sourceModule}:{kind:'json',value:{items:[],source:'controlled test',fetchedAt:'2026-10-21T00:00:00Z'}}
  await route.fulfill({contentType:'text/event-stream',body:[{type:'result',result},{type:'done'}].map(e=>'data: '+JSON.stringify({...e,requestId:p.requestId,pageId:p.pageId})+'\n\n').join('')})
 })
 await page.goto('/cardspec-lab.html?fixture=sandboxLinked')
 await beforeReady?.(page)
 const f=page.frameLocator('iframe[title="动态图形"]')
 if(initialText)await expect(f.getByText(initialText)).toBeVisible({timeout:15000})
 else await expect(f.locator('svg').first()).toBeVisible({timeout:15000})
 return {f,calls}
}
test('native control ↔ SVG bridge, tool response callback, reload and native-only fallback',async({page})=>{
 const {f,calls}=await setup(page)
 await f.getByRole('button',{name:'波形设为75'}).click()
 await expect(page.getByRole('slider',{name:'强度'})).toHaveValue('75')
 await expect(f.getByText('强度 75 · 结果 0 · idle')).toBeVisible()
 await page.getByRole('button',{name:'归零',exact:true}).click()
 await expect(f.getByText('强度 0 · 结果 0 · idle')).toBeVisible()
 await page.getByRole('slider',{name:'强度'}).fill('45')
 await expect(f.getByText('强度 45 · 结果 0 · idle')).toBeVisible()
 await f.getByRole('button',{name:'图中查询'}).click()
 await expect(f.getByText('强度 45 · 结果 0 · success')).toBeVisible()
 expect(calls.filter(p=>p.tool==='autocli.hackernews.top')).toHaveLength(1)
 await page.reload();await expect(f.getByText('强度 45 · 结果 0 · success')).toBeVisible()
 expect(calls.filter(p=>p.tool==='glm.generate')).toHaveLength(1)
 expect(calls.filter(p=>p.tool==='autocli.hackernews.top')).toHaveLength(1)
 await page.getByLabel('UI能力').selectOption('native');await expect(page.locator('iframe')).toHaveCount(0)
 await page.getByRole('button',{name:'归零',exact:true}).click();await expect(page.getByRole('slider',{name:'强度'})).toHaveValue('0')
 await page.getByLabel('UI能力').selectOption('hybrid');await expect(f.getByText('强度 0 · 结果 0 · success')).toBeVisible()
})
test('author CSS runs autonomously, pauses, respects reduced motion, and inherits card theme',async({page})=>{
 const {f,calls}=await setup(page),circle=f.locator('.wave')
 const a=await circle.evaluate(e=>getComputedStyle(e).opacity);await page.waitForTimeout(220)
 expect(await circle.evaluate(e=>getComputedStyle(e).opacity)).not.toBe(a)
 await page.getByLabel('视图选项').click();await page.getByRole('button',{name:'暂停动效'}).click()
 expect(await circle.evaluate(e=>getComputedStyle(e).animationPlayState)).toBe('paused')
 await page.getByRole('button',{name:'播放动效'}).click();await page.emulateMedia({reducedMotion:'reduce'})
 expect(await circle.evaluate(e=>getComputedStyle(e).animationName)).toBe('none')
 expect(await f.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
 expect(await f.locator('body').evaluate(e=>getComputedStyle(e).color)).toBe(await page.locator('.cs-sandbox').evaluate(e=>getComputedStyle(e).color))
 await page.getByLabel('视图选项').click()
 for(const width of [320,360,432]){
  await page.getByLabel('宽度',{exact:true}).selectOption(String(width))
  for(const size of ['square','auto']){await page.getByLabel('卡片尺寸').selectOption(size);expect(await f.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1)).toBe(true)}
 }
 expect(calls.filter(p=>p.tool!=='glm.generate')).toHaveLength(0)
 await page.locator('.cs-stage').screenshot({path:'artifacts/sandbox-linked-qa/linked.png'})
})
test('untrusted DOM events cannot invoke exposed host actions',async({page})=>{
 const {f,calls}=await setup(page)
 await f.getByRole('button',{name:'图中查询'}).evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})))
 await expect(page.getByRole('alert')).toContainText('current user gesture')
 expect(calls.filter(p=>p.tool==='autocli.hackernews.top')).toHaveLength(0)
 await page.getByRole('button',{name:'归零',exact:true}).click();await expect(page.getByRole('slider',{name:'强度'})).toHaveValue('0')
})

test('changing native input during generation keeps one request and uses the latest value',async({page})=>{
 let release;const gate=new Promise(r=>release=r)
 const {calls}=await setup(page,{gate,initialText:'强度 62 · 结果 0 · idle',beforeReady:async p=>{
  await expect(p.getByText('正在生成增强视图… 原生功能可继续使用')).toBeVisible()
  await p.getByRole('slider',{name:'强度'}).fill('62');release()
 }})
 expect(calls).toHaveLength(1)
})

test('offscreen animation pauses and returning restores the shared input without tool replay',async({page})=>{
 const {f,calls}=await setup(page)
 await page.locator('.cs-sandbox').evaluate(e=>e.style.marginTop='2000px')
 await expect.poll(()=>f.locator('.wave').evaluate(e=>getComputedStyle(e).animationPlayState)).toBe('paused')
 await page.getByRole('slider',{name:'强度'}).fill('55')
 await page.locator('.cs-sandbox').evaluate(e=>e.style.marginTop='0px')
 await page.locator('.cs-sandbox').scrollIntoViewIfNeeded()
 await expect(f.getByText('强度 55 · 结果 0 · idle')).toBeVisible()
 await expect.poll(()=>f.locator('.wave').evaluate(e=>getComputedStyle(e).animationPlayState)).toBe('running')
 expect(calls).toHaveLength(1)
})

for(const id of ['energy','network'])test('real GLM replay: '+id,async({page})=>{
 const path=`artifacts/sandbox-linked-qa/live-v2/${id}-replay.json`
 test.skip(!existsSync(path),'Run qa-sandbox-linked-live first; no model calls in browser tests')
 const sourceModule=JSON.parse(readFileSync(path,'utf8')).module
 const {f,calls}=await setup(page,{sourceModule,initialText:null})
 const control=id==='energy'?f.locator('g[role="button"]').nth(1):f.getByRole('button',{name:'输出节点 adjust'}).first()
 await control.focus();await control.press('Enter')
 await expect(page.getByRole('slider',{name:'强度'})).toHaveValue('75')
 const refresh=id==='energy'?f.locator('g[role="button"]').first():f.getByRole('button',{name:'输入节点 refresh'}).first()
 await refresh.focus();await refresh.press('Enter')
 await expect.poll(()=>calls.filter(p=>p.tool==='autocli.hackernews.top').length).toBe(1)
 await page.getByRole('button',{name:'归零',exact:true}).click()
 await expect(page.getByRole('slider',{name:'强度'})).toHaveValue('0')
 await expect(page.getByRole('alert')).toHaveCount(0)
 await page.locator('.cs-stage').screenshot({path:`artifacts/sandbox-linked-qa/${id}.png`})
})
