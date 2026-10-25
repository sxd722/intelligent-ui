import {chromium} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const out='artifacts/web-creation',browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),results=[]
try{
 for(const [id,file]of [['energy','retry/energy'],['vectors','vectors']]){
  const record=JSON.parse(await readFile(`${out}/${file}.json`,'utf8'))
  assert.ok(record.surface?.module)
  const context=await browser.newContext({viewport:{width:1100,height:900}}),page=await context.newPage()
  let calls=0
  await page.addInitScript(()=>{try{localStorage.setItem('cardspec:render-mode:v1','hybrid')}catch{}})
  await page.route('**/api/tools/invoke',route=>{
   calls++;const p=route.request().postDataJSON()
   return route.fulfill({contentType:'text/event-stream',body:[{type:'result',result:record.surface},{type:'done'}].map(f=>'data: '+JSON.stringify({...f,requestId:p.requestId,pageId:p.pageId})+'\n\n').join('')})
  })
  await page.route('**/api/chat',route=>route.fulfill({contentType:'text/event-stream',body:[
   {type:'phase_begin',id:'qa-web',phase:'dsl',kind:'cardspec'},
   {p:'',o:'add',v:{message:{id:'qa-web',status:'succeeded',content:{parts:[record.card.source]},metadata:{format:'cardspec',card_spec:record.card.spec}}}},
   {type:'phase_end',id:'qa-web',status:'succeeded'},
   {type:'message_stream_complete',status:'succeeded'}
  ].map(f=>'data: '+JSON.stringify(f)+'\n\n').join('')+'data: [DONE]\n\n'}))
  await page.goto('http://127.0.0.1:8787/')
  await page.getByRole('button',{name:/Pipeline/}).click()
  await page.getByRole('checkbox',{name:'工具增强',exact:true}).uncheck()
  const hide=page.getByRole('button',{name:'hide stream',exact:true});if(await hide.isVisible())await hide.click()
  await page.getByPlaceholder('描述你想要的交互卡片…').fill(record.prompt)
  await page.getByRole('button',{name:'发送',exact:true}).click()
  const frame=page.frameLocator('.cs-sandbox iframe')
  await frame.locator('svg').waitFor()
  await page.setViewportSize({width:432,height:850})
  const before=await frame.locator('body').innerText()
  if(id==='energy'){
   await frame.getByRole('button',{name:/推进|步进/}).click()
   await frame.getByText('能量 50 / 100',{exact:true}).waitFor()
   await frame.getByRole('button',{name:/充能/}).click()
   await frame.getByText('能量 65 / 100',{exact:true}).waitFor()
  }else{
   const slider=frame.getByRole('slider').first()
   await slider.fill('90');await slider.dispatchEvent('input')
  }
  await page.waitForTimeout(400)
  const after=await frame.locator('body').innerText();assert.notEqual(before,after)
  for(const width of [320,360,432]){
   await page.setViewportSize({width,height:850})
   assert.ok(await frame.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth+1))
  }
  await page.locator('.cs-stage').screenshot({path:`${out}/${id}.png`})
  await page.reload();await frame.locator('svg').waitFor()
  assert.equal(await frame.locator('body').innerText(),after);assert.equal(calls,1)
  if(id==='energy'){
   await frame.getByRole('button',{name:'重置',exact:true}).click()
   for(let i=0;i<6;i++){await frame.getByRole('button',{name:/推进|步进/}).click();await frame.getByText(`能量 ${50-i*10} / 100`,{exact:true}).waitFor()}
   const advance=frame.getByRole('button',{name:/推进|步进/})
   if(await advance.isEnabled())await advance.click()
   assert.ok((await frame.locator('body').innerText()).includes('能量 0 / 100'))
  }
  results.push({id,passed:true,replayedRealModelOutput:true,calls,before,after,widths:[320,360,432],restored:true})
  await context.close()
 }
}catch(e){
 results.push({passed:false,error:e.stack});process.exitCode=1
 for(const context of browser.contexts())for(const page of context.pages()){
  await writeFile(`${out}/ui-failure.txt`,await page.locator('body').innerText())
  await page.screenshot({path:`${out}/ui-failure.png`})
 }
}
finally{await browser.close();await writeFile(`${out}/live-ui.json`,JSON.stringify(results,null,2))}
console.log(JSON.stringify(results))
