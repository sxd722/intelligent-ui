import {projectToolRows,formatSlot} from '../../shared/cardspec/tool-slots.mjs'
export async function inspectS2(browser,c,r,{width=432,size='square',dir}){
 const page=await browser.newPage({viewport:{width:width+40,height:950}});page.setDefaultTimeout(1300)
 const checks=[],steps=[],errors=[],claimedCollections=new Set();page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',route=>route.abort())
 const card=page.locator('.cs-card'),shell=page.locator('.cs-shell'),assert=(ok,msg)=>{if(!ok)throw Error(msg)}
 const test=async(name,fn)=>{try{await fn();checks.push({name,passed:true})}catch(e){checks.push({name,passed:false,error:e.message.slice(0,190)})}}
 const closeDialogs=async()=>{const close=page.getByRole('button',{name:'关闭详情',exact:true});if(await close.isVisible())await close.click()}
 const visit=async(predicate,disclose=true)=>{
  const here=async()=>{
   await closeDialogs()
   if(await predicate())return true
   if(disclose)for(const opener of await shell.locator('.cs-details > button:visible').all()){
    await opener.click();if(await predicate())return true;await closeDialogs()
   }
   return false
  }
  if(await here())return true
  const dots=page.getByRole('button',{name:/卡片页面：第 \d+ 屏/})
  for(let i=0;i<Math.min(await dots.count(),12);i++){await dots.nth(i).click();await page.waitForTimeout(230);if(await here())return true}
  return false
 }
 const actionButton=(action,name)=>r.arm==='A2S'?shell.locator('[data-cs-on-press='+JSON.stringify(action)+']').first():button(name),clickAction=async(action,name)=>{const target=actionButton(action,name);await visit(()=>target.isVisible());assert(await target.isVisible(),'Missing reachable user action '+action);await target.click()}
 const button=name=>card.getByRole('button',{name,exact:true}).first(),click=async name=>{await visit(()=>button(name).isVisible());await button(name).click()}
 const allText=async()=>{const xs=[];await visit(async()=>{
  xs.push(await shell.innerText());await closeDialogs()
  // role=details is a real host dialog, not inline text. Inspect and close it
  // through visible controls before navigating to another host page.
  for(const opener of await shell.locator('.cs-details > button:visible').all()){
   await opener.click();xs.push(await shell.innerText());const close=page.getByRole('button',{name:'关闭详情',exact:true});if(await close.isVisible())await close.click()
  }
  for(const summary of await shell.locator('details:not([open]) > summary:visible').all()){
   if(/详情|资料/.test(await summary.innerText())){await summary.click();xs.push(await shell.innerText());await summary.click()}
  }
  return false
 },false);return xs.join('\n')}
 try{
  await page.goto(`http://127.0.0.1:8787/${process.env.S2_DEST?.replace(/^dist\//,'')||'tool-binding-s2'}/viewer.html?id=${r.id}&width=${width}&size=${size}`);await page.waitForFunction(()=>!!window.qaSession);await page.waitForTimeout(120)
  if(c.static)await test('local-visual-and-feedback',async()=>{const before=await allText();await click('切换颜色');assert(before!==await allText(),'No visible change');assert(await card.locator('svg,canvas,[data-motion]').count()>0,'No visual animation representation')})
  else if(c.write)await test('write-only-click-receipt',async()=>{assert((await page.evaluate(()=>window.qaCalls)).length===0,'Premature write');await clickAction('refresh_s0','暂停');await page.waitForTimeout(100);assert((await page.evaluate(()=>window.qaCalls)).length===1,'Expected exactly one write');assert(/paused|已暂停/.test(await allText()),'Receipt absent')})
  else for(const [i,s] of c.sources.entries()){
   // The author may use a meaningful label instead of the probe's suggested
   // label. Match the observed entity title; source order is only a fallback.
   const title=s.rows[0][s.contract.title],collections=card.locator('.cs-collection')
   // Equal titles across sources (outbound/return train, word/example) are
   // legitimate. Never silently reuse the first source's collection.
   let observedLabel=null
   await visit(async()=>{for(const candidate of await collections.filter({hasText:title}).all()){
    const label=await candidate.getAttribute('aria-label')
    if(label&&!claimedCollections.has(label)&&await candidate.isVisible()){observedLabel=label;return true}
   }return false})
   if(observedLabel)claimedCollections.add(observedLabel)
   const collection=observedLabel?card.locator('.cs-collection[aria-label='+JSON.stringify(observedLabel)+']').first():collections.nth(i),input=r.arm==='A2S'?shell.locator('[data-cs-on-change='+JSON.stringify('filter_'+s.key)+'] input').first():page.getByLabel('筛选'+(i+1),{exact:true})
   const projection=projectToolRows(s.tool,s.rows,s.contract)
   await test(s.key+'-content-and-selection',async()=>{
    for(let j=0;j<Math.min(2,s.rows.length);j++){
     const expected=projection.items[j];await visit(()=>input.isVisible());await input.fill(expected.title);await visit(()=>collection.isVisible())
     const item=collection.locator('.cs-collection-item').first();assert(await collection.locator('.cs-collection-item:visible').count()===1,'Filter did not narrow candidates')
     const text=await item.innerText();assert(text.includes(expected.title),'Missing title');assert(!/\braw\s*\{|"(?:rowKey|sku|bvid)"\s*:/.test(text),'Raw object displayed')
     for(const f of expected.$display.fields.slice(0,3))assert(text.includes(formatSlot(f)),`Missing ${f.label}=${formatSlot(f)}`)
     await item.click();await visit(()=>input.isVisible());await input.fill('')
    }
   })
   if(s.detail)await test(s.key+'-dependent-detail',async()=>{
    const title=projection.items[0].title;await visit(()=>input.isVisible());await input.fill(title);await visit(()=>collection.isVisible());await collection.locator('.cs-collection-item').first().click();await clickAction('detail_'+s.key,'详情'+(i+1));await page.waitForTimeout(100)
    const calls=await page.evaluate(()=>window.qaCalls);assert(calls.some(x=>x.tool===s.detail.tool&&String(x.input[s.detail.param])===String(s.rows[0][s.contract.entity])),'Wrong detail business ID')
    assert((await allText()).includes('证据-'),'Fetched information not displayed');await visit(()=>input.isVisible());await input.fill('')
   })
   await test(s.key+'-refresh',async()=>{const n=await page.evaluate(()=>window.qaCalls.length);await clickAction('refresh_'+s.key,'刷新'+(i+1));await page.waitForTimeout(90);assert(await page.evaluate(()=>window.qaCalls.length)>n,'No refresh call')})
  }
  steps.push({name:'after-interaction',bindings:await page.evaluate(()=>Object.fromEntries(Object.entries(window.qaSession.current().bindings).map(([k,b])=>[k,{status:b.status,error:b.error,items:b.value?.items?.length}]))),text:await allText(),calls:await page.evaluate(()=>window.qaCalls)})
  await test('restore-and-no-write-replay',async()=>{const state=await page.evaluate(()=>JSON.stringify(window.qaSession.current().store.values));await page.reload();await page.waitForFunction(()=>!!window.qaSession);await page.waitForTimeout(100);assert(state===await page.evaluate(()=>JSON.stringify(window.qaSession.current().store.values)),'Lost state');if(c.write)assert(await page.evaluate(()=>window.qaCalls.length)===0,'Replayed write')})
  await test('no-pageerror-or-horizontal-overflow',async()=>{assert(!errors.length,errors.join(';'));assert(await card.evaluate(e=>e.scrollWidth<=e.clientWidth+2),'Horizontal overflow')})
 }catch(e){checks.push({name:'page',passed:false,error:e.message.slice(0,190)})}
 const screenshot=`${r.id}-${width}-${size}.png`;await page.screenshot({path:dir+'/'+screenshot});await page.close()
 return {id:r.id,case:c.id,arm:r.arm,width,size,passed:checks.every(c=>c.passed),checks,steps,screenshot,scope:'Binding/content/restore probes. Full original-task UX and semantic coverage separately assessed; not implicit PASS.'}
}
