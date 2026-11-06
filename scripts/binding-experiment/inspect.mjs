import {chromium} from '@playwright/test'
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage();try{
 await page.goto('http://127.0.0.1:8787/tool-binding-qa/viewer.html?case=movies&arm=A2');await page.waitForFunction(()=>!!window.qaSession);await page.locator('.cs-collection-item').first().click();await page.getByRole('button',{name:'查看详情',exact:true}).click();await page.waitForTimeout(500);console.log(JSON.stringify(await page.evaluate(()=>({calls:window.qaCalls,state:window.qaSession.current().store.values,bindings:window.qaSession.current().bindings,error:window.qaSession.current().error,text:document.body.innerText,details:[...document.querySelectorAll('details')].map(x=>x.outerHTML)})),null,2));await page.screenshot({path:'artifacts/tool-binding-qa/deepseek-v4-flash-20261102-v2/detail-debug.png'});
}finally{await browser.close()}

