import {chromium} from '@playwright/test'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {auditLayout} from '../src/cardspec/layout-audit.js'
const out='artifacts/composition-v2/generated-ui';mkdirSync(out,{recursive:true})
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[]
for(const id of ['pearl','atlas','rebel','default']){
 const folder=['pearl','default'].includes(id)?'generated-followup':'generated-final'
 const record=JSON.parse(readFileSync(`artifacts/composition-v2/${folder}/${id}.json`))
 for(const size of ['square','auto'])for(const width of [320,360,432]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),r={id,size,width,source:folder,checks:[]}
  await page.route('**/api/photo?*',route=>route.fulfill({status:503,body:'unavailable'}))
  try{
   await page.goto('http://127.0.0.1:8787/card-debug.html');await page.waitForFunction(()=>!!window.cardDebug)
   await page.evaluate(({spec,width,size})=>window.cardDebug.mount(spec,{width,size}),{spec:record.spec,width,size});await page.waitForFunction(()=>window.cardDebug.ready());await page.waitForTimeout(500)
   const stage=page.locator('.cs-stage'),state=()=>page.evaluate(()=>window.cardDebug.snapshot().state)
   const reach=async locator=>{
    for(let n=0;n<15;n++){
     if(await locator.isVisible())return locator
     const next=stage.getByRole('button',{name:'下一屏',exact:true}),prev=stage.getByRole('button',{name:'上一屏',exact:true})
     if(await next.isVisible()&&await next.isEnabled())await next.click()
     else if(await prev.isVisible()&&await prev.isEnabled()){while(await prev.isEnabled())await prev.click()}
     else break
     await page.waitForTimeout(100)
    }
    throw Error('Unreachable '+locator)
   }
   const audit=async label=>{await page.waitForTimeout(250);const a=await stage.evaluate(auditLayout,{noScroll:true});r.checks.push({label,issues:a.issues});await stage.screenshot({path:`${out}/${id}-${width}-${size}-${label}.png`})}
   await audit('before')
   const forward=stage.getByRole('button',{name:'下一屏',exact:true}),back=stage.getByRole('button',{name:'上一屏',exact:true})
   for(let n=0;n<12&&await forward.isVisible()&&await forward.isEnabled();n++){await forward.click();await audit('page'+(n+2))}
   for(let n=0;n<12&&await back.isVisible()&&await back.isEnabled();n++)await back.click()
   if(id==='pearl'){
    await stage.getByRole('slider',{name:'专注时长',exact:true}).fill('75');assert.equal((await state()).focus,75)
    await stage.getByRole('button',{name:'保存方案',exact:true}).click();assert.equal((await state()).savedFocus,75)
   }else if(id==='default'){
    await stage.getByRole('slider',{name:'人数',exact:true}).fill('8');await stage.getByRole('slider',{name:'单人预算',exact:true}).fill('30')
    await stage.getByRole('button',{name:'保存本次预算',exact:true}).click();assert.equal((await state()).saved[0].total,240)
    await stage.getByRole('button',{name:'重置',exact:true}).click();assert.equal((await state()).people,6);assert.equal((await state()).saved.length,1)
   }else if(id==='atlas'){
    await (await reach(stage.getByRole('radio',{name:'绿',exact:true}))).click()
    await (await reach(stage.getByRole('radio',{name:'B',exact:true}))).click()
    await stage.getByRole('switch',{name:'切换：降低亮度',exact:true}).click()
    const s=await state();assert.equal(s.color,'绿');assert.equal(s.channel,'B');assert.equal(s.dimmed,true)
    // Inspect rendered value as well as the input state.
    await reach(stage.getByText(/^B 通道：绿\s*90 → 54（降低 36）。$/));
   }else{
    const seen=new Set(),nextItem=stage.getByRole('button',{name:'下一页',exact:true}),prevItem=stage.getByRole('button',{name:'上一页',exact:true})
    for(let n=0;n<8;n++){
     for(const title of ['雾中信号','牛皮纸乐章','电紫罗兰','鼓皮公路'])if(await stage.getByRole('button',{name:new RegExp(title)}).isVisible())seen.add(title)
     await audit('menu'+n)
     if(!(await nextItem.isVisible())||!(await nextItem.isEnabled()))break
     await nextItem.click();await page.waitForTimeout(100)
    }
    assert.equal(seen.size,4,'All four acts must be reachable')
    for(let n=0;n<8&&await prevItem.isVisible()&&await prevItem.isEnabled();n++)await prevItem.click()
    await (await reach(stage.getByRole('button',{name:/周六 19:00｜雾中信号/}))).click();assert.deepEqual((await state()).plan,['a1'])
    await (await reach(stage.getByRole('radio',{name:'我的行程',exact:true}))).click()
    await reach(stage.getByRole('button',{name:/雾中信号/}));assert.equal((await state()).view,'plan')
   }
   await audit('after');const saved=await state();await page.evaluate(()=>window.cardDebug.save());await page.reload();await page.waitForFunction(()=>!!window.cardDebug)
   await page.evaluate(({spec,width,size})=>window.cardDebug.mount(spec,{width,size,restore:true}),{spec:record.spec,width,size});await page.waitForFunction(()=>window.cardDebug.ready());assert.deepEqual(await state(),saved)
   r.interaction='passed';r.restore='passed';r.status=r.checks.some(c=>c.issues.length)?'layout-failed':'passed'
  }catch(e){r.status='failed';r.error=e.message;await page.screenshot({path:`${out}/${id}-${width}-${size}-failure.png`});r.snapshot=await page.evaluate(()=>window.cardDebug?.snapshot()).catch(()=>null)}
  results.push(r);writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify({id,size,width,status:r.status,error:r.error,issues:r.checks.map(c=>c.issues)}));await context.close()
 }
}
await browser.close()
