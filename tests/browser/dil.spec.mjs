import { test, expect } from '@playwright/test'

test('DIL multiline data streams cleanly and category filters drive content and counts', async({page}) => {
  await page.goto('/')
  await page.getByLabel('渲染协议').selectOption('dil')
  const pipeline=page.getByRole('button',{name:/Pipeline/});if(!(await pipeline.innerText()).includes('direct'))await pipeline.click()
  await page.getByPlaceholder('描述你想要的交互卡片…').fill('QA_DIL_MULTILINE')
  await page.getByRole('button',{name:'发送',exact:true}).click()
  await expect(page.getByRole('button',{name:'停止',exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'发送',exact:true})).toBeVisible()
  const card=page.locator('.dil-card')
  await expect(card).toContainText('铅笔')
  await expect(card).toContainText('3 项')
  await expect(page.locator('.diag-pill')).toHaveCount(0)
  await page.getByRole('button',{name:'hide stream',exact:true}).click()
  for(const width of [320,375,432]) {
    await page.setViewportSize({width,height:850})
    await card.getByRole('tab',{name:'读物',exact:true}).click()
    await expect(card).toContainText('图册')
    await expect(card).not.toContainText('铅笔')
    await expect(card).toContainText('1 项')
    await card.getByRole('tab',{name:'其它',exact:true}).click()
    await expect(card).toContainText('暂无内容')
    await expect(card).toContainText('0 项')
    await card.getByRole('tab',{name:'全部',exact:true}).click()
    await expect(card).toContainText('3 项')
  }
  await page.screenshot({path:'artifacts/dil-qa/generic-filter.png',fullPage:true})
})

for(const marker of ['QA_DIL_UNCLOSED','QA_DIL_INVALID']) test(`${marker} is failed instead of delivered`, async({request}) => {
  const response=await request.post('/api/chat',{data:{format:'dil',mode:'direct',messages:[{role:'user',content:marker}]}})
  const body=await response.text()
  expect(body).toContain('"type":"stream_error"')
  expect(body).toContain('"status":"failed"')
  expect(body).not.toContain('"status":"succeeded"')
  expect(body).not.toContain('finished_successfully"},{"p":"/message/end_turn')
})
