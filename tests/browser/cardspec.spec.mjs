import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { THEMES } from '../../shared/cardspec/registry.mjs'
import { FIXTURES } from '../../shared/cardspec/fixtures.mjs'
mkdirSync('artifacts/cardspec-qa/screenshots', { recursive: true })
async function lab(page, fixture = 'counter', width = '432') {
  await page.goto('/cardspec-lab.html')
  await page.getByLabel('样例', { exact: true }).selectOption(fixture)
  await page.getByLabel('宽度', { exact: true }).selectOption(width)
  await expect.poll(async()=>JSON.parse(await page.getByTestId('diagnostics').innerText()).filter(d=>d.severity==='error')).toEqual([])
  await expect(page.locator('.cs-stage')).toHaveAttribute('data-cs-fit', 'fit')
  await expect(page.locator('[data-cs-error]')).toHaveCount(0)
}

test('progress exposes a visible label and percentage as state changes on mobile', async ({ page }) => {
  await lab(page, 'water', '320')
  const meter = page.locator('.cs-progress-field')
  await expect(meter).toContainText('完成进度')
  await expect(meter).toContainText('0%')
  await page.getByRole('button', { name: '记录一杯', exact: true }).click()
  await expect(meter).toContainText('13%')
  await expect(page.getByRole('progressbar', { name: '完成进度', exact: true })).toHaveAttribute('value', '0.125')
  await expect(page.locator('.cs-stage')).toHaveAttribute('data-cs-fit', 'fit')
})
test('input, counter and focused DOM survive revisions, end and theme changes', async ({ page }) => {
  await lab(page)
  const input = page.getByLabel('备注', { exact: true })
  await input.pressSequentially('稳定输入 abc')
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('稳定输入 abc')
  await page.getByRole('button', { name: '增加一次' }).click()
  await expect(page.locator('.cs-card')).toContainText('当前计数 1')
  await page.getByRole('button', { name: '模拟增量更新' }).click()
  await page.getByRole('button', { name: '模拟结束' }).click()
  await page.getByLabel('主题', { exact: true }).selectOption('dark')
  await expect(input).toHaveValue('稳定输入 abc')
  await expect(page.locator('.cs-card')).toContainText('当前计数 1')
})
test('all seven fixtures fit three widths and 18 palettes with no hidden required text', async ({ page }) => {
  test.setTimeout(120000)
  await lab(page)
  for (const fixture of ['counter','water','silkworm','travel','checklist','longtext','calendar']) {
    await page.getByLabel('样例', { exact: true }).selectOption(fixture)
    for (const width of ['320','360','432']) {
      await page.getByLabel('宽度', { exact: true }).selectOption(width)
      for (const theme of THEMES) for (const palette of ['a','b','c']) {
        await page.getByLabel('主题', { exact: true }).selectOption(theme)
        await page.getByLabel('配色', { exact: true }).selectOption(palette)
        await expect(page.locator('.cs-stage'), `${fixture}/${width}/${theme}/${palette}`).toHaveAttribute('data-cs-fit', 'fit')
        await expect(page.locator('[data-cs-error]')).toHaveCount(0)
        const geometry = await page.locator('.cs-card').evaluate((el) => ({ width: el.clientWidth, demand: el.scrollWidth, height: el.clientHeight, scroll: el.scrollHeight }))
        expect(geometry.demand).toBeLessThanOrEqual(geometry.width + 1)
      }
    }
  }
})
test('calendar supports four/five/six weeks, leap day and in-card caption updates', async ({ page }) => {
  await lab(page, 'calendar', '320')
  for (const [month, days] of [['2027-02',28],['2026-10',31],['2026-08',31],['2028-02',29]]) {
    await page.getByLabel('月份', { exact: true }).fill(month)
    await expect(page.locator('.cs-calendar-grid button')).toHaveCount(days)
    await expect(page.locator('.cs-stage')).toHaveAttribute('data-cs-fit', 'fit')
    const before = await page.locator('.cs-region').boundingBox()
    await page.locator(`[data-date="${month}-02"]`).click()
    await expect(page.locator('.cs-region')).toContainText('研究发布')
    await expect(page.locator(`[data-date="${month}-02"]`)).toHaveAttribute('aria-pressed', 'true')
    expect((await page.locator('.cs-region').boundingBox()).height).toBeCloseTo(before.height, 0)
    await page.locator(`[data-date="${month}-03"]`).click()
    await expect(page.locator('.cs-region')).toContainText('该日期暂无新闻')
    const captionHeight = await page.locator('.cs-region').evaluate((el) => el.clientHeight)
    expect(captionHeight).toBeGreaterThanOrEqual(48)
  }
  await page.getByLabel('月份', { exact: true }).fill('2026-08')
  await page.locator('[data-date="2026-08-01"]').focus()
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter')
  await expect(page.locator('.cs-region')).toContainText('研究发布')
  await page.screenshot({ path: 'artifacts/cardspec-qa/screenshots/calendar-320.png' })
})
test('selected controls inherit readable colors; nested media retains height and errors settle', async ({ page }) => {
  await lab(page, 'silkworm', '320')
  await page.getByRole('radio', { name: '成长', exact: true }).click()
  await expect(page.getByRole('radio', { name: '成长', exact: true })).toHaveAttribute('aria-checked', 'true')
  for (const theme of THEMES) for (const palette of ['a','b','c']) {
    await page.getByLabel('主题', { exact: true }).selectOption(theme)
    await page.getByLabel('配色', { exact: true }).selectOption(palette)
    const contrast = await page.getByRole('radio', { name: '成长', exact: true }).evaluate((el) => {
      const s = getComputedStyle(el)
      const luminance = (rgb) => rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }).reduce((sum, v, i) => sum + v * [.2126,.7152,.0722][i], 0)
      const a = luminance(s.color), b = luminance(s.backgroundColor)
      return (Math.max(a,b) + .05) / (Math.min(a,b) + .05)
    })
    expect(contrast, `${theme}/${palette}`).toBeGreaterThanOrEqual(4.5)
  }
  await expect(page.locator('.cs-image img')).toBeVisible()
  expect((await page.locator('.cs-image').boundingBox()).height).toBeGreaterThanOrEqual(64)
  await page.getByLabel('图片', { exact: true }).selectOption('error')
  await expect(page.locator('.cs-image')).toHaveText('图片暂不可用')
  await page.getByRole('button', { name: '观察记录', exact: true }).click()
  await page.getByRole('textbox', { name: '观察记录', exact: true }).fill('观察记录保持')
  await page.getByRole('button', { name: '关闭详情' }).click()
  await page.getByRole('button', { name: '观察记录', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '观察记录', exact: true })).toHaveValue('观察记录保持')
})
test('twenty-item pagination and filtered checklist preserve item state', async ({ page }) => {
  await lab(page, 'checklist', '320')
  await page.getByRole('checkbox').first().check()
  await page.getByRole('button', { name: '下一页' }).click()
  await page.getByRole('button', { name: '上一页' }).click()
  await expect(page.getByRole('checkbox').first()).toBeChecked()
  let guard = 0
  while (await page.getByRole('button', { name: '下一页' }).isEnabled()) {
    await page.getByRole('button', { name: '下一页' }).click(); if (++guard > 20) throw new Error('pagination failed to terminate')
  }
  await expect(page.locator('.cs-region[data-overflow="paginate"]')).toContainText('任务 20')
  await page.getByLabel('样例', { exact: true }).selectOption('travel')
  await page.getByRole('checkbox', { name: '证件' }).check()
  await page.getByRole('radio', { name: '行李', exact: true }).click()
  await expect(page.getByRole('checkbox')).toHaveCount(1)
  await page.getByRole('radio', { name: '全部', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: '证件' })).toBeChecked()
})
async function send(page, format, text, mode = 'direct') {
  await page.goto('/')
  await page.evaluate(()=>sessionStorage.clear());await page.reload()
  await page.getByLabel('渲染协议').selectOption(format)
  const pipeline=page.getByRole('button',{name:/Pipeline|体验规划 → 卡片生成/})
  for(let i=0;i<3;i++){if((await pipeline.innerText()).includes(mode==='staged'?'3-phase':'direct'))break;await pipeline.click()}
  await page.getByPlaceholder('描述你想要的交互卡片…').fill(text)
  await page.getByRole('button', { name: '发送', exact: true }).click()
}
test('actual SSE pipeline preserves interaction through completion and keeps DIL selectable', async ({ page }) => {
  await page.goto('/'); await expect(page.getByLabel('渲染协议')).toHaveValue('cardspec')
  await send(page, 'cardspec', 'QA_COUNTER')
  await page.getByRole('button', { name: '增加一次', exact: true }).click()
  const input = page.getByLabel('备注', { exact: true })
  await input.pressSequentially('streaming input')
  await expect(input).toBeFocused()
  await expect(page.getByRole('button', { name: '发送', exact: true })).toBeVisible()
  await expect(page.locator('.cs-card')).toContainText('当前计数 1')
  await expect(input).toHaveValue('streaming input'); await expect(input).toBeFocused()
  await page.screenshot({ path: 'artifacts/cardspec-qa/screenshots/stream-state.png' })
  await send(page, 'dil', 'QA_COUNTER')
  await expect(page.locator('.dil-card')).toContainText('原版 DIL 计数')
  await page.getByRole('button', { name: '增加一次', exact: true }).click()
  await expect(page.getByRole('button', { name: '发送', exact: true })).toBeVisible()
  await expect(page.locator('.dil-card')).toContainText('当前计数 1')
})
test('staged CardSpec works and cancellation/failure/truncation cannot report success', async ({ page }) => {
  await send(page, 'cardspec', 'QA_COUNTER', 'staged')
  await expect(page.getByRole('button', { name: '发送', exact: true })).toBeVisible()
  await expect(page.locator('.phase-done')).toHaveText(['✓','✓','✓'])
  await send(page, 'cardspec', 'QA_CANCEL')
  await page.getByRole('button', { name: '停止', exact: true }).click()
  await expect(page.locator('.phase-done').filter({hasText:'已停止'}).or(page.getByText('生成已停止',{exact:true}))).toBeVisible()
  await expect.poll(async () => (await (await fetch('http://127.0.0.1:8791/stats')).json()).active).toBe(0)
  for (const text of ['QA_FAILURE','QA_TRUNCATED']) {
    await send(page, 'cardspec', text)
    await expect(page.getByRole('button', { name: '发送', exact: true })).toBeVisible()
    await expect(page.locator('.phase-done')).not.toContainText(['✓'])
    await expect(page.getByRole('status',{name:'卡片恢复'})).toBeVisible()
  }
})
test('HTTP request and route boundaries return explicit status codes', async ({ request }) => {
  for (const data of [null, [], {}, { messages: [] }, { messages: [{ role: 'system', content: 'x' }] }, { messages: [{ role: 'user', content: 'x' }], format: 'unknown' }]) {
    const r = await request.post('/api/chat', { data: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }); expect(r.status()).toBe(400)
  }
  expect((await request.post('/api/chat', { data: 'x'.repeat(1024 * 1024 + 1) })).status()).toBe(413)
  expect((await request.get('/api/chat')).status()).toBe(405)
  expect((await request.get('/api/missing')).status()).toBe(404)
  expect((await request.get('/assets/missing.js')).status()).toBe(404)
  expect((await request.get('/demos/')).status()).toBe(200)
})
test('mobile shell keeps protocol selection and square card accessible', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await send(page, 'cardspec', 'QA_COUNTER')
  await expect(page.getByRole('button', { name: '发送', exact: true })).toBeVisible()
  await expect(page.getByLabel('渲染协议')).toBeInViewport()
  await expect(page.locator('.cs-stage')).toHaveAttribute('data-cs-fit', 'fit')
  const bounds = await page.locator('.cs-stage').boundingBox()
  expect(Math.abs(bounds.width - bounds.height)).toBeLessThanOrEqual(1)
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(360)
})
test('omitted overflow becomes local scroll without removing text', async ({ page }) => {
  await lab(page, 'longtext', '320')
  await page.getByText('输入 DSL 验证', { exact: true }).click()
  await page.getByLabel('DSL源码').fill(FIXTURES.longtext.replace('overflow="scroll"', ''))
  await page.getByRole('button', { name: '应用源码' }).click()
  await expect(page.locator('.cs-stage')).toHaveAttribute('data-cs-fit', 'fit')
  await expect(page.locator('[data-auto-overflow=scroll]')).toHaveCount(1)
  expect(await page.locator('[data-auto-overflow] .cs-region-body').evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)
})
test('overflowing plain footnote remains visible below square without hiding core content', async ({ page }) => {
  await lab(page, 'calendar', '320')
  await page.getByText('输入 DSL 验证', { exact: true }).click()
  await page.getByLabel('DSL源码').fill(FIXTURES.calendar.replace('</card>', '<region id="disclaimer" role="summary"><caption id="footnote">保留这段来源说明，不能静默删除。</caption></region></card>'))
  await page.getByRole('button', { name: '应用源码' }).click()
  await expect(page.locator('.cs-stage')).toHaveAttribute('data-cs-fit', 'fit')
  await expect(page.locator('.cs-accessory')).toContainText('不能静默删除')
  await expect(page.locator('.cs-calendar-grid button')).toHaveCount(31)
})
test('malformed planning JSON is repaired within the same phase', async ({ page }) => {
  await send(page, 'cardspec', 'QA_BAD_PLAN', 'staged')
  await expect(page.getByRole('button', { name: '发送', exact: true })).toBeVisible()
  await expect(page.locator('.phase-done')).toHaveText(['✓','✓','✓'])
  await expect(page.locator('.frame').filter({ hasText: 'plan_repair_count' })).toContainText('"plan_repair_count":2')
  await expect(page.locator('.frame').filter({ hasText: 'client_first_paint' })).toHaveCount(1)
})
