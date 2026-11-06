import {chromium} from '@playwright/test'
import fs from 'node:fs/promises'
import {ROOT} from './cases.mjs'
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[]
for(const id of ['trip','schedule',...['map','decision','detail','evidence','compare','plan'].map(x=>'composite-'+x)]){
 const page=await browser.newPage({viewport:{width:900,height:1000}});page.setDefaultTimeout(3000)
 const checks=[],state=()=>page.evaluate(()=>window.qaSession.current().store.values)
 const reach=async l=>{if(await l.isVisible())return;for(const b of await page.getByRole('button',{name:/卡片页面：第 \d+ 屏/}).all()){await b.click();await page.waitForTimeout(150);if(await l.isVisible())return}throw Error('control not visible in any page')}
 const click=async name=>{const l=page.getByRole('button',{name,exact:true}).first();await reach(l);await l.click();await page.waitForTimeout(200)}
 const fill=async(name,value)=>{const l=page.getByLabel(name,{exact:true});await reach(l);await l.fill(value);await page.waitForTimeout(120)}
 const check=async(name,fn)=>{try{const actual=await fn();checks.push({name,status:actual.pass?'pass':'fail',actual})}catch(e){checks.push({name,status:'fail',error:e.message.slice(0,450)})}await page.screenshot({path:ROOT+`/screenshots/${id}-followup-${name}.png`});checks.at(-1).screenshot=`screenshots/${id}-followup-${name}.png`}
 try{await page.goto('http://127.0.0.1:8787/complex-p0/viewer.html?id='+id);await page.waitForFunction(()=>window.qaSession);await page.waitForTimeout(750)
 if(id==='trip'){
  await check('filter-select-plan',async()=>{await fill('关键词','博物馆');const text=await page.locator('main').innerText();await fill('关键词','');await click('湘湖');await click('浙江省地质博物馆');await click('生成两天行程');return {pass:!text.includes('山里王观景台')&&(await state()).picked.length===2,state:await state()}})
  await check('constraints',async()=>{const before=(await state()).plan;await click('设置：孩子年龄 / 起点 / 预算');await fill('孩子年龄','2');await fill('总预算（元）','200');await click('生成两天行程');return {pass:false,before,after:(await state()).plan,reason:'需要路线/费用/停留约束实证；变化的提示文字不能证明真正规划。餐饮和详情没有绑定。'}})
 }
 if(id==='schedule'){
  await check('weekday-semantics',async()=>{const x=await page.evaluate(()=>{const s=window.qaScope();return {date:s.context.localDate,today:s.derived.todayNum,items:s.derived.scopeItems}});return {pass:false,...x,reason:'源码用月内日号比较星期字段；11月3日恰为周二，day=3 被当作今天，日期改变后继续失配。'}})
  await check('create-edit-delete',async()=>{await click('新增');const toggle=page.getByRole('button',{name:'新增/编辑',exact:true});if(await toggle.count())await toggle.click();await fill('标题','验收约会');await fill('教室/地点','图书馆');await fill('开始','15:00');await fill('结束','16:00');await click('保存');const added=(await state()).items.find(x=>x.title==='验收约会');if(!added)return {pass:false};const item=page.getByRole('button',{name:/验收约会/}).first();await reach(item);await item.click();await click('编辑');if(await toggle.count()&&await toggle.getAttribute('aria-expanded')==='false')await toggle.click();await fill('标题','验收约会修改');await click('保存');const edited=(await state()).items.some(x=>x.title==='验收约会修改');await click('删除');return {pass:edited&&!(await state()).items.some(x=>x.id===added.id)}})
 }
 if(id.startsWith('composite-')){
  await check('filter-select-compare-apply',async()=>{await click('候选');const titles=await page.locator('.tb-row strong').allTextContents();if(titles.length<2)return {pass:false,reason:'real data fewer than two'};await page.getByLabel('筛选候选').fill('NO_MATCH_QA');const empty=await page.locator('.tb-row').count()===0;await page.getByLabel('筛选候选').fill('');await page.locator('.tb-pick').nth(0).click();await page.locator('.tb-pick').nth(1).click();await click('对比 2');const two=await page.locator('.tb-comparison article').count()===2;await page.getByRole('button',{name:'查看详情',exact:true}).first().click();const detail=await page.locator('[data-focus-title]').innerText();await click('候选');await click('确认选择 2');return {pass:empty&&two&&!!detail&&(await state()).chosen.length===2,selected:(await state()).chosen,detail}})
  await check('restore',async()=>{const before=await page.evaluate(()=>({values:window.qaSession.current().store.values,components:window.qaSession.current().viewState.components}));await page.reload();await page.waitForFunction(()=>window.qaSession);await page.waitForTimeout(500);const after=await page.evaluate(()=>({values:window.qaSession.current().store.values,components:window.qaSession.current().viewState.components}));return {pass:JSON.stringify(before)===JSON.stringify(after),before,after}})
 }
 }catch(e){checks.push({name:'mount',status:'fail',error:e.message})}
 results.push({id,checks});await fs.writeFile(ROOT+'/'+id+'-followup.json',JSON.stringify({id,checks},null,2));await page.close();console.log(JSON.stringify({id,checks:checks.map(c=>[c.name,c.status])}))
}
await browser.close();await fs.writeFile(ROOT+'/followup.json',JSON.stringify(results,null,2))
