import {chromium} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const dir='artifacts/h5-baseline-v2';await mkdir(dir,{recursive:true})
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[]
try{for(const width of [320,360,432])for(const size of ['square','auto'])for(const id of ['sentiment','family','movies','transformer','trains']){
 const context=await browser.newContext({viewport:{width:Math.max(width,500),height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[]
 page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));await context.tracing.start({screenshots:true,snapshots:true})
 try{
  await page.goto(`http://127.0.0.1:8787/h5-baseline/index.html?case=${id}&fixtures=1&width=${width}&size=${size}`)
  const f=page.frameLocator('iframe');await f.locator('.card').waitFor()
  if(id==='sentiment'){
   await f.getByRole('button',{name:'搜索新闻与用户反馈',exact:true}).click()
   await f.getByRole('button',{name:'AI 分析车辆态度',exact:true}).click()
   await f.getByRole('button',{name:'重新标注样本',exact:true}).waitFor()
   assert.match(await f.locator('.attitude-metrics').innerText(),/1/)
   await f.getByRole('button',{name:'时间走势',exact:true}).click();assert.equal(await f.locator('.timeline-chart>button').count(),2)
   await f.locator('.timeline-chart>button').first().click();await f.locator('.result-row').first().click();await f.locator('.quote').waitFor()
   await f.getByRole('button',{name:'关闭面板',exact:true}).click();await f.getByRole('button',{name:'态度概览',exact:true}).click()
  }
  if(id==='family'){
   await f.getByRole('button',{name:'搜索亲子去处',exact:true}).click();await f.getByRole('button',{name:'找去处',exact:true}).click()
   await f.getByRole('button',{name:'地图选择 示例湖畔公园',exact:true}).waitFor()
   for(const name of ['示例湖畔公园','示例自然博物馆']){await f.getByRole('button',{name:'地图选择 '+name,exact:true}).click();await f.getByRole('button',{name:'选择地点 '+name,exact:true}).click()}
   await f.getByRole('button',{name:'规划已选 2/4 处',exact:true}).click();await f.getByRole('button',{name:'AI 编排这几处地点',exact:true}).click();await f.getByRole('button',{name:'应用这份计划',exact:true}).click()
   assert.match(await f.locator('.itinerary').innerText(),/示例湖畔公园/)
   await page.reload();await f.locator('.itinerary').waitFor();assert.match(await f.locator('.itinerary').innerText(),/示例自然博物馆/)
   await f.getByRole('button',{name:'地图选点',exact:true}).click()
  }
  if(id==='movies'){
   await f.getByRole('button',{name:'找电影',exact:true}).click();await f.locator('.poster-button').first().click()
   await f.getByRole('button',{name:'加入比较',exact:true}).click();await f.getByRole('button',{name:'今晚就看它',exact:true}).click()
   await f.getByRole('button',{name:'查 B 站相关视频',exact:true}).click();await f.getByText('演示：官方预告线索（非已核实片源）',{exact:true}).waitFor()
   await f.getByRole('button',{name:'发现',exact:true}).click();await f.getByRole('button',{name:'AI 比较 / 分组',exact:true}).click();await f.getByRole('button',{name:'AI 图解摘要',exact:true}).click();await f.locator('.digest').waitFor()
   await f.getByRole('button',{name:'演示分组',exact:true}).click();assert.equal(await f.locator('.poster-button').count(),2)
  }
  if(id==='transformer'){
   for(let step=1;step<=6;step++){await f.locator('.stepper button').nth(step-1).click();const measure=await f.locator('.content').evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight}));assert.ok(measure.scroll<=measure.height+2,JSON.stringify({step,...measure}))}
   await f.getByRole('button',{name:'4 FFN激活',exact:true}).click();await f.getByRole('button',{name:'喜欢',exact:true}).click()
   await f.getByRole('button',{name:'选择隐层神经元 3',exact:true}).click();await f.getByRole('button',{name:'拆解公式',exact:true}).click();assert.match(await f.locator('.formula').innerText(),/神经元 3/)
   await f.getByRole('button',{name:'关闭面板',exact:true}).click();await f.getByRole('button',{name:'实验 ⚙',exact:true}).click();await f.getByLabel('保留两条残差连接').uncheck();await f.getByRole('button',{name:'关闭面板',exact:true}).click();await page.reload();await f.locator('.micro-note').waitFor();assert.match(await f.locator('.micro-note').innerText(),/残差已关闭/)
  }
  if(id==='trains'){
   for(let i=0;i<2;i++){await f.getByRole('button',{name:'选择车次 →',exact:true}).first().click();await f.getByRole('button',{name:/查询 (杭州|上海)/}).click();await f.locator('.train-row').first().click();await f.getByRole('button',{name:'固定此车次',exact:true}).click()}
   assert.equal(await f.locator('.ticket-route').count(),2);await page.reload();await f.locator('.ticket-route').first().waitFor();assert.equal(await f.locator('.ticket-route').count(),2)
  }
  const child=page.frames().find(fr=>fr.parentFrame()),layout=await child.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,height:document.querySelector('.card').getBoundingClientRect().height,content:document.querySelector('.content').clientHeight,contentScroll:document.querySelector('.content').scrollHeight}))
  assert.ok(layout.scroll<=width+1);assert.ok(size==='square'?Math.abs(layout.height-width)<2:layout.height<=680)
  assert.deepEqual(errors,[]);await page.locator('iframe').screenshot({path:`${dir}/${id}-${width}-${size}.png`});results.push({id,width,size,passed:true,layout})
 }catch(e){results.push({id,width,size,passed:false,error:e.message,errors});await page.screenshot({path:`${dir}/${id}-${width}-${size}-failure.png`})}
 await context.tracing.stop({path:`${dir}/${id}-${width}-${size}.zip`});await context.close();console.log(JSON.stringify(results.at(-1)))
}}finally{await browser.close()}
await writeFile(`${dir}/results.json`,JSON.stringify({at:new Date().toISOString(),mode:'fixture',results},null,2));if(results.some(r=>!r.passed))process.exitCode=1
