import { chromium } from '@playwright/test'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
const opts = Object.fromEntries(process.argv.slice(2).map((s) => s.replace(/^--/, '').split('=')))
const folder = opts.input || 'artifacts/cardspec-qa/real', base = opts.base || 'http://127.0.0.1:8787'
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE })
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } }), results = []
await mkdir(`${folder}/screenshots`, { recursive: true })
for (const file of (await readdir(folder)).filter((f) => /-(direct|staged)-\d+\.json$/.test(f))) {
  const record = JSON.parse(await readFile(`${folder}/${file}`, 'utf8'))
  if (!record.source || record.status !== 'succeeded') continue
  const result = { file, errors: [], widths: [], interactions: [] }
  try {
    await page.goto(`${base}/cardspec-lab.html`)
    await page.getByText('输入 DSL 验证', { exact: true }).click()
    await page.getByLabel('DSL源码', { exact: true }).fill(record.source)
    await page.getByRole('button', { name: '应用源码' }).click()
    await page.getByRole('combobox',{name:'主题',exact:true}).selectOption(record.spec.theme)
    await page.getByRole('combobox',{name:'配色',exact:true}).selectOption(record.spec.palette)
    result.errors.push(...JSON.parse(await page.getByTestId('diagnostics').innerText()).filter((d) => d.severity === 'error').map((d) => d.message))
    for (const width of ['320', '360', '432']) {
      await page.getByLabel('宽度', { exact: true }).selectOption(width)
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
      result.widths.push({ width: Number(width), ...await page.locator('.cs-stage').evaluate((el) => ({ fit: el.dataset.csFit, density: el.dataset.csDensity, horizontalOverflow: el.scrollWidth > el.clientWidth + 1, automaticScrollRegions: el.querySelectorAll('[data-auto-overflow]').length })) })
    }
    result.errors.push(...await page.locator('[data-cs-error]').allTextContents())
    await page.getByLabel('宽度', { exact: true }).selectOption('320')
    const card = page.locator('.cs-card')
    if (record.name === 'carousel') {
      const next = card.getByRole('button',{name:'下一项',exact:true})
      if (await next.count() && await next.isEnabled()) { await next.click(); await page.waitForFunction(()=>document.querySelector('.cs-carousel')?.dataset.activeIndex==='1'); result.interactions.push({action:'carousel next',passed:true}) }
      else result.interactions.push({action:'carousel next',passed:false})
    }
    if (['mindmap','flowchart'].includes(record.name)) {
      const node=card.locator('.cs-diagram-node').nth(1)
      await node.click(); result.interactions.push({action:'node select',passed:await node.getAttribute('aria-pressed')==='true'})
    }
    if (record.name==='chart') {
      const point=card.locator('.cs-chart-labels button').nth(1)
      await point.click(); result.interactions.push({action:'data select',passed:await point.getAttribute('aria-pressed')==='true'})
    }
    if (record.name === 'calendar') {
      await card.locator('[data-date="2026-08-15"]').click()
      result.interactions.push({ action: 'select date', passed: (await card.innerText()).includes('图书馆开放科学作品展') })
      await card.locator('[data-date="2026-08-03"]').click()
      result.interactions.push({ action: 'empty date', passed: /暂无新闻|没有新闻|无新闻/.test(await card.innerText()) })
      await card.getByRole('button', { name: '下个月', exact: true }).click()
      result.interactions.push({ action: 'next month', passed: await card.locator('[data-date^="2026-09-"]').count() === 30 })
    }
    const checkbox = card.getByRole('checkbox').first()
    if (await checkbox.count()) { await checkbox.check(); result.interactions.push({ action: 'check', passed: await checkbox.isChecked() }) }
    const input = card.locator('input:not([type=checkbox]),textarea').filter({visible:true}).first()
    if (await input.count()) {
      const type = await input.getAttribute('type')
      if (type === 'range') { const before=await input.inputValue(); await input.focus(); await input.press(Number(before)===Number(await input.getAttribute('max'))?'ArrowLeft':'ArrowRight'); result.interactions.push({action:'slider',passed:await input.inputValue()!==before}) }
      else { const value = type === 'number' ? '321' : type === 'date' ? '2026-10-13' : 'QA 保持输入'
        await input.fill(value); result.interactions.push({ action: 'input', passed: await input.inputValue() === value }) }
    }
    const radios = card.getByRole('radio')
    if (await radios.count() > 1) { await radios.nth(1).click(); result.interactions.push({ action: 'select', passed: await radios.nth(1).getAttribute('aria-checked') === 'true' }) }
    if(record.name==='lebesgue') {
      await card.getByRole('button',{name:'思想实验：覆盖有理点',exact:true}).click()
      const dialog=page.getByRole('dialog'),slider=dialog.getByRole('slider'),before=await dialog.innerText()
      await slider.press('ArrowRight')
      result.interactions.push({action:'experiment slider updates visible result',passed:await dialog.innerText()!==before})
      await dialog.getByRole('button').first().click()
    }
    if (['counter', 'water'].includes(record.name)) {
      const buttons = card.getByRole('button')
      const button = buttons.filter({ hasText: /增加|加一|记录一杯|记一杯|喝一杯|[+＋]\s*1|^[+＋]$/ }).first()
      if (await button.count()) { const before = await card.innerText(); await button.click(); result.interactions.push({ action: 'increment', passed: await card.innerText() !== before }) }
      else result.interactions.push({ action: 'increment', passed: false, reason: 'no expected control found' })
    }
    result.errors.push(...await page.locator('[data-cs-error],.cs-action-error').allTextContents())
    if (record.round === 1) await page.screenshot({ path: `${folder}/screenshots/${file.replace('.json','.png')}` })
  } catch (e) { result.errors.push(e.message.split('\n')[0]) }
  result.passed = !result.errors.length && result.widths.length === 3 && result.widths.every((w) => w.fit === 'fit' && !w.horizontalOverflow) && result.interactions.every((i) => i.passed)
  results.push(result); console.log(`${file}: ${result.passed ? 'passed' : JSON.stringify(result)}`)
  await writeFile(`${folder}/replay.json`, JSON.stringify(results, null, 2))
}
await browser.close()
console.log(JSON.stringify({ total: results.length, passed: results.filter((r) => r.passed).length }))
