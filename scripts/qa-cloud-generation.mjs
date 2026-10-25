import {chromium} from '@playwright/test'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const base=process.env.CLOUD_QA_URL||'http://127.0.0.1:8792'
const dir=process.env.CLOUD_QA_DIR||'artifacts/cloud-generation/live'
await mkdir(dir,{recursive:true})
const b=await chromium.launch({channel:'chrome',headless:true}),results=[]
const cases=[
 {id:'counter',format:'cardspec',mode:'direct',size:'square',prompt:'做一张简洁的计数卡。初始数值0，按钮名字固定为“增加”和“重置”。增加每次加1，重置到0。展示当前数值。不要其他功能。'},
 {id:'budget',format:'cardspec',mode:'experience',size:'auto',prompt:'旅行预算分配卡：用户输入总预算，用滑杆调整住宿比例，图表和剩余金额同步变化。只做本地计算，默认预算2000元，允许重置。'},
 {id:'no-live-data',format:'cardspec',mode:'direct',size:'square',prompt:'今日杭州到上海的订票助手。在当前不能查询车次的情况下，明确提示未连接实时数据，让我手动填写车次、出发时间和票价，保存为票夹；不要虚构车次。'},
 {id:'dil',format:'dil',mode:'direct',size:'square',prompt:'只做一张计数卡，初始0，按钮“增加”每次加1，“重置”回到0。'}
]
try{
 for(const item of cases.filter(x=>!process.env.CLOUD_QA_CASES||process.env.CLOUD_QA_CASES.split(',').includes(x.id))){
  const p=await b.newPage({viewport:{width:1200,height:900}}),errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push({url:r.url(),method:r.method()}))
  p.setDefaultTimeout(12000)
  const start=Date.now();let trace=''
  try{
   if(process.env.CLOUD_QA_REPLAY){
    const recorded=await readFile(`${process.env.CLOUD_QA_REPLAY}/${item.id}.sse`,'utf8')
    if(!recorded.includes('"message_stream_complete"'))throw Error('Recorded generation is incomplete')
    await p.route('**/api/chat',route=>route.fulfill({status:200,contentType:'text/event-stream',body:recorded}))
   }
   await p.goto(base+'/index.html')
   await p.getByTestId('cloud-generation-notice').waitFor()
   assert.equal(await p.getByText('工具增强',{exact:true}).count(),0)
   await p.getByLabel('渲染协议',{exact:true}).selectOption(item.format)
   await p.getByLabel('卡片尺寸',{exact:true}).selectOption(item.size)
   if(item.mode==='experience')await p.getByRole('button',{name:'Pipeline: direct',exact:false}).click()
   const hide=p.getByRole('button',{name:'hide stream',exact:true})
   if(await hide.count())await hide.click()
   await p.setViewportSize({width:430,height:900})
   await p.getByPlaceholder('描述你想要的交互卡片…').fill(item.prompt)
   const responsePromise=p.waitForResponse(r=>r.url().endsWith('/api/chat'),{timeout:300000})
   await p.getByRole('button',{name:'发送',exact:true}).click()
   const response=await responsePromise;assert.equal(response.status(),200)
   trace=await response.text()
   await p.getByRole('button',{name:'停止',exact:true}).waitFor({state:'hidden',timeout:300000})
   const events=trace.split('\n').filter(x=>x.startsWith('data: ')&&x!=='data: [DONE]').map(x=>JSON.parse(x.slice(6)))
   const fail=events.find(e=>e.type==='stream_error');assert.ok(!fail,fail?.error?.message)
   assert.equal(events.find(e=>e.type==='message_stream_complete')?.status,'succeeded')
   const card=p.locator(item.format==='dil'?'.dil-card':'.cs-card').last()
   await card.waitFor()
   if(['counter','dil'].includes(item.id)){
    await card.getByRole('button',{name:'增加',exact:true}).click()
    await card.getByRole('button',{name:'增加',exact:true}).click()
    assert.match(await card.innerText(),/2/)
    await card.getByRole('button',{name:'重置',exact:true}).click()
    assert.match(await card.innerText(),/0/)
   }else if(item.id==='budget'){
    const before=await card.innerText(),slider=card.getByRole('slider').first()
    await slider.focus();await slider.press('ArrowRight');await p.waitForTimeout(300)
    assert.notEqual(await card.innerText(),before)
   }else{
    assert.match(await card.innerText(),/手动|未连接|未接入|无法查询/)
    const inputs=card.locator('input')
    assert.ok(await inputs.count()>=1)
    await inputs.first().fill('G测试')
   }
   await p.waitForTimeout(300)
   const saved=await p.evaluate(()=>sessionStorage.getItem('cardspec:conversation:v1'))
   assert.ok(saved)
   assert.deepEqual(errors,[])
   assert.deepEqual(requests.filter(r=>r.method==='POST'&&!r.url.endsWith('/api/chat')),[])
   await p.reload();await p.locator(item.format==='dil'?'.dil-card':'.cs-card').last().waitFor()
   await p.screenshot({path:`${dir}/${item.id}.png`,fullPage:true})
   const telemetry=events.find(e=>e.type==='server_ste_metadata')?.metadata
   results.push({id:item.id,passed:true,replayed:Boolean(process.env.CLOUD_QA_REPLAY),elapsedMs:Date.now()-start,telemetry,requests:requests.map(r=>({...r,url:new URL(r.url).pathname}))})
  }catch(e){results.push({id:item.id,passed:false,error:e.message,elapsedMs:Date.now()-start,errors});await p.screenshot({path:`${dir}/${item.id}-error.png`,fullPage:true}).catch(()=>{})}
  await writeFile(`${dir}/${item.id}.sse`,trace);console.log(JSON.stringify(results.at(-1)));await p.close()
 }
}finally{await b.close()}
await writeFile(`${dir}/results.json`,JSON.stringify(results,null,2));if(results.some(x=>!x.passed))process.exitCode=1
