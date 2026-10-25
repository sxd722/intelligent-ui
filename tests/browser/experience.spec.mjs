import {test,expect} from '@playwright/test'
import {mkdirSync} from 'node:fs'
mkdirSync('artifacts/experience-qa',{recursive:true})
async function lab(page,name,width='432'){
 await page.goto('/cardspec-lab.html');await page.getByLabel('样例',{exact:true}).selectOption(name)
 await page.getByLabel('宽度',{exact:true}).selectOption(width);await page.getByRole('button',{name:'模拟结束'}).click()
 await expect(page.getByTestId('diagnostics')).toHaveText('[]')
}
async function source(page,body){
 await page.goto('/cardspec-lab.html');await page.getByText('输入 DSL 验证',{exact:true}).click()
 await page.getByLabel('DSL源码',{exact:true}).fill(body);await page.getByRole('button',{name:'应用源码',exact:true}).click();await page.getByRole('button',{name:'模拟结束'}).click()
 await expect(page.getByTestId('diagnostics')).toHaveText('[]')
}
const height=locator=>locator.evaluate(el=>el.getBoundingClientRect().height)

test('carousel height is tallest page, freezes after completion and adapts to width',async({page})=>{
 await source(page,`<card><carousel><carousel-item><text>短页</text></carousel-item><carousel-item><strong>较长页</strong><text>${'阅读时给每个观点一点空间。'.repeat(12)}</text></carousel-item></carousel></card>`)
 await expect(page.locator('.cs-carousel-track')).toHaveAttribute('data-content-height',/\d+/)
 const before=await height(page.locator('.cs-carousel'))
 await page.getByRole('button',{name:'下一项',exact:true}).click();await expect(page.locator('.cs-carousel')).toHaveAttribute('data-active-index','1')
 expect(await height(page.locator('.cs-carousel'))).toBe(before)
 expect(await page.locator('.cs-slide').nth(1).evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true)
 await page.getByLabel('宽度',{exact:true}).selectOption('320')
 await expect.poll(()=>height(page.locator('.cs-carousel'))).toBeGreaterThan(before)
 await page.locator('.cs-stage').screenshot({path:'artifacts/experience-qa/carousel.png'})
})

test('diagram heights come from all nodes and descriptions, not current selection',async({page})=>{
 for(const type of ['mindmap','flowchart']){
  const nodes=[{id:'a',label:'起点',description:'短说明'},{id:'b',label:'中间',parentId:'a',description:'不同节点共享固定的说明区。'.repeat(8)},{id:'c',label:'终点',parentId:'b'}]
  const body=(detailMode='inline')=>`<card><${type} label="完整图" nodes={${JSON.stringify(nodes)}} ${type==='flowchart'?'edges={[{from:"a",to:"b"},{from:"b",to:"c"}]}':''} detailMode="${detailMode}"/></card>`
  await source(page,body());await expect(page.locator('.cs-diagram-pan')).toHaveAttribute('data-content-height',/\d+/)
  await expect.poll(()=>height(page.locator('.cs-diagram-description'))).toBeGreaterThan(30)
  const before=await height(page.locator('.cs-diagram'))
  await page.getByRole('button',{name:'中间',exact:true}).click();expect(await height(page.locator('.cs-diagram'))).toBe(before)
  await page.getByRole('button',{name:'放大图形'}).click();expect(await height(page.locator('.cs-diagram'))).toBe(before)
  await page.locator('.cs-stage').screenshot({path:`artifacts/experience-qa/${type}.png`})
  await source(page,body('external'));await expect(page.locator('.cs-widget-caption')).toHaveCount(0)
 }
})

test('weather saves, marks, deduplicates, reloads drafts and removes only selected date',async({page})=>{
 await lab(page,'weatherJournal')
 await page.getByRole('button',{name:'晴',exact:true}).click();await page.getByLabel('备注',{exact:true}).fill('带伞')
 await page.getByRole('button',{name:'保存记录',exact:true}).click();await page.getByRole('button',{name:'保存记录',exact:true}).click()
 await expect(page.locator('[data-date="2026-10-13"] .cs-date-dot')).toHaveAttribute('data-marked','true')
 await page.locator('[data-date="2026-10-14"]').click();await expect(page.getByLabel('备注',{exact:true})).toHaveValue('')
 await page.getByRole('button',{name:'雨',exact:true}).click();await page.getByRole('button',{name:'保存记录',exact:true}).click()
 await page.getByRole('button',{name:'下个月',exact:true}).click();await expect(page.getByLabel('备注',{exact:true})).toHaveValue('');await expect(page.getByRole('button',{name:'保存记录',exact:true})).toBeDisabled()
 await page.getByRole('button',{name:'上个月',exact:true}).click();await page.locator('[data-date="2026-10-13"]').click();await expect(page.getByLabel('备注',{exact:true})).toHaveValue('带伞')
 await page.getByRole('button',{name:'清除',exact:true}).click();await expect(page.locator('[data-date="2026-10-13"] .cs-date-dot')).not.toHaveAttribute('data-marked','true')
 await expect(page.locator('[data-date="2026-10-14"] .cs-date-dot')).toHaveAttribute('data-marked','true')
 await page.locator('.cs-stage').screenshot({path:'artifacts/experience-qa/weather.png'})
})

test('concept experiment and reversible tradeoffs create distinct meaningful feedback',async({page})=>{
 await lab(page,'conceptLab')
 await page.getByRole('button',{name:'猜完了，看结果'}).click();await expect(page.locator('.cs-card')).toContainText('每分钟积压4单')
 await page.getByRole('radio',{name:'缓存取餐'}).click();await expect(page.locator('.cs-card')).toContainText('队伍不再增长')
 await page.locator('.cs-stage').screenshot({path:'artifacts/experience-qa/concept.png'})
 await lab(page,'packingLab')
 await page.getByRole('button',{name:'相机 · 3格'}).click();await page.getByRole('button',{name:'厚书 · 4格'}).click();await expect(page.locator('.cs-card')).toContainText('肩膀辞职')
 await page.getByRole('button',{name:'厚书 · 4格'}).click();await expect(page.locator('.cs-card')).toContainText('还剩 3 格余地')
 await page.locator('.cs-stage').screenshot({path:'artifacts/experience-qa/packing.png'})
})
