import {chromium} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
const dir='artifacts/recent-card-review',specs=await Promise.all([0,1,2,3,4].map(i=>readFile(`${dir}/${i}-spec.json`,'utf8').then(JSON.parse)))
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:950,height:1000}}),results=[]
async function mount(i,width=432,size=specs[i].context.cardSize){await page.goto('http://127.0.0.1:8787/card-debug.html');await page.waitForFunction(()=>window.cardDebug);await page.evaluate(({spec,width,size})=>window.cardDebug.mount(spec,{width,size}),{spec:specs[i],width,size});await page.waitForFunction(()=>window.cardDebug.ready());await page.waitForTimeout(1000)}
const snap=()=>page.evaluate(()=>window.cardDebug.snapshot())
async function shot(name){await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(400);await page.locator('.cs-tool-card').screenshot({path:`${dir}/${name}.png`})}
try{
 for(let i=0;i<specs.length;i++){
  const r={case:i,viewports:[],steps:[]};results.push(r)
  for(const width of [432,320]){await mount(i,width);await shot(`${i}-${width}`);const s=await snap();r.viewports.push({width,height:await page.locator('.cs-card').evaluate(e=>e.clientHeight),snapshot:s})}
  await mount(i,432,'full')
  if(i===0){
   const put=async name=>page.locator('[data-cs-component=box]').filter({has:page.getByText(name,{exact:true})}).getByRole('button',{name:'放入',exact:true}).click()
   for(let k=0;k<2;k++){await put('废弃教堂');await put('失眠的会计');await page.getByRole('button',{name:'推进阶段',exact:true}).click();r.steps.push({name:`合法仪式${k+1}`,snapshot:await snap()})}
   await page.getByRole('button',{name:'推进阶段',exact:true}).click();r.steps.push({name:'继续阶段被卡住',snapshot:await snap()});await shot('0-dead-end')
  }
  if(i===1){
   await page.getByRole('button',{name:'查询门店',exact:true}).click();await page.waitForTimeout(700);r.steps.push({name:'受控工具替身搜索，不代表真实点评调用',snapshot:await snap()});await shot('1-search-fixture')
  }
  if(i===2){
   await page.getByRole('radio',{name:'服饰',exact:true}).click();r.steps.push({name:'服饰筛选',snapshot:await snap()})
   await page.getByRole('button',{name:'展开详情',exact:true}).click();r.steps.push({name:'详情新增内容',snapshot:await snap()});await shot('2-detail')
   await page.getByRole('radio',{name:'全部',exact:true}).click();r.steps.push({name:'返回全部',snapshot:await snap()})
  }
  if(i===3){
   const items=page.locator('.cs-dial-slide');await items.nth(3).getByRole('button',{name:'选这条',exact:true}).click();await page.waitForTimeout(350);r.steps.push({name:'莱莫绍八天与七天日程矛盾',snapshot:await snap()});await shot('3-route-mismatch')
  }
  if(i===4){
   await page.getByRole('radio',{name:'谨慎',exact:true}).click();r.steps.push({name:'改变解读视角',snapshot:await snap()})
   await page.getByRole('button',{name:'展开阈值与反面证据',exact:true}).first().click();r.steps.push({name:'展开证据',snapshot:await snap()})
   for(const name of ['收入兑现','融资环境'])await page.getByRole('checkbox',{name,exact:true}).uncheck();r.steps.push({name:'只留资本开支升温信号却显示已转向',snapshot:await snap()});await shot('4-verdict')
  }
  const last=await snap();await page.evaluate(()=>window.cardDebug.save());await page.reload();await page.waitForFunction(()=>window.cardDebug)
  await page.evaluate(spec=>window.cardDebug.mount(spec,{width:432,size:'full',restore:true}),specs[i]);await page.waitForFunction(()=>window.cardDebug.ready());r.restored=JSON.stringify((await snap()).state)===JSON.stringify(last.state)
  console.log(JSON.stringify({case:i,restored:r.restored,steps:r.steps.map(s=>s.name),errors:r.steps.flatMap(s=>s.snapshot.errors)}))
 }
}finally{await writeFile(dir+'/browser.json',JSON.stringify(results,null,2));await browser.close()}
