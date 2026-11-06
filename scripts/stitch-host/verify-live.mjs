import {chromium} from 'playwright'
import fs from 'node:fs/promises'
import {ROOT,DEST,cases} from './cases.mjs'
const browser=await chromium.launch({channel:'chrome',headless:true}),runs=[]
for(const c of cases){
 const run=JSON.parse(await fs.readFile(ROOT+'/'+c.id+'.json')),record={id:c.id,seconds:run.elapsedMs/1000,status:run.status,usesHost:/<task-board\b/.test(run.source),tools:run.spec?.prefetched?.map(r=>r.tool)||[],sizes:[],steps:[]}
 const page=await browser.newPage({viewport:{width:650,height:1000}});page.setDefaultTimeout(6000);const errors=[];page.on('pageerror',e=>errors.push(e.message))
 try{
 for(const width of [320,360,432])for(const size of ['square','auto']){
 await page.goto(`http://127.0.0.1:8787/stitch-host/viewer.html?id=${c.id}&width=${width}&size=${size}`);await page.locator('.cs-card').waitFor();await page.waitForTimeout(500)
 const file=`${c.id}-${width}-${size}.png`;await page.locator('main').screenshot({path:DEST+'/screenshots/'+file})
 record.sizes.push({width,size,file,...await page.locator('.cs-card').evaluate(e=>({horizontalOverflow:e.scrollWidth-e.clientWidth,boards:[...e.querySelectorAll('.cs-task-board')].map(b=>({skin:b.dataset.skin,layout:b.dataset.composite,bodyScroll:b.querySelector('.tb-body').scrollHeight-b.querySelector('.tb-body').clientHeight}))}))})
 }
 await page.goto(`http://127.0.0.1:8787/stitch-host/viewer.html?id=${c.id}&width=432`);await page.locator('.cs-card').waitFor()
 if(record.usesHost){
  await page.getByRole('button',{name:'候选',exact:true}).click();const title=(await page.locator('.tb-row').first().getAttribute('aria-label')).slice(3)
  await page.getByLabel('筛选候选入口').click();await page.getByLabel('筛选候选',{exact:true}).fill('nomatchxyz');await page.getByText('暂无匹配结果').waitFor();record.steps.push('筛选改变候选')
  await page.getByLabel('筛选候选',{exact:true}).fill('');await page.getByLabel('收起筛选').click();await page.locator('.tb-pick').nth(0).click();await page.locator('.tb-pick').nth(1).click();await page.getByRole('button',{name:'已选 2',exact:true}).click();if(await page.locator('.tb-comparison article').count()!==2)throw Error('comparison missing');record.steps.push('两项对比')
  await page.locator('main').screenshot({path:DEST+'/screenshots/'+c.id+'-compare.png'})
  await page.locator('.tb-detail-pick').first().click();await page.locator('[data-focus-title]').waitFor();record.steps.push('详情显示');await page.locator('main').screenshot({path:DEST+'/screenshots/'+c.id+'-detail.png'});await page.locator('.tb-back').click();if(await page.locator('.tb-pick[aria-pressed=true]').count()!==2)throw Error('selection lost');record.steps.push('返回保留选择')
  await page.locator('.tb-apply').click();record.finalState=await page.evaluate(()=>window.qaScope().state);record.steps.push('确认回调')
  await page.reload();await page.locator('.cs-task-board').waitFor();if(await page.locator('.tb-pick[aria-pressed=true]').count()!==2)throw Error('restore lost');record.steps.push('刷新恢复')
 }else{
  const items=page.locator('.cs-list-item');record.listItems=await items.count();await items.first().click();record.firstPick=await page.evaluate(()=>window.qaScope().state);record.steps.push('列表选择')
  await page.getByRole('radio',{name:'HN',exact:true}).click();record.filtered=await items.count();record.steps.push('来源筛选');await items.nth(1).click();record.steps.push('两项选择');await page.getByRole('radio',{name:'全部',exact:true}).click();record.finalState=await page.evaluate(()=>window.qaScope().state)
  record.limitations=['没有采用新构图','无独立详情入口；不计详情通过'];await page.locator('main').screenshot({path:DEST+'/screenshots/'+c.id+'-interaction.png'})
 }
 record.visibleErrors=await page.locator('[role=alert]').allTextContents()
 }catch(e){record.error=e.message}
 record.pageErrors=errors;runs.push(record);await page.close()
}
await browser.close();await fs.writeFile(ROOT+'/live-browser.json',JSON.stringify(runs,null,2));console.log(JSON.stringify(runs.map(r=>({id:r.id,host:r.usesHost,steps:r.steps,error:r.error,visibleErrors:r.visibleErrors}))))
