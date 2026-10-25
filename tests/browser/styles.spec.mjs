import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { counter } from '../../shared/cardspec/fixtures.mjs'

const STYLES = ['photo-glass', 'tinted-glass', 'liquid-glass', 'frosted-glass', 'smoked-glass']
mkdirSync('artifacts/style-token-qa/screenshots', { recursive: true })

async function lab(page, fixture = 'counter', width = '320') {
  await page.goto('/cardspec-lab.html')
  await page.getByLabel('样例', { exact: true }).selectOption(fixture)
  await page.getByLabel('宽度', { exact: true }).selectOption(width)
  await expect(page.getByTestId('diagnostics')).toHaveText('[]')
  await expect(page.locator('.cs-stage')).toHaveAttribute('data-cs-fit', 'fit')
}

async function style(page, token) {
  await page.getByLabel('风格', { exact: true }).selectOption(token)
  await expect(page.locator('.cs-stage')).toHaveAttribute('data-visual-style', token)
  await expect(page.locator('.cs-background')).toHaveAttribute('data-status', 'loaded')
}

// Change the same React controls without moving focus away from the card input.
async function changeWithoutFocus(locator, value) {
  await locator.evaluate((el, value) => {
    el.value = value
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

async function fits(page) {
  await expect(page.locator('.cs-stage')).toHaveAttribute('data-cs-fit', 'fit')
  await expect(page.locator('[data-cs-error]')).toHaveCount(0)
  const geometry = await page.locator('.cs-stage').evaluate((el) => {
    const card = el.querySelector('.cs-card')
    return { width: el.clientWidth, height: el.clientHeight, scroll: el.scrollWidth, cardWidth: card.clientWidth, cardScroll: card.scrollWidth }
  })
  expect(Math.abs(geometry.width - geometry.height)).toBeLessThanOrEqual(1)
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.width + 1)
  expect(geometry.cardScroll).toBeLessThanOrEqual(geometry.cardWidth + 1)
}

async function opaqueContrast(locator) {
  return locator.evaluate((el) => {
    const ctx = document.createElement('canvas').getContext('2d')
    const rgba = (color) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data] }
    const luminance = (values) => values.slice(0, 3).map((v) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
    const s = getComputedStyle(el), fg = rgba(s.color), bg = rgba(s.backgroundColor)
    const a = luminance(fg), b = luminance(bg)
    return { ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), alpha: bg[3] }
  })
}

test('five material tokens load a decorative background, remain readable and fit 320/432 cards', async ({ page }) => {
  test.setTimeout(60000)
  await lab(page)
  for (const token of STYLES) {
    await style(page, token)
    for (const width of ['320', '432']) {
      await page.getByLabel('宽度', { exact: true }).selectOption(width)
      await fits(page)
      await expect(page.getByRole('heading', { name: '计数与输入', exact: true })).toBeVisible()
      await expect(page.getByLabel('备注', { exact: true })).toBeVisible()
      const background = page.locator('.cs-background')
      await expect(background).toHaveAttribute('aria-hidden', 'true')
      await expect(background.locator('img')).toHaveAttribute('alt', '')
      expect(await background.evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none')
      expect(await background.locator('img').evaluate(el => getComputedStyle(el).objectFit)).toBe('cover')
      expect(await page.locator('.cs-background-scrim').evaluate(el => getComputedStyle(el).backgroundImage)).not.toBe('none')
      const action = page.getByRole('button', { name: '增加一次', exact: true })
      const contrast = await opaqueContrast(action)
      expect(contrast.alpha, `${token}: primary button must isolate its text from the photo`).toBe(255)
      expect(contrast.ratio, `${token}: primary button contrast`).toBeGreaterThanOrEqual(4.5)
      if (width === '320') await page.locator('.cs-stage').screenshot({ path: `artifacts/style-token-qa/screenshots/${token}-320.png`, animations: 'disabled' })
    }
  }
})

test('dense calendar and paginated checklist retain selection and readable geometry with every material', async ({ page }) => {
  test.setTimeout(60000)
  await lab(page, 'calendar')
  for (const token of STYLES) {
    await style(page, token)
    await page.locator('[data-date="2026-08-02"]').click()
    await expect(page.locator('.cs-region')).toContainText('研究发布')
    await expect(page.locator('[data-date="2026-08-02"]')).toHaveAttribute('aria-pressed', 'true')
    const contrast = await opaqueContrast(page.locator('[data-date="2026-08-02"]'))
    expect(contrast.ratio, `${token}: selected date contrast`).toBeGreaterThanOrEqual(4.5)
    await fits(page)
  }
  await page.getByLabel('样例', { exact: true }).selectOption('checklist')
  await page.getByRole('checkbox').first().check()
  for (const token of STYLES) {
    await style(page, token)
    await expect(page.getByRole('checkbox').first()).toBeChecked()
    await page.getByRole('button', { name: '下一页', exact: true }).click()
    await page.getByRole('button', { name: '上一页', exact: true }).click()
    await expect(page.getByRole('checkbox').first()).toBeChecked()
    await expect(page.locator('.cs-card')).toContainText('已完成 1 / 20')
    await fits(page)
  }
})

test('material changes, image settlement and revisions keep the same focused control and runtime state', async ({ page }) => {
  await lab(page)
  await style(page, 'photo-glass')
  await page.getByRole('button', { name: '增加一次', exact: true }).click()
  const input = page.getByLabel('备注', { exact: true })
  await input.fill('输入、光标与状态保持')
  await input.focus()
  await input.evaluate(el => el.setSelectionRange(3, 5))
  const original = await input.elementHandle()
  for (const token of STYLES) {
    await changeWithoutFocus(page.getByLabel('风格', { exact: true }), token)
    await expect(page.locator('.cs-stage')).toHaveAttribute('data-visual-style', token)
    await expect(input).toBeFocused()
    expect(await input.evaluate((el, original) => el === original, original)).toBe(true)
    expect(await input.evaluate(el => [el.selectionStart, el.selectionEnd])).toEqual([3, 5])
    await expect(input).toHaveValue('输入、光标与状态保持')
    await expect(page.locator('.cs-card')).toContainText('当前计数 1')
  }
  for (const mode of ['loading', 'error', 'loaded']) {
    await changeWithoutFocus(page.getByLabel('图片', { exact: true }), mode)
    await expect(page.locator('.cs-background')).toHaveAttribute('data-status', mode)
    await expect(input).toBeFocused()
    expect(await input.evaluate((el, original) => el === original, original)).toBe(true)
  }
  await page.getByRole('button', { name: '模拟增量更新' }).evaluate(el => el.click())
  await page.getByRole('button', { name: '模拟结束' }).evaluate(el => el.click())
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('输入、光标与状态保持')
  await expect(page.locator('.cs-card')).toContainText('当前计数 1')
  await fits(page)
})

test('broken background bytes fall back without blocking controls and a new image can recover', async ({ page }) => {
  await page.route('**/api/image?**', route => route.abort())
  await lab(page)
  await page.getByLabel('风格', { exact: true }).selectOption('liquid-glass')
  await expect(page.locator('.cs-background')).toHaveAttribute('data-status', 'error')
  await page.getByRole('button', { name: '增加一次', exact: true }).click()
  await expect(page.locator('.cs-card')).toContainText('当前计数 1')
  await fits(page)
  await page.unroute('**/api/image?**')
  await page.getByLabel('背景关键词', { exact: true }).fill('quiet forest recovery')
  await expect(page.locator('.cs-background')).toHaveAttribute('data-status', 'loaded')
  await expect(page.locator('.cs-card')).toContainText('当前计数 1')
  await expect(page.locator('.cs-background img')).toBeVisible()
})

test('DSL background framing and asynchronous Pexels credit stay outside the square layout', async ({ page }) => {
  const queries = []
  await page.route('**/api/photo?**', async route => {
    const request = new URL(route.request().url())
    queries.push({ query: request.searchParams.get('query'), role: request.searchParams.get('role') })
    await route.fulfill({ json: { status: 'loaded', url: `${request.origin}/api/image?seed=forest-credit&w=640&h=640`, provider: 'Pexels', photographer: 'QA Photographer', photoUrl: 'https://www.pexels.com/photo/fixture-123/' } })
  })
  await lab(page)
  await page.getByText('输入 DSL 验证', { exact: true }).click()
  await page.getByLabel('DSL源码').fill(counter.replace('<card ', '<card visualStyle="tinted-glass" backgroundQuery="winter woods" backgroundPosition="top" '))
  await page.getByRole('button', { name: '应用源码', exact: true }).click()
  await expect(page.getByTestId('diagnostics')).toHaveText('[]')
  await page.getByLabel('图片', { exact: true }).selectOption('pexels')
  await expect(page.locator('.cs-background')).toHaveAttribute('data-status', 'loaded')
  await expect(page.locator('.cs-background')).toHaveAttribute('data-position', 'top')
  expect(await page.locator('.cs-background img').evaluate(el => getComputedStyle(el).objectPosition)).toBe('50% 0%')
  await expect(page.locator('.cs-background-credit')).toContainText('QA Photographer')
  await expect(page.locator('.cs-stage .cs-background-credit')).toHaveCount(0)
  await expect(page.locator('.cs-background-credit').getByRole('link', { name: 'QA Photographer' })).toHaveAttribute('href', 'https://www.pexels.com/photo/fixture-123/')
  expect(queries).toEqual([{ query: 'winter woods', role: 'background' }])
  await fits(page)
})

test('reduced motion disables material and component motion while interactions still update', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await lab(page)
  await page.getByRole('button', { name: '模拟结束' }).click()
  for (const token of STYLES) {
    await style(page, token)
    await page.getByRole('button', { name: '增加一次', exact: true }).click()
    const motion = await page.locator('.cs-stage').evaluate(el => {
      const toSeconds = value => value.trim().endsWith('ms') ? parseFloat(value) / 1000 : parseFloat(value)
      const nodes = [el, ...el.querySelectorAll('*')]
      return {
        durations: nodes.flatMap(node => { const s = getComputedStyle(node); return [...s.transitionDuration.split(','), ...s.animationDuration.split(',')].map(toSeconds) }),
        active: document.getAnimations().filter(animation => el.contains(animation.effect?.target) && animation.playState === 'running').length,
      }
    })
    expect(Math.max(...motion.durations)).toBeLessThanOrEqual(.001)
    expect(motion.active).toBe(0)
  }
  await expect(page.locator('.cs-card')).toContainText('当前计数 5')
})

test('legacy cards without a material token preserve their original renderer path', async ({ page }) => {
  await lab(page)
  await expect(page.locator('.cs-stage')).not.toHaveAttribute('data-visual-style', /.+/)
  await expect(page.locator('.cs-background')).toHaveCount(0)
  await page.getByRole('button', { name: '增加一次', exact: true }).click()
  await page.getByLabel('备注', { exact: true }).fill('legacy session')
  await page.getByLabel('主题', { exact: true }).selectOption('dark')
  await page.getByRole('button', { name: '模拟增量更新' }).click()
  await expect(page.locator('.cs-card')).toContainText('当前计数 1')
  await expect(page.getByLabel('备注', { exact: true })).toHaveValue('legacy session')
  await expect(page.locator('.cs-background')).toHaveCount(0)
  await fits(page)
})
