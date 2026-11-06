// Isolated browser + intercepted model requests: never touches the Owl session.
import {chromium} from 'playwright'
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
const dir='artifacts/extended-generation-qa'
await mkdir(dir,{recursive:true})
const browser=await chromium.launch({channel:'chrome',headless:true})
try{
 const page=await browser.newPage({viewport:{width:1280,height:960}})
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/api/refine-prompt',r=>r.fulfill({json:{prompt:'制作一个计数器：点击增加，数值变化。'}}))
 let payload,release
 await page.route('**/api/chat',async r=>{payload=r.request().postDataJSON();await new Promise(ok=>release=ok);await r.abort().catch(()=>{})})
 await page.goto('http://127.0.0.1:8787/',{waitUntil:'networkidle'})
 const expand=page.getByRole('button',{name:'展开配置'})
 if(await expand.isVisible())await expand.click()
 const toggle=page.getByRole('checkbox',{name:'扩展构建',exact:true})
 assert.equal(await toggle.isChecked(),false)
 await toggle.check()
 await page.reload({waitUntil:'networkidle'})
 assert.equal(await toggle.isChecked(),true)
 await page.getByRole('combobox',{name:'构建模式',exact:true}).selectOption('deep')
 await page.screenshot({path:dir+'/settings.png',fullPage:true})
 await page.getByRole('textbox',{name:'卡片生成需求'}).fill('计数器')
 await page.getByRole('button',{name:'提炼需求',exact:true}).click()
 await page.getByRole('button',{name:'确认并生成',exact:true}).click()
 await page.waitForFunction(()=>!!document.querySelector('.stop-btn'))
 for(let n=0;n<50&&!payload;n++)await page.waitForTimeout(20)
 assert.equal(payload?.extendedGeneration,true);assert.equal(payload.buildMode,'deep')
 assert.equal(await toggle.isDisabled(),true)
 await page.getByRole('button',{name:'停止',exact:true}).click()
 release?.()
 await toggle.waitFor({state:'visible'})
 for(let n=0;n<50&&await toggle.isDisabled();n++)await page.waitForTimeout(20)
 assert.equal(await toggle.isDisabled(),false)
 await toggle.uncheck()
 await page.getByRole('combobox',{name:'构建模式',exact:true}).selectOption('quick')
 await page.reload({waitUntil:'networkidle'})
 assert.equal(await toggle.isChecked(),false)
 assert.deepEqual(errors,[])
 await writeFile(dir+'/result.json',JSON.stringify({passed:true,scope:'UI persistence, payload, stop; mocked model, no external tool calls',checks:['default off','persists on reload','deep compatible','request flag','locked while running','stop restores controls','disable persists'],errors},null,2))
 console.log('UI checks passed; screenshot: '+dir+'/settings.png')
}finally{await browser.close()}
