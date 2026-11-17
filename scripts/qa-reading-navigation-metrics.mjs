import {chromium} from 'playwright'
import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const dir='artifacts/reading-navigation-qa',browser=await chromium.launch({channel:'chrome',headless:true}),results=[]
try{
 const page=await browser.newPage({viewport:{width:1100,height:1000}})
 await page.goto('http://127.0.0.1:8787/card-debug.html');await page.waitForFunction(()=>!!window.cardDebug)
 for(const [id,file] of [['before','artifacts/reading-organization-qa/journey/result.json'],['after',dir+'/compact/result.json']])for(const width of [320,432]){
 const spec=JSON.parse(await readFile(file,'utf8')).spec
 await page.evaluate(({spec,width})=>window.cardDebug.mount(spec,{width,size:'full'}),{spec,width});await page.waitForFunction(()=>window.cardDebug.ready())
 const geometry=await page.locator('.cs-stage').evaluate(el=>({height:el.clientHeight,width:el.clientWidth,scrollWidth:el.scrollWidth,visibleChars:el.innerText.replace(/\s/g,'').length}))
 results.push({id,width,...geometry});await page.locator('.cs-stage').screenshot({path:`${dir}/compare-${id}-${width}.png`})
 }
 await page.goto('http://127.0.0.1:8787/');await page.getByLabel('内容组织',{exact:true}).selectOption('guided');await page.reload();assert.equal(await page.getByLabel('内容组织',{exact:true}).inputValue(),'guided')
 let sent;await page.route('**/api/refine-prompt',async route=>{sent=route.request().postDataJSON();await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({prompt:'测试规划'})})})
 await page.getByRole('textbox',{name:'卡片生成需求'}).fill('测试阅读卡');await page.getByRole('button',{name:'提炼需求',exact:true}).click();await page.waitForTimeout(200);assert.equal(sent.contentMode,'guided')
 console.log(results,'setting + refine payload passed')
}finally{await writeFile(dir+'/geometry.json',JSON.stringify(results,null,2));await browser.close()}
