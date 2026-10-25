import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {chromium,expect} from '@playwright/test'
import {validateToolInput} from '../shared/cardspec/tools.mjs'
import {normalizeOpenCli} from '../server/tools/opencli.mjs'
const contract=process.argv.includes('--data-contract')
const out=contract?'artifacts/12306-qa-fixed':'artifacts/opencli-expanded';await mkdir(out+'/screenshots',{recursive:true})
const reads=[...JSON.parse(await readFile('artifacts/opencli-expanded/real-results.json','utf8')).results,...(contract?JSON.parse(await readFile(out+'/real-results.json','utf8')).results:[])]
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
const cases=contract?[['trains',null],['podcasts','搜索','opencli.apple-podcasts.episodes'],['games','搜索','opencli.steam.app']]:[['podcasts','搜索节目','opencli.apple-podcasts.episodes'],['encyclopedia','搜索','opencli.wikipedia.summary'],['dictionary','查询'],['cars','查询车系','opencli.autohome.score'],['games','搜索','opencli.steam.app'],['doubanTop',null],['finance','查询'],['video',null,'opencli.bilibili.video']]
const results=[]
for(const [id,button,detailTool] of cases){
 const record=JSON.parse(await readFile(`${out}/generated/${id}.json`,'utf8')),page=await browser.newPage({viewport:{width:1100,height:950}}),calls=[],errors=[]
 const result={id,status:'failed',scope:'real GLM source + recorded real rows; uncaptured detail responses are controlled empty results',widths:[],requests:[],errors}
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(7000)
 await page.route('**/api/tools/invoke',async route=>{
  const p=route.request().postDataJSON();calls.push(p)
  try{validateToolInput(p.tool,p.input)}catch(e){errors.push(e.message)}
  const captured=reads.findLast(r=>r.tool===p.tool&&r.status==='passed')
  const value=normalizeOpenCli(p.tool,captured?.value.items||[])
  await route.fulfill({contentType:'text/event-stream',body:[{type:'result',result:{kind:'json',value}},{type:'done'}].map(f=>'data: '+JSON.stringify({...f,requestId:p.requestId,pageId:p.pageId})+'\n\n').join('')})
 })
 try{
  await page.goto('http://127.0.0.1:8787/cardspec-lab.html?fixture=counter')
  await page.getByText('输入 DSL 验证',{exact:true}).click();await page.getByLabel('DSL源码').fill(record.source);await page.getByRole('button',{name:'应用源码',exact:true}).click()
  await expect(page.getByTestId('diagnostics')).toHaveText('[]')
  if(button)await page.locator('.cs-card').getByRole('button',{name:button,exact:true}).click()
  await expect.poll(()=>calls.length).toBeGreaterThan(0)
  if(detailTool){
   const press=page.locator('.cs-card [data-cs-type="pressable"],.cs-card .cs-pressable').first()
   await press.click();await expect.poll(()=>calls.some(c=>c.tool===detailTool)).toBe(true)
   if(contract&&id==='games'){
    const detail=reads.findLast(r=>r.tool===detailTool&&r.status==='passed')?.value.items[0]
    if(!detail?.shortDescription)throw Error('Missing recorded detail description for assertion')
    await expect(page.locator('.cs-card')).toContainText(detail.shortDescription)
   }
   if(contract&&id==='podcasts')await expect(page.locator('.cs-card')).toContainText('暂无返回的单集数据')
  }
  for(const width of [320,360,432]){await page.getByLabel('宽度',{exact:true}).selectOption(String(width));expect(await page.locator('.cs-stage').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);result.widths.push(width)}
  await expect(page.locator('[data-cs-error],.cs-action-error')).toHaveCount(0)
  await page.locator('.cs-tool-card').screenshot({path:`${out}/screenshots/${id}.png`})
  result.status=errors.length?'failed':'passed'
 }catch(e){errors.push(e.message.slice(0,900))}
 result.requests=calls.map(p=>({tool:p.tool,input:p.input}));results.push(result);await page.close()
 await writeFile(out+'/replay.json',JSON.stringify(results,null,2));console.log(JSON.stringify({id,status:result.status,errors}))
}
await browser.close()
