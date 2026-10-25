import {chromium,expect} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
const out='artifacts/cardspec-capabilities-v2',base=process.env.QA_BASE||'http://127.0.0.1:8794',results=[]
await mkdir(out+'/screenshots',{recursive:true})
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
try{for(const fixture of ['capabilityData','capabilityMatrix','capabilityCollection','capabilityTime']){
 const page=await browser.newPage({viewport:{width:1040,height:1100}});page.setDefaultTimeout(5000)
 const row={fixture,checks:[],layouts:[],errors:[]};results.push(row)
 page.on('pageerror',e=>row.errors.push(e.message))
 await page.route('**/api/**',route=>route.fulfill({json:{tools:[],enabled:false,browser:{connected:false}}}))
 try{
 await page.goto(base+'/cardspec-lab.html?fixture='+fixture,{waitUntil:'domcontentloaded',timeout:30000})
 const card=page.locator('.cs-card');await expect(card).toBeVisible()
 await page.getByLabel('卡片尺寸').selectOption('auto')
 await expect(page.getByTestId('diagnostics')).not.toContainText('"severity": "error"')
 if(fixture==='capabilityData'){
  await expect(card).toContainText('样本 3');await expect(card).toContainText('宿主记录：未保存')
  await card.getByRole('button',{name:'保存选择',exact:true}).click();await expect(card).toContainText('宿主记录：A / 3')
  await card.getByRole('button',{name:'切换来源筛选'}).click();await expect(card).toContainText('样本 2');await expect(card).toContainText('宿主记录：A / 3')
  await card.getByRole('button',{name:'模拟局部错误'}).click();await expect(card.getByRole('alert')).toBeVisible();await expect(card).toContainText('样本 2')
  await card.getByRole('button',{name:'切换来源筛选'}).click();await expect(card).toContainText('样本 3');await expect(card.getByRole('alert')).toHaveCount(0)
  row.checks.push('reactive tool-like input; host bridge only on explicit click; failure isolation; subsequent recovery')
 }
 if(fixture==='capabilityMatrix'){
  await expect(card).toContainText('输出首项 1.700')
  await card.getByRole('button',{name:'关闭残差'}).click();await expect(card).toContainText('输出首项 0.700')
  await card.getByRole('button',{name:'token B / h₂：1.2',exact:true}).click();await expect(card).toContainText('观察 b / h2')
  await card.getByRole('button',{name:'保存输出'}).click();await expect(card).toContainText('保存的输出：0.700')
  const slider=card.getByRole('slider');await slider.fill('2');await expect(card).toContainText('输出首项 1.260');await expect(card).toContainText('观察 b / h2');await expect(card).toContainText('保存的输出：0.700')
  row.checks.push('matrix/FFN arithmetic; residual toggle; heatmap selection preserved after input; committed snapshot stable')
 }
 if(fixture==='capabilityCollection'){
  await card.getByRole('button',{name:/城市路线/}).click();await expect(card).toContainText('预计 90 分钟')
  await card.getByRole('button',{name:'固定路线',exact:true}).click();await expect(card).toContainText('已固定 1 条')
  await card.getByRole('button',{name:'回到第一条'}).click();await expect(card).toContainText('预计 60 分钟')
  await expect(card.getByRole('button',{name:/湖边路线/})).toHaveAttribute('aria-pressed','true')
  await expect(card.locator('.cs-collection-detail')).toHaveCount(0)
  row.checks.push('controlled collection reset; independent pin state; one detail owner')
 }
 if(fixture==='capabilityTime'){
  await expect(card.getByRole('timer')).toHaveText('时间待确认')
  await card.getByRole('button',{name:'固定去程 A'}).click();await card.getByRole('button',{name:'固定返程 B'}).click()
  await card.getByLabel('确认的开放时间（北京时间）').fill('2020-01-01T08:00')
  await expect(card.getByRole('timer')).toHaveAttribute('data-status','expired')
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('denied')}}}))
  await card.getByRole('button',{name:'复制安排'}).click();await expect(card.getByLabel('请手动复制')).toHaveValue('去程 A / 返程 B')
  row.checks.push('unknown/expired absolute clock; time input; two pinned choices; clipboard denial fallback')
 }
 for(const size of ['square','auto'])for(const width of [320,360,432]){
  await page.getByLabel('卡片尺寸').selectOption(size);await page.getByLabel('宽度',{exact:true}).selectOption(String(width));await page.waitForTimeout(220)
  const layout=await card.evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth,verticalScroll:el.scrollHeight>el.clientHeight+2}))
  if(layout.scrollWidth>layout.width+2)throw Error('horizontal card overflow '+JSON.stringify(layout))
  row.layouts.push({width,size,...layout})
 }
 await page.screenshot({path:`${out}/screenshots/${fixture}.png`,fullPage:true});row.passed=true
 }catch(e){row.passed=false;row.failure=e.message;await page.screenshot({path:`${out}/screenshots/${fixture}-failure.png`,fullPage:true})}
 console.log(JSON.stringify(row));await page.close()
}}finally{await browser.close();await writeFile(out+'/browser.json',JSON.stringify(results,null,2))}
if(results.some(r=>!r.passed||r.errors.length))process.exitCode=1
