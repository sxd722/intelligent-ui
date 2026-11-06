import {chromium} from 'playwright'
import fs from 'node:fs/promises'
import {ROOT,DEST} from './cases.mjs'
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[]
const gallery=JSON.parse(await fs.readFile(ROOT+'/gallery.json'))
await fs.mkdir(DEST+'/screenshots',{recursive:true})
for(const entry of gallery){
 for(const width of [320,360,432])for(const size of ['square','auto']){
  const page=await browser.newPage({viewport:{width:650,height:950},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto(`http://127.0.0.1:8787/stitch-host/viewer.html?id=${entry.id}&width=${width}&size=${size}`)
  await page.locator('.cs-task-board').waitFor();await page.waitForTimeout(450)
  const measure=await page.locator('.cs-task-board').evaluate(root=>{const r=root.getBoundingClientRect(),body=root.querySelector('.tb-body'),foot=root.querySelector('footer').getBoundingClientRect();return {width:r.width,height:r.height,horizontalOverflow:root.scrollWidth-root.clientWidth,bodyScroll:body.scrollHeight-body.clientHeight,actionVisible:foot.bottom<=r.bottom+1&&foot.top>=r.top,images:[...root.querySelectorAll('.tb-artwork img')].filter(e=>e.complete&&e.naturalWidth>0).length}})
  const file=`${entry.id}-${width}-${size}.png`;await page.locator('main').screenshot({path:DEST+'/screenshots/'+file})
  results.push({...entry,width,size,...measure,errors,file,passed:measure.horizontalOverflow<=1&&measure.actionVisible&&!errors.length})
  await page.close()
 }
}
const interactions=[]
for(const entry of gallery){
 const page=await browser.newPage({viewport:{width:650,height:900}}),steps=[]
 try{
 await page.goto(`http://127.0.0.1:8787/stitch-host/viewer.html?id=${entry.id}&width=432`);await page.locator('.cs-task-board').waitFor();await page.getByRole('button',{name:'候选',exact:true}).click()
 const title=(await page.locator('.tb-row').first().getAttribute('aria-label')).slice(3)
 await page.getByLabel('筛选候选入口').click();await page.getByLabel('筛选候选',{exact:true}).fill('no-match-xyz');await page.getByText('暂无匹配结果').waitFor();steps.push('empty-filter')
 await page.getByLabel('筛选候选',{exact:true}).fill(title.slice(0,3));if(!await page.locator('.tb-row').count())throw Error('matching filter empty');steps.push('matching-filter')
 await page.getByLabel('筛选候选',{exact:true}).fill('');await page.getByLabel('收起筛选').click()
 await page.locator('.tb-pick').nth(0).click();await page.locator('.tb-pick').nth(1).click();await page.getByRole('button',{name:'已选 2',exact:true}).click();if(await page.locator('.tb-comparison article').count()!==2)throw Error('compare missing');steps.push('compare-two');await page.locator('main').screenshot({path:DEST+'/screenshots/'+entry.id+'-compare.png'})
 await page.locator('.tb-detail-pick').first().click();await page.locator('[data-focus-title]').waitFor();steps.push('detail');await page.locator('main').screenshot({path:DEST+'/screenshots/'+entry.id+'-detail.png'})
 await page.locator('.tb-back').click();if(await page.locator('.tb-pick[aria-pressed=true]').count()!==2)throw Error('lost selection');steps.push('return')
 await page.locator('.tb-apply').click();if(await page.evaluate(()=>window.qaScope().state.chosen.length)!==2)throw Error('apply payload lost');steps.push('apply')
 await page.reload();await page.locator('.cs-task-board').waitFor();if(await page.locator('.tb-pick[aria-pressed=true]').count()!==2)throw Error('restore lost');steps.push('reload-restoration')
 await page.route('**/api/tools/assets/**',route=>route.abort());await page.reload();await page.locator('.cs-task-board').waitFor();await page.waitForTimeout(350);if(!await page.locator('.tb-row').count())throw Error('image fail lost content');steps.push('image-fallback')
 interactions.push({id:entry.id,steps,passed:true})
 }catch(e){interactions.push({id:entry.id,steps,passed:false,error:e.message})}
 await page.close()
}
await browser.close();await fs.writeFile(ROOT+'/browser.json',JSON.stringify({results,interactions},null,2));console.log(JSON.stringify({layouts:results.filter(r=>r.passed).length,total:results.length,interactions:interactions.filter(r=>r.passed).length,failures:interactions.filter(r=>!r.passed)}))
