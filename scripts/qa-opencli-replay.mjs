import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {chromium,expect} from '@playwright/test'
import {TOOLS} from '../shared/cardspec/tools.mjs'
import {normalizeOpenCli} from '../server/tools/opencli.mjs'
const out='artifacts/opencli-qa/generated'
await mkdir(`${out}/screenshots`,{recursive:true})
const reads=JSON.parse(await readFile('artifacts/opencli-qa/real-reads.json','utf8'))
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
const results=[]
for(const [id,button,field,value] of [['weather','查询天气','location','Beijing'],['trains','查询车次',null,null],['books','搜索图书','query','活着'],['movies','搜索电影','keyword','流浪地球'],['music','播放音乐','query','林俊杰'],['image','去除背景','image','https://example.com/new.jpg']]){
 const record=JSON.parse(await readFile(`${out}/${id}.json`,'utf8')),page=await browser.newPage({viewport:{width:1100,height:950}}),calls=[],errors=[]
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(6000)
 await page.route('**/api/tools/prepare',async route=>{const p=route.request().postDataJSON();await route.fulfill({json:{token:'qa-ticket',description:TOOLS[p.tool].description,input:p.input,notice:'QA：可控工具替身，不执行外部写操作'}})})
 await page.route('**/api/tools/invoke',async route=>{
  const p=route.request().postDataJSON();calls.push(p)
  let value=reads.find(r=>r.tool===p.tool)?.value
  if(!value)value=normalizeOpenCli(p.tool,p.tool.includes('douban')?[{title:'测试电影',rating:8.5,id:'123',url:'https://movie.douban.com/subject/123/'}]:p.tool.includes('spotify')?[{track:'测试曲目',artist:'测试歌手',album:'测试专辑',status:'playing',progress:'0:10/3:00'}]:[{status:'processed',url:'https://example.com/output.png'}])
  await route.fulfill({contentType:'text/event-stream',body:[{type:'result',result:{kind:'json',value}},{type:'done'}].map(f=>'data: '+JSON.stringify({...f,requestId:p.requestId,pageId:p.pageId})+'\n\n').join('')})
 })
 const result={id,status:'failed',errors,requests:[],widths:[]}
 try{
  await page.goto('http://127.0.0.1:8787/cardspec-lab.html?fixture=counter')
  await page.getByText('输入 DSL 验证',{exact:true}).click();await page.getByLabel('DSL源码').fill(record.source);await page.getByRole('button',{name:'应用源码',exact:true}).click()
  await expect(page.getByTestId('diagnostics')).toHaveText('[]')
  for(const width of [320,360,432]){await page.getByLabel('宽度',{exact:true}).selectOption(String(width));expect(await page.locator('.cs-stage').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);result.widths.push(width)}
  if(field)await page.locator('.cs-card input:not([type=checkbox])').first().fill(value)
  const before=calls.length
  await page.getByRole('button',{name:button,exact:true}).click()
  if(['music','image'].includes(id)){
   await expect(page.getByRole('dialog',{name:'确认外部操作'})).toContainText(value)
   expect(calls.filter(p=>TOOLS[p.tool].readOnly===false)).toHaveLength(0)
   await page.getByRole('button',{name:'确认执行',exact:true}).click()
  }
  await expect.poll(()=>calls.length).toBeGreaterThan(before)
  const last=calls.findLast(p=>id==='music'?p.tool.endsWith('.play'):true)
  if(field)expect(last.input[field]).toBe(value)
  await expect(page.locator('[data-cs-error],.cs-action-error')).toHaveCount(0)
  await page.locator('.cs-tool-card').screenshot({path:`${out}/screenshots/${id}.png`})
  result.status=errors.length?'failed':'passed'
 }catch(e){errors.push(e.message.slice(0,600))}
 result.requests=calls.map(p=>({tool:p.tool,input:p.input,confirmed:!!p.confirmationToken}));results.push(result)
 await page.close();await writeFile(`${out}/replay.json`,JSON.stringify(results,null,2));console.log(id,result.status,errors.join(';'))
}
await browser.close()
