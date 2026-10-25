import {chromium,expect} from '@playwright/test'
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises'
const opts=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')))
const folders=(opts.input||'artifacts/capabilities-glm-rich,artifacts/capabilities-glm-rich-recheck').split(','),out=opts.out||'artifacts/capabilities-rich-replay'
const records=new Map();for(const folder of folders)for(const file of await readdir(folder))if(/^\d\d-.*-cardspec\.json$/.test(file)){const r=JSON.parse(await readFile(`${folder}/${file}`,'utf8'));records.set(r.result.id,{...r,file:`${folder}/${file}`})}
await mkdir(`${out}/screenshots`,{recursive:true})
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),results=[]
for(const [id,r]of records){
  if(opts.cases&&!opts.cases.split(',').includes(id))continue
  const page=await browser.newPage({viewport:{width:1000,height:900}}),result={id,file:r.file,errors:[],widths:[],checks:[]}
  page.on('pageerror',e=>result.errors.push(e.message));page.setDefaultTimeout(7000)
  try{
    if(r.result.status!=='succeeded')throw Error('Generation failed')
    await page.route('**/api/chat',route=>route.fulfill({contentType:'text/event-stream',body:r.frames.map(({frame})=>`data: ${JSON.stringify(frame)}\n\n`).join('')+'data: [DONE]\n\n'}))
    await page.goto(opts.base||'http://127.0.0.1:8787')
    await page.getByLabel('渲染协议').selectOption('cardspec');await page.getByRole('button',{name:/Pipeline: 3-phase/}).click()
    await page.getByPlaceholder('描述你想要的交互卡片…').fill(r.prompt);await page.getByRole('button',{name:'发送',exact:true}).click()
    await page.getByRole('button',{name:'停止',exact:true}).waitFor({state:'hidden'})
    const card=page.locator('.cs-card').last(),stage=page.locator('.cs-stage').last()
    if(id.includes('mermaid'))await expect(card.locator('.cs-mermaid-svg svg')).toHaveCount(1)
    if(id==='31-code-math')await expect(card.locator('.katex')).toHaveCount(1)
    for(const width of [320,432]){
      await stage.evaluate((el,w)=>{el.style.width=`${w}px`;el.style.maxWidth='none'},width)
      await page.waitForTimeout(250)
      result.widths.push(await stage.evaluate(el=>({width:el.clientWidth,fit:el.dataset.csFit,horizontalOverflow:el.scrollWidth>el.clientWidth+1})))
    }
    if(id.includes('mermaid')){
      if(!id.endsWith('-xy')){const node=card.locator('.cs-mermaid-svg').getByRole('button').first();await node.click();await expect(node).toHaveAttribute('aria-pressed','true')}
      await card.getByRole('button',{name:'展开图形'}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'收起图形'}).click();result.checks.push('SVG、节点选择/XY展示、展开与收起')
    }
    if(id==='27-choices'){
      await card.getByRole('combobox').selectOption('下午');await card.locator('.cs-radio-group').getByRole('radio').last().check();await card.locator('.cs-segmented').getByRole('radio').last().click();await expect(card).toContainText('下午');result.checks.push('下拉、纵向单选、分段选择')
    }
    if(id==='28-table'){await card.locator('table').getByRole('button').nth(1).click();await expect(card.locator('table').getByRole('button').nth(1)).toHaveAttribute('aria-pressed','true');result.checks.push('表格行选择')}
    if(id==='29-swipe'){
      await card.locator('.cs-swipe-actions').getByRole('button').last().click();await card.locator('.cs-swipe-actions').getByRole('button').first().click();await card.locator('.cs-swipe-actions').getByRole('button').last().click();await expect(card).toContainText('2');await card.getByRole('button',{name:/重新开始/}).click();await expect(card.locator('.cs-swipe')).toContainText('1 / 3');result.checks.push('收藏、跳过、终局、重开')
    }
    if(id==='30-popover'){
      await card.locator('.cs-popover-owner>button').click();const d=page.getByRole('dialog');await expect(d).toBeVisible();await d.locator('input,textarea').first().fill('保留测试');await d.locator('input,textarea').first().press('Escape');await expect(d).not.toBeVisible();await card.locator('.cs-popover-owner>button').click();await expect(d.locator('input,textarea').first()).toHaveValue('保留测试');await d.getByRole('button',{name:'关闭浮层'}).click();result.checks.push('受控浮层关闭重开、输入保留')
    }
    if(id==='31-code-math'){await expect(card.locator('code')).toContainText('total / count');await expect(card.locator('math')).toHaveCount(1);result.checks.push('代码字面量与公式')}
    result.errors.push(...await page.locator('[data-cs-error],.cs-action-error').allTextContents())
    await stage.screenshot({path:`${out}/screenshots/${id}.png`})
  }catch(e){result.errors.push(e.message)}
  result.passed=!result.errors.length&&result.widths.length===2&&result.widths.every(w=>!w.horizontalOverflow&&w.fit==='fit')
  results.push(result);await page.close();await writeFile(`${out}/replay.json`,JSON.stringify(results,null,2));console.log(`${id}: ${result.passed?'PASS':JSON.stringify(result)}`)
}
await browser.close();if(results.some(r=>!r.passed))process.exitCode=1
