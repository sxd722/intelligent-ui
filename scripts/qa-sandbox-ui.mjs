import {chromium} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
const out='artifacts/sandbox-qa',browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true})
const results=[]
try{
 for(const mode of ['native','hybrid']){
  const record=JSON.parse(await readFile(`${out}/live-${mode}.json`,'utf8'));if(record.status!=='succeeded')throw Error(mode+' generation failed')
  const context=await browser.newContext({viewport:{width:1080,height:1000}}),page=await context.newPage()
  await page.addInitScript(m=>{try{localStorage.setItem('cardspec:render-mode:v1',m);localStorage.setItem('cardspec:card-size:v1','auto')}catch{}},mode)
  const requests=[];page.on('request',r=>{if(r.url().endsWith('/api/tools/invoke'))requests.push(r.postDataJSON())})
  await page.goto('http://127.0.0.1:8787/cardspec-lab.html?fixture=sandboxPure')
  await page.getByLabel('卡片尺寸').selectOption('auto')
  await page.getByText('输入 DSL 验证',{exact:true}).click();await page.getByLabel('DSL源码').fill(record.source);await page.getByRole('button',{name:'应用源码'}).click()
  const target=mode==='hybrid'?page.frameLocator('iframe'):page.locator('.cs-stage')
  await target.getByRole('button',{name:/推进|step/i}).first().waitFor({timeout:160000})
  for(const p of requests){const response=await fetch('http://127.0.0.1:8787/api/tools/invoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});await writeFile(`${out}/live-surface-trace.txt`,await response.text());await writeFile(`${out}/live-surface-request.json`,JSON.stringify(p,null,2))}
  const before=await target.locator(mode==='hybrid'?'body':':scope').innerText()
  await target.getByRole('button',{name:/推进|step/i}).first().click()
  await target.getByText(/50/).first().waitFor({timeout:8000})
  const after=await target.locator(mode==='hybrid'?'body':':scope').innerText()
  await page.locator('.cs-stage').screenshot({path:`${out}/live-${mode}.png`})
  await target.getByRole('button',{name:/重置|reset/i}).first().click();await target.getByText(/60/).first().waitFor({timeout:8000})
  for(let i=0;i<6;i++){await target.getByRole('button',{name:/推进|step/i}).first().click();await target.getByText(String(60-(i+1)*10),{exact:true}).first().waitFor()}
  if(!await target.getByRole('button',{name:/推进|step/i}).first().isDisabled())throw Error('Depleted simulation still allows advance')
  await target.getByRole('button',{name:/充能|charge/i}).first().click();await target.getByText('15',{exact:true}).first().waitFor()
  results.push({mode,status:'passed',before,after,surfaceCalls:requests.length,checks:['advance','reset','six-step-depletion','disabled-at-zero','charge-recovery']})
  await context.close()
 }
}catch(e){results.push({status:'failed',error:e.message});process.exitCode=1}
finally{await writeFile(`${out}/live-interactions.json`,JSON.stringify(results,null,2));await browser.close()}
console.log(JSON.stringify(results.map(({before,after,...x})=>x)))
