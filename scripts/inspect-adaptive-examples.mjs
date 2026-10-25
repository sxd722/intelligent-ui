import {chromium} from '@playwright/test'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
const dir='artifacts/adaptive-eval-v2/inspection';await mkdir(dir,{recursive:true})
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
const records=[]
try{
 for(const id of ['08-calendar','21-opinion','22-family','23-movies','24-mlp','25-trains']){
  const r=JSON.parse(await readFile(`artifacts/adaptive-eval-v2/adaptive-v1/r1/${id}-cardspec.json`))
  const page=await browser.newPage({viewport:{width:800,height:1000}})
  await page.goto('http://127.0.0.1:8787/cardspec-lab.html?fixture=counter')
  await page.getByLabel('宽度',{exact:true}).selectOption('360')
  await page.getByText('输入 DSL 验证',{exact:true}).click()
  await page.getByLabel('DSL源码').fill(r.source)
  await page.getByRole('button',{name:'应用源码'}).click()
  const card=page.locator('.cs-card')
  await card.waitFor({state:'visible'})
  await card.screenshot({path:`${dir}/${id}-initial.png`})
  records.push({id,diagnostics:await page.getByTestId('diagnostics').innerText(),text:await card.innerText(),buttons:await card.getByRole('button').allTextContents(),inputs:await card.locator('input').evaluateAll(xs=>xs.map(x=>({type:x.type,value:x.value,label:x.getAttribute('aria-label')})))})
  await page.close()
 }
}finally{await browser.close()}
await writeFile(dir+'/initial.json',JSON.stringify(records,null,2));console.log(JSON.stringify(records,null,2))
