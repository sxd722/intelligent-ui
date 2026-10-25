import {chromium} from '@playwright/test'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import assert from 'node:assert/strict'
const file=process.argv[2]||'artifacts/adaptive-eval-v2/hybrid.json',record=JSON.parse(await readFile(file)),guard=process.argv[3]==='overflow',dir=guard?'artifacts/adaptive-eval-v2/hybrid-overflow-ui':'artifacts/adaptive-eval-v2/hybrid-ui'
await mkdir(dir,{recursive:true})
const source=`<card><state id="cell" type="number" initial={0}/><sandbox id="room" label="房间布置" brief="房间2×2格；书桌每次移到下一个格子，重置到左上" input={{cells:4}} initial={{cell:0}} height={300}><title>房间布置 · 原生</title><stat label="书桌位置" value={state.cell+1}/><row><button onPress="move">移动书桌</button><button onPress="reset">重置</button></row></sandbox><action id="move"><set target="cell" value={(state.cell+1)%4}/></action><action id="reset"><set target="cell" value={0}/></action></card>`
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[]
try{
 for(const width of (guard?[320,360]:[320,360,432]))for(const size of ['square','auto']){
  const page=await browser.newPage({viewport:{width:900,height:1100}});page.setDefaultTimeout(10000)
  let calls=0
  await page.route('**/api/tools/invoke',route=>{calls++;const {requestId,pageId}=route.request().postDataJSON();return route.fulfill({contentType:'text/event-stream',body:[{type:'result',result:record.generated.result},{type:'done'}].map(event=>'data: '+JSON.stringify({...event,requestId,pageId})+'\n\n').join('')})})
  try{
   await page.goto('http://127.0.0.1:8787/cardspec-lab.html?fixture=counter')
   await page.getByLabel('UI能力',{exact:true}).selectOption('hybrid')
   await page.getByLabel('宽度',{exact:true}).selectOption(String(width));await page.getByLabel('卡片尺寸',{exact:true}).selectOption(size)
   await page.getByText('输入 DSL 验证',{exact:true}).click();await page.getByLabel('DSL源码').fill(source);await page.getByRole('button',{name:'应用源码'}).click()
   const card=page.locator('.cs-card'),frame=card.frameLocator('iframe[title="房间布置"]')
   await card.scrollIntoViewIfNeeded()
   if(guard){
    await card.getByRole('alert').filter({hasText:'超出可用宽度'}).waitFor()
    await card.getByRole('button',{name:'移动书桌',exact:true}).click()
    assert.equal(await card.locator('.cs-stat strong').innerText(),'2');assert.equal(calls,1)
    results.push({width,size,interactionPassed:true,nativeFallbackPassed:true,overflowIsolated:true,noAutomaticRetry:true})
    await card.screenshot({path:`${dir}/${width}-${size}.png`})
    await page.close();console.log(JSON.stringify(results.at(-1)));continue
   }
   await frame.getByRole('button',{name:'移动书桌',exact:true}).click();await frame.getByText(/^位置\s*2(?:\s*\/\s*4)?$/).waitFor()
   await card.getByRole('button',{name:'原生视图',exact:true}).click()
   await card.getByRole('button',{name:'移动书桌',exact:true}).click();assert.equal(await card.locator('.cs-stat strong').innerText(),'2')
   await card.getByRole('button',{name:'增强视图',exact:true}).click();await frame.getByText(/^位置\s*2(?:\s*\/\s*4)?$/).waitFor()
   assert.equal(calls,1)
   const overflow=await frame.locator('body').evaluate(el=>el.scrollWidth>el.clientWidth+1)
   await card.screenshot({path:`${dir}/${width}-${size}.png`})
   results.push({width,size,interactionPassed:true,nativeFallbackPassed:true,stateRestored:true,noRegeneration:true,horizontalOverflow:overflow})
  }catch(e){results.push({width,size,interactionPassed:false,error:e.message,calls,text:await page.locator('.cs-card').innerText().catch(()=>''),diagnostics:await page.getByTestId('diagnostics').innerText().catch(()=>'')});await page.screenshot({path:`${dir}/${width}-${size}-error.png`})}
  await page.close();console.log(JSON.stringify(results.at(-1)))
 }
}finally{await browser.close()}
record.browser=results
record.summary=record.summary.split(' 浏览器交互/原生回退')[0]+` 浏览器交互/原生回退 ${results.filter(r=>r.interactionPassed).length}/${results.length}；${guard?'宽度越界可隔离并保留原生交互':'增强视图无横向溢出 '+results.filter(r=>r.horizontalOverflow===false).length+'/'+results.length}，布局未通过的产物不进入训练。`
await writeFile(file,JSON.stringify(record,null,2))
