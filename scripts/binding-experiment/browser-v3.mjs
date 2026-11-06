import {chromium} from '@playwright/test'
import {projectToolRows,formatSlot} from '../../shared/cardspec/tool-slots.mjs'
export async function launchBrowser(){return chromium.launch({channel:'chrome',headless:true})}
export async function inspect(browser,c,r,{width=432,size='square',dir}={}){
 const page=await browser.newPage({viewport:{width:width+40,height:950}}),checks=[],errors=[],steps=[];page.setDefaultTimeout(2000)
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',route=>route.abort())
 const check=async(name,fn)=>{try{await fn();checks.push({name,passed:true})}catch(e){checks.push({name,passed:false,error:e.message.slice(0,240)})}}
 const assert=(ok,msg)=>{if(!ok)throw Error(msg)}
 const card=page.locator('.cs-card'),btn=name=>card.getByRole('button',{name,exact:true}).first(),filter=()=>page.getByLabel('筛选',{exact:true})
 const visit=async predicate=>{
  if(await predicate())return true
  const dots=page.getByRole('button',{name:/卡片页面：第 \d+ 屏/})
  for(let i=0;i<Math.min(await dots.count(),10);i++){await dots.nth(i).click();await page.waitForTimeout(260);if(await predicate())return true}
  return false
 }
 const click=async name=>{await visit(()=>btn(name).isVisible());await btn(name).click()}
 const fill=async value=>{await visit(()=>filter().isVisible());await filter().fill(value)}
 const visibleText=async()=>{let texts=[];await visit(async()=>{texts.push(await card.innerText());return false});return texts.join('\n')}
 const snap=async name=>{steps.push({name,text:await card.innerText(),calls:await page.evaluate(()=>window.qaCalls)})}
 const openDetails=async()=>{for(const summary of await card.locator('details:not([open]) > summary').all())if(/详情|资料/.test(await summary.innerText()))await summary.click()}
 try{
 await page.goto(`http://127.0.0.1:8787/tool-binding-v3/viewer.html?id=${r.id}&width=${width}&size=${size}`);await page.waitForFunction(()=>!!window.qaSession);await page.waitForTimeout(140)
 if(c.static)await check('local-feedback',async()=>{const before=await card.innerText();await click('切换颜色');assert(before!==await card.innerText(),'No feedback')})
 else if(c.write)await check('write-only-user-and-receipt',async()=>{assert((await page.evaluate(()=>window.qaCalls)).length===0,'Premature write');await click('暂停');await page.waitForTimeout(100);assert((await page.evaluate(()=>window.qaCalls)).length===1,'Write not exactly once');assert(/paused|已暂停/.test(await visibleText()),'Receipt not visible')})
 else{
  await check('filter-actual-candidates',async()=>{await fill(c.rows[0][c.map.title]);await visit(()=>card.locator('.cs-collection-item').first().isVisible());assert(await card.locator('.cs-collection-item:visible').count()===1,'Filter ineffective');await fill('')})
  const projection=projectToolRows(c.tool,c.rows)
  await check('content-slots-first-and-second-row',async()=>{
   for(let i=0;i<2;i++){
    await fill(c.rows[i][c.map.title]);const row=card.locator('.cs-collection-item').first();await visit(()=>row.isVisible());const text=await row.innerText()
    assert(text.includes(c.rows[i][c.map.title]),'Entity title missing')
    assert(!/\braw\s*\{|"(?:bvid|rowKey|dimension|train_no)"\s*:/.test(text),'Raw object in candidate')
    if(projection.ok){for(const f of projection.items[i].$display.fields.slice(0,3)){
     assert(text.includes(f.label),`Missing semantic label ${f.label}`)
     assert(text.includes(formatSlot(f)),`Missing value/unit ${f.label}=${formatSlot(f)}`)
    }}
    await row.click()
   }
   await fill('')
  })
  await fill(c.rows[0][c.map.title]);await visit(()=>card.locator('.cs-collection-item').first().isVisible());await card.locator('.cs-collection-item').first().click();await fill('');await snap('selected')
  if(c.detail)await check('detail-new-information-return',async()=>{
   await click('查看详情');await page.waitForTimeout(100)
   const opener=card.locator('.cs-details > button').first();if(await opener.isVisible()&&!await page.locator('dialog[open]').count())await opener.click()
   await openDetails();const text=await visibleText();assert(c.id==='trains'?text.includes('137'):text.includes('证据-'),'New fetched detail absent')
   const calls=await page.evaluate(()=>window.qaCalls);assert(calls.some(x=>x.tool===c.detail.tool&&String(x.input[c.detail.param])===String(c.rows[0][c.map.id])),'Wrong business identity')
   await snap('detail');await click('返回');const close=page.getByRole('button',{name:'关闭详情',exact:true});if(await close.isVisible())await close.click()
   assert(await visit(()=>card.locator('.cs-collection-item').first().isVisible()),'Return inaccessible')
  })
  if(c.compare)await check('compare-two-state-and-visible-facts',async()=>{
   await click('加入比较');await fill(c.rows[1][c.map.title]);await visit(()=>card.locator('.cs-collection-item').first().isVisible());await card.locator('.cs-collection-item').first().click();await click('加入比较');await fill('__nothing__')
   const text=await visibleText();for(const raw of c.rows.slice(0,2))assert(text.includes(raw[c.map.title]),'Chosen entity absent outside candidate list')
   const state=await page.evaluate(()=>window.qaSession.current().store.values);assert(Object.values(state).some(x=>Array.isArray(x)&&x.length===2),'Comparison collapsed distinct entities')
   await snap('comparison');await fill('')
  })
  await check('refresh-retains-state',async()=>{const before=await page.evaluate(()=>JSON.stringify(window.qaSession.current().store.values)),n=await page.evaluate(()=>window.qaCalls.length);await click('刷新');await page.waitForTimeout(100);assert(await page.evaluate(()=>window.qaCalls.length)>n,'No refresh');assert(before===await page.evaluate(()=>JSON.stringify(window.qaSession.current().store.values)),'State reset')})
 }
 await check('refresh-restores-without-write-replay',async()=>{const state=await page.evaluate(()=>JSON.stringify(window.qaSession.current().store.values));await page.reload();await page.waitForFunction(()=>!!window.qaSession);await page.waitForTimeout(100);assert(state===await page.evaluate(()=>JSON.stringify(window.qaSession.current().store.values)),'Restore lost state');if(c.write)assert(await page.evaluate(()=>window.qaCalls.length)===0,'Write replay')})
 await check('no-horizontal-overflow-or-local-error',async()=>{assert(await card.evaluate(el=>el.scrollWidth<=el.clientWidth+2),'Horizontal overflow');assert(await page.locator('[data-cs-error],.cs-action-error').count()===0,'Local render/action error');assert(errors.length===0,errors.join(';'))})
 await snap('final')
 }catch(e){checks.push({name:'page',passed:false,error:e.message.slice(0,240)})}
 const screenshot=`${r.id}-${width}-${size}.png`;await page.screenshot({path:dir+'/'+screenshot});await page.close()
 return {id:r.id,case:c.id,arm:r.arm,width,size,passed:checks.every(c=>c.passed),checks,steps,screenshot}
}
