import { test, expect } from '@playwright/test'
import { FIXTURES } from '../../shared/cardspec/fixtures.mjs'

test('omitted API format defaults to CardSpec and one repair restores all controls', async({request,page})=>{
  const response=await request.post('/api/chat',{data:{mode:'direct',messages:[{role:'user',content:'QA_DEFAULT_FORMAT'}]}})
  expect(await response.text()).toContain('"format":"cardspec"')
  await page.goto('/')
  await expect(page.getByLabel('渲染协议')).toHaveValue('cardspec')
  await page.getByRole('button',{name:/Pipeline/}).click()
  await page.getByPlaceholder('描述你想要的交互卡片…').fill('QA_MULTI_REPAIR')
  await page.getByRole('button',{name:'发送',exact:true}).click()
  await page.getByRole('button',{name:'补充资源',exact:true}).click()
  await expect(page.getByRole('progressbar',{name:'可用 6/6',exact:true})).toBeVisible()
  await expect(page.locator('.cs-card')).toContainText('补充完成')
  await expect(page.getByRole('button',{name:'发送',exact:true})).toBeVisible()
  await expect(page.locator('[data-cs-error]')).toHaveCount(0)
})

test('planning HTTP calls request JSON and cancel DSL prefixes before a full draft', async({request})=>{
  const response=await request.post('/api/chat',{data:{format:'cardspec',mode:'staged',messages:[
    {role:'user',content:'计数卡片'}, {role:'assistant',content:FIXTURES.counter}, {role:'user',content:'QA_PLAN_DSL 改一下标题'},
  ]}})
  const body=await response.text()
  expect(body).toContain('"plan_repair_count":2')
  expect(body).toContain('"repair_count":0')
  expect(body).toContain('"status":"succeeded"')
  const stats=await (await fetch('http://127.0.0.1:8791/stats')).json()
  const calls=stats.requests.filter(r=>r.marker==='QA_PLAN_DSL')
  expect(calls.map(r=>r.phase)).toEqual(['analysis','analysis','plan','plan','dsl'])
  for(const i of [0,1,2,3]) {
    expect(calls[i].responseFormat).toEqual({type:'json_object'})
    expect(calls[i].assistantDsl).toBe(false)
  }
  expect(calls[0].emitted).toBeLessThan(100)
  expect(calls[2].emitted).toBeLessThan(100)
  expect(calls[4].assistantDsl).toBe(true)
})

test('staged thinking moves from planning sections into the card and stops on completion', async({page})=>{
  await page.goto('/')
  await page.getByLabel('渲染协议').selectOption('cardspec')
  await page.getByPlaceholder('描述你想要的交互卡片…').fill('QA_THINK_STAGED')
  await page.getByRole('button',{name:'发送',exact:true}).click()
  await expect(page.locator('.phase--analysis .phase-doc .thinking')).toBeVisible()
  await page.screenshot({path:'artifacts/cardspec-qa/screenshots/thinking-planning.png'})
  await expect(page.locator('.phase--plan .phase-doc .thinking')).toBeVisible()
  await expect(page.locator('.phase--analysis .thinking')).toHaveCount(0)
  await expect(page.locator('.cs-stage .thinking--empty')).toBeVisible()
  await page.screenshot({path:'artifacts/cardspec-qa/screenshots/thinking-card.png'})
  await expect(page.locator('.phase--plan .thinking')).toHaveCount(0)
  await page.getByRole('button',{name:'增加一次',exact:true}).click()
  await expect(page.locator('.cs-stage .thinking--card')).toBeVisible()
  await expect(page.getByRole('button',{name:'发送',exact:true})).toBeVisible()
  await expect(page.locator('.thinking')).toHaveCount(0)
  await expect(page.locator('.cs-card')).toContainText('当前计数 1')
})

for(const format of ['dil','cardspec']) test(`${format} direct thinking is inside the card before tokens and disappears on cancel`, async({page})=>{
  await page.goto('/')
  await page.getByLabel('渲染协议').selectOption(format)
  await page.getByRole('button',{name:/Pipeline/}).click()
  await page.getByPlaceholder('描述你想要的交互卡片…').fill('QA_THINK_DIRECT')
  await page.getByRole('button',{name:'发送',exact:true}).click()
  await expect(page.locator('.dil-stage .thinking--empty')).toBeVisible()
  expect(await page.locator('.thinking-dots i').first().evaluate(el=>getComputedStyle(el).animationName)).toBe('thinking-pulse')
  await page.emulateMedia({reducedMotion:'reduce'})
  expect(await page.locator('.thinking-dots i').first().evaluate(el=>getComputedStyle(el).animationName)).toBe('none')
  await page.getByRole('button',{name:'停止',exact:true}).click()
  await expect(page.locator('.thinking')).toHaveCount(0)
  await expect(page.locator('.phase-done')).toHaveText('已停止')
})
