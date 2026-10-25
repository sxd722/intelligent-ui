import { test, expect } from '@playwright/test'

const source = `<card actionMode="snapshot"><data id="rows" value={[{id:"a",title:"候选 A"},{id:"b",title:"候选 B"}]}/><state id="picks" type="array" initial={[]}/><title>选择作用域回归</title><each items={data.rows} as="entry" itemKey={entry.id}><pressable selected={count(state.picks,item.id==entry.id)>0} onPress="pick" args={{id:entry.id}}><text>{entry.title}</text></pressable></each><caption>已选 {len(state.picks)}</caption><action id="pick"><append target="picks" when={count(state.picks,item.id==args.id)==0} value={{id:args.id}}/><remove target="picks" key={args.id} when={count(state.picks,item.id==args.id)>0}/></action></card>`

for (const width of [320, 360, 432]) test(`independent selections survive rerender at ${width}px`, async ({ page }) => {
  await page.goto('/cardspec-lab.html?fixture=counter')
  await page.getByText('输入 DSL 验证', { exact: true }).click()
  await page.getByLabel('DSL源码').fill(source)
  await page.getByRole('button', { name: '应用源码', exact: true }).click()
  await expect(page.getByTestId('diagnostics')).toHaveText('[]')
  await page.getByLabel('宽度', { exact: true }).selectOption(String(width))
  const card = page.locator('.cs-card')
  const a = card.getByRole('button', { name: '候选 A' }), b = card.getByRole('button', { name: '候选 B' })
  await a.click()
  await expect(a).toHaveAttribute('aria-pressed', 'true')
  await expect(b).toHaveAttribute('aria-pressed', 'false')
  await b.click(); await a.click()
  await expect(a).toHaveAttribute('aria-pressed', 'false')
  await expect(b).toHaveAttribute('aria-pressed', 'true')
  await expect(card).toContainText('已选 1')
  await expect(page.locator('[data-cs-error]')).toHaveCount(0)
  expect(await page.locator('.cs-stage').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
})
