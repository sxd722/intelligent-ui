import { test, expect } from '@playwright/test'
import { CONSTELLATION_CARD } from '../tolerance-fixture.mjs'

async function load(page,source){
  await page.goto('/cardspec-lab.html')
  await page.getByText('输入 DSL 验证',{exact:true}).click()
  await page.getByLabel('DSL源码',{exact:true}).fill(source)
  await page.getByRole('button',{name:'应用源码',exact:true}).click()
}
test('typographic quotes, seven-node tree and late action render and select',async({page})=>{
  await load(page,CONSTELLATION_CARD)
  await expect(page.getByTestId('diagnostics')).toHaveText('[]')
  for(const width of ['320','432']){
    await page.getByLabel('宽度',{exact:true}).selectOption(width)
    await page.locator('.cs-card').getByText('金牛座 Taurus',{exact:true}).first().click()
    await expect(page.locator('[data-cs-node$="detail"]')).toContainText('毕星团和昴星团')
    await page.locator('.cs-card').getByText('猎户座 Orion',{exact:true}).first().click()
    await expect(page.locator('[data-cs-node$="detail"]')).toContainText('腰带三星')
    await expect(page.locator('[data-cs-error],.cs-action-error')).toHaveCount(0)
  }
})
test('anonymous each templates keep independent inputs through revisions',async({page})=>{
  await load(page,`<card><data id="rows" value={[{id:"a",label:"甲"},{id:"b",label:"乙"}]}/><state id="notes" type="record" initial={{}}/><action id="edit"><set target="notes" key={args.id} value={event.value}/></action><region role="content" overflow="scroll"><each items={data.rows} itemKey={item.id}><row><strong>{item.label}</strong><input label={item.label} value={state.notes[item.id] ?? ""} onChange="edit" args={{id:item.id}}/></row></each></region></card>`)
  await expect(page.getByTestId('diagnostics')).toHaveText('[]')
  await page.getByLabel('甲',{exact:true}).fill('第一条')
  await page.getByLabel('乙',{exact:true}).fill('第二条')
  await page.getByRole('button',{name:'模拟增量更新'}).click()
  await expect(page.getByLabel('甲',{exact:true})).toHaveValue('第一条')
  await expect(page.getByLabel('乙',{exact:true})).toHaveValue('第二条')
  await expect(page.locator('[data-cs-error],.cs-action-error')).toHaveCount(0)
})
