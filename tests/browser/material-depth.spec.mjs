import { test, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const tokens = ['photo-glass','tinted-glass','liquid-glass','frosted-glass','smoked-glass']
const folder = 'artifacts/material-depth-qa'
mkdirSync(folder, { recursive: true })
const probe = `<card><title id="title">文字可读性</title><caption id="muted" tone="muted">辅助说明文字</caption>
  <text id="success" tone="success">成功状态</text><text id="warning" tone="warning">提示状态</text><text id="danger" tone="danger">错误状态</text><text id="info" tone="info">信息状态</text>
  <pressable id="plain"><text id="plainText">未选中的玻璃列表</text><badge id="plainBadge">日期标签</badge></pressable>
  <pressable id="selected" selected={true}><text id="selectedText">选中的列表</text><badge id="selectedBadge">日期标签</badge></pressable>
  <box id="panel" surface="soft"><caption id="panelText" tone="muted">玻璃面板上的说明</caption></box></card>`

// Measure the browser's final composited pixels (including blend/blur/sheen),
// not just a translucent CSS background color treated as if it were opaque.
async function renderedContrast(page) {
  const samples = await page.locator('.cs-stage').evaluate(stage => {
    const origin = stage.getBoundingClientRect()
    return [...stage.querySelectorAll('.cs-title,.cs-text,.cs-caption,.cs-badge')].map(el => {
      const range = document.createRange(); range.selectNodeContents(el)
      const r = range.getBoundingClientRect()
      return { text: el.textContent, color: getComputedStyle(el).color, x: r.x-origin.x, y: r.y-origin.y, width: r.width, height: r.height }
    })
  })
  const hideInk = await page.addStyleTag({ content: '.cs-card * { color:transparent!important; text-shadow:none!important; }' })
  const bytes = await page.locator('.cs-stage').screenshot({ animations:'disabled' })
  await hideInk.evaluate(el => el.remove())
  return page.evaluate(async ({ png, samples }) => {
    const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode()
    const canvas = document.createElement('canvas'); canvas.width=image.width; canvas.height=image.height
    const ctx=canvas.getContext('2d'); ctx.drawImage(image,0,0)
    const pixels=ctx.getImageData(0,0,image.width,image.height).data
    const lum=rgb=>rgb.map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4}).reduce((s,c,i)=>s+c*[.2126,.7152,.0722][i],0)
    return samples.map(s=>{
      const fg=lum(s.color.match(/[\d.]+/g).slice(0,3).map(Number)); let minimum=100
      for(let y=Math.ceil(s.y)+1;y<Math.min(image.height,s.y+s.height-1);y+=2) for(let x=Math.ceil(s.x)+1;x<Math.min(image.width,s.x+s.width-1);x+=2) {
        const offset=(y*image.width+x)*4, bg=lum([...pixels.slice(offset,offset+3)])
        minimum=Math.min(minimum,(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05))
      }
      return {text:s.text,contrast:minimum}
    })
  }, {png:bytes.toString('base64'),samples})
}

test('composited normal, muted, semantic and selected text stays readable over extreme photos', async ({ page }) => {
  test.setTimeout(60000)
  let photo = 'white'
  await page.route('**/api/image?**', route => route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><rect width="640" height="640" fill="${photo}"/></svg>`}))
  await page.goto('/cardspec-lab.html')
  await page.getByText('输入 DSL 验证',{exact:true}).click()
  await page.getByLabel('DSL源码').fill(probe)
  await page.getByRole('button',{name:'应用源码',exact:true}).click()
  await page.getByRole('button',{name:'模拟结束'}).click()
  const results=[]
  for(const extreme of ['white','black']) {
    photo=extreme
    for(const token of tokens) {
      await page.getByLabel('风格',{exact:true}).selectOption(token)
      await page.getByLabel('背景关键词',{exact:true}).fill(`${extreme} ${token}`)
      await expect(page.locator('.cs-background')).toHaveAttribute('data-status','loaded')
      await expect(page.getByTestId('diagnostics')).toHaveText('[]')
      await expect(page.locator('.cs-stage')).toHaveAttribute('data-cs-fit','fit')
      const contrast=await renderedContrast(page)
      results.push({token,photo:extreme,contrast})
      writeFileSync(`${folder}/contrast.json`,JSON.stringify(results,null,2))
      for(const sample of contrast) expect.soft(sample.contrast,`${token}/${extreme}: ${sample.text}`).toBeGreaterThanOrEqual(4.5)
    }
  }
})

test('materials cross-check calendar, carousel, chart, checklist and input at 320 and 432', async ({ page }) => {
  test.setTimeout(90000)
  await page.goto('/cardspec-lab.html')
  await page.getByRole('button',{name:'模拟结束'}).click()
  for(const fixture of ['calendar','carousel','chart','checklist','counter']) {
    await page.getByLabel('样例',{exact:true}).selectOption(fixture)
    for(const token of tokens) {
      await page.getByLabel('风格',{exact:true}).selectOption(token)
      for(const width of ['320','432']) {
        await page.getByLabel('宽度',{exact:true}).selectOption(width)
        await expect(page.locator('.cs-stage')).toHaveAttribute('data-cs-fit','fit')
        await expect(page.locator('[data-cs-error]')).toHaveCount(0)
        await expect(page.getByTestId('diagnostics')).toHaveText('[]')
        if(fixture==='calendar') expect(await page.locator('.cs-calendar-grid button:not([data-selected="true"])').first().evaluate(el=>({blur:getComputedStyle(el).backdropFilter,shadow:getComputedStyle(el).boxShadow}))).toEqual({blur:'none',shadow:'none'})
      }
    }
    if(fixture==='calendar') { await page.locator('[data-date="2026-08-02"]').click(); await expect(page.locator('.cs-region')).toContainText('研究发布') }
    if(fixture==='carousel') { await page.getByLabel('整理备注').fill('保留输入'); await page.getByRole('button',{name:'下一项'}).click(); await page.getByRole('button',{name:'上一项'}).click(); await expect(page.getByLabel('整理备注')).toHaveValue('保留输入') }
    if(fixture==='chart') { await page.getByRole('button',{name:'周二 -10元',exact:true}).click(); await expect(page.locator('.cs-card')).toContainText('tue：-10元') }
    if(fixture==='checklist') { await page.getByRole('checkbox').first().check(); await expect(page.locator('.cs-card')).toContainText('已完成 1 / 20') }
    if(fixture==='counter') { await page.getByRole('button',{name:'增加一次',exact:true}).click(); await expect(page.locator('.cs-card')).toContainText('当前计数 1') }
    await page.locator('.cs-stage').screenshot({path:`${folder}/${fixture}-smoked.png`,animations:'disabled'})
  }
})

test('shadow detail survives the veil and nested panels do not stack blur layers', async ({ page }) => {
  await page.route('**/api/image?**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><rect width="320" height="640" fill="#282828"/><rect x="320" width="320" height="640" fill="#505050"/></svg>'}))
  await page.goto('/cardspec-lab.html')
  await page.getByLabel('风格',{exact:true}).selectOption('smoked-glass')
  await expect(page.locator('.cs-background')).toHaveAttribute('data-status','loaded')
  const hideContent=await page.addStyleTag({content:'.cs-card { visibility:hidden!important; }'})
  const png=await page.locator('.cs-background').screenshot({animations:'disabled'})
  await hideContent.evaluate(el=>el.remove())
  const levels=await page.evaluate(async png=>{
    const img=new Image();img.src=`data:image/png;base64,${png}`;await img.decode()
    const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0)
    return [.25,.75].map(x=>ctx.getImageData(Math.floor(img.width*x),Math.floor(img.height*.5),1,1).data[0])
  },png.toString('base64'))
  expect(levels[0]).toBeGreaterThanOrEqual(45)
  expect(levels[1]-levels[0]).toBeGreaterThanOrEqual(25)
  await page.getByText('输入 DSL 验证',{exact:true}).click()
  await page.getByLabel('DSL源码').fill('<card><box id="outer" surface="soft"><pressable id="inner"><text id="label">Nested</text></pressable></box><pressable id="separate"><text id="other">Separate</text></pressable></card>')
  await page.getByRole('button',{name:'应用源码'}).click()
  await page.getByRole('button',{name:'模拟结束'}).click()
  expect(await page.getByRole('button',{name:'Nested',exact:true}).evaluate(el=>getComputedStyle(el).backdropFilter)).toBe('none')
  expect(await page.getByRole('button',{name:'Separate',exact:true}).evaluate(el=>getComputedStyle(el).backdropFilter)).toContain('blur(')
  const session=await page.context().newCDPSession(page)
  await session.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]})
  await expect(page.locator('.cs-background img')).toBeHidden()
  expect(await page.getByRole('button',{name:'Separate',exact:true}).evaluate(el=>getComputedStyle(el).backdropFilter)).toBe('none')
})
