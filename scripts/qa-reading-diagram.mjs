import {readFile,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'
import assert from 'node:assert/strict'
const dir='artifacts/reading-navigation-qa',old=JSON.parse(await readFile('artifacts/reading-organization-qa/journey/result.json','utf8'))
const browser=await chromium.launch({channel:'chrome',headless:true}),trace=[]
try{for(const width of [320,360,432]){
 const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});await page.goto('http://127.0.0.1:8787/card-debug.html');await page.waitForFunction(()=>!!window.cardDebug)
 await page.evaluate(({spec,width})=>window.cardDebug.mount(spec,{width,size:'full'}),{spec:old.spec,width});await page.waitForFunction(()=>window.cardDebug.ready());const graph=page.locator('.cs-diagram').first();await graph.scrollIntoViewIfNeeded();await page.waitForTimeout(200)
 const measure=()=>graph.locator('.cs-diagram-pan').evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth,height:el.clientHeight,nodes:el.querySelectorAll('button.cs-diagram-node').length}))
 const focused=await measure();assert.ok(focused.scrollWidth<=focused.width+1);assert.ok(focused.nodes<11);await graph.screenshot({path:`${dir}/diagram-${width}-focus.png`})
 await graph.getByRole('combobox',{name:'图谱焦点'}).selectOption('fish');await page.waitForTimeout(100);assert.equal((await page.evaluate(()=>window.cardDebug.snapshot())).state.selected,'fish')
 await graph.getByRole('button',{name:/查看全图/}).click();await page.waitForTimeout(200);const overview=await measure();assert.equal(overview.nodes,11);assert.ok(overview.scrollWidth<=overview.width+1);await graph.screenshot({path:`${dir}/diagram-${width}-overview.png`})
 await graph.getByRole('button',{name:'聚焦关联'}).click();trace.push({width,focused,overview,errors:(await page.evaluate(()=>window.cardDebug.snapshot())).errors});await page.close()
}}finally{await browser.close();await writeFile(dir+'/diagram-browser.json',JSON.stringify(trace,null,2))}
console.log(trace)
