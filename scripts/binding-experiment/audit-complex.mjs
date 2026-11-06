// Independent task assertions on saved generated artifacts; no model calls and
// no real tool calls. Does not rewrite the previous binding-probe results.
import {chromium} from '@playwright/test'
import {mkdir,writeFile,copyFile} from 'node:fs/promises'
const root='artifacts/tool-binding-qa/complex-audit-20261102',dest='dist/tool-binding-complex-audit'
await mkdir(root,{recursive:true});await mkdir(dest,{recursive:true})
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[]
for(const id of ['B02-A2S-1','B03-A2S-0','B07-A2S-0']){
 const p=await browser.newPage({viewport:{width:472,height:950}});p.setDefaultTimeout(3000)
 await p.route('**/api/**',route=>route.abort())
 const card=p.locator('.cs-card'),visit=async fn=>{if(await fn())return true;const dots=p.getByRole('button',{name:/卡片页面：第 \d+ 屏/});for(let i=0;i<await dots.count();i++){await dots.nth(i).click();await p.waitForTimeout(250);if(await fn())return true}return false}
 const result={id,scope:'Independent task-level audit on saved synthetic artifact, 432 square only',checks:[]}
 try{
  await p.goto('http://127.0.0.1:8787/tool-binding-s2/viewer.html?id='+id);await p.waitForFunction(()=>!!window.qaSession)
  if(id.startsWith('B02')){
   for(const [i,label]of ['去程车次','返程车次'].entries()){
    // aria-label is observed on the collection's section, not guessed IDs.
    const observed=card.locator('.cs-collection[aria-label='+JSON.stringify(label)+']')
    await visit(()=>observed.isVisible());await observed.locator('.cs-collection-item').first().click()
    const choose=card.getByRole('button',{name:'比较'+(i+1),exact:true});await visit(()=>choose.isVisible());await choose.click()
   }
   const selected=await p.evaluate(()=>({out:window.qaSession.current().store.values.chosen_s0,back:window.qaSession.current().store.values.chosen_s1}))
   const visible=await visit(()=>card.getByText('固定班次比较',{exact:true}).isVisible())
   result.checks.push({name:'each-direction-selected',passed:selected.out?.length===1&&selected.back?.length===1},{name:'fixed-itinerary-result-visible',passed:visible,observed:'Both chosen values are arrays; source reads chosen_s0.viewKey/chosen_s1.viewKey as records.'});result.selected=selected
  }else if(id.startsWith('B03')){
   let overBudget=false;await visit(async()=>{
    for(const col of await card.locator('.cs-collection:visible').all()){
     if((await col.innerText()).includes('899元'))overBudget=true
     const next=col.getByRole('button',{name:'下一组',exact:true})
     if(await next.isVisible()&&await next.isEnabled()){await next.click();if((await col.innerText()).includes('899元'))overBudget=true}
    }return overBudget
   });result.checks.push({name:'under-500-budget-enforced',passed:!overBudget,observed:overBudget?'899元 candidate visible under 五百元内 title':'No 899元 candidate observed'})
  }else{
   const row=card.locator('.cs-collection-item').first();await visit(()=>row.isVisible());await row.click()
   result.calls=await p.evaluate(()=>window.qaCalls)
   result.checks.push({name:'new-detail-fetch',passed:false,status:'blocked',observed:'Fixture/contract has search only, no detail edge. Selection displays existing title/summary; cannot count as fetched detail.'})
  }
  result.calls=await p.evaluate(()=>window.qaCalls)
  result.text=await card.innerText()
 }catch(e){result.error=e.message}
 result.screenshot=id+'.png';await p.screenshot({path:root+'/'+result.screenshot});await copyFile(root+'/'+result.screenshot,dest+'/'+result.screenshot);results.push(result);await p.close()
}
await browser.close();await writeFile(root+'/audit.json',JSON.stringify(results,null,2));await copyFile(root+'/audit.json',dest+'/audit.json');console.log(JSON.stringify(results.map(({id,checks,error})=>({id,checks,error}))))
