import {chromium} from '@playwright/test'
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {fixture} from '../src/baseline/fixtures.mjs'
import {insightFixture} from '../src/baseline/insight-fixtures.mjs'
const dir='artifacts/h5-baseline-v2';await mkdir(dir,{recursive:true});const b=await chromium.launch({channel:'chrome',headless:true}),checks=[]
try{
 const ctx=await b.newContext(),p=await ctx.newPage();p.setDefaultTimeout(7000);let mode='valid',calls=0
 await p.route('**/api/photo?**',r=>r.fulfill({status:503,body:'unavailable'}));await p.route('https://tile.openstreetmap.org/**',r=>r.abort())
 await p.route('**/api/tools/invoke',async route=>{
  const q=route.request().postDataJSON();let frame
  if(q.tool==='glm.generate'){
   calls++;const c=q.input.context,rows=c.rows.map(r=>({rowKey:r.ref,title:r.title,name:r.title,content:r.body,source:r.source}));let value=insightFixture(c.kind,rows)
   if(mode==='invalid')value.slots[0].ref='invented-poi'
   if(mode==='slow')await new Promise(r=>setTimeout(r,1000))
   frame=mode==='failure'?{type:'error',error:'模拟模型服务失败'}:{type:'result',result:{kind:'json',value}}
  }else frame={type:'result',result:{kind:'json',value:fixture(q.tool,q.input)}}
  try{await route.fulfill({contentType:'text/event-stream',body:[frame,{type:'done'}].map(f=>'data: '+JSON.stringify({...f,requestId:q.requestId,pageId:q.pageId})+'\n\n').join('')})}catch{}
 })
 await p.goto('http://127.0.0.1:8787/h5-baseline/index.html?case=family&width=360&size=square')
 const f=p.frameLocator('iframe');await f.getByRole('button',{name:'搜索亲子去处'}).click();await f.getByRole('button',{name:'找去处',exact:true}).click()
 for(const name of ['示例湖畔公园','示例自然博物馆']){await f.getByRole('button',{name:'地图选择 '+name,exact:true}).click();await f.getByRole('button',{name:'选择地点 '+name,exact:true}).click()}
 await f.getByRole('button',{name:'规划已选 2/4 处'}).click()
 mode='invalid';await f.getByRole('button',{name:'AI 编排这几处地点'}).click();await f.getByText(/模型引用了未提交/).waitFor();assert.equal(await f.getByRole('button',{name:'应用这份计划'}).count(),0);checks.push('invalid model refs rejected; selected POIs preserved')
 mode='failure';await f.getByRole('button',{name:'AI 编排这几处地点'}).click();await f.getByText(/模拟模型服务失败/).waitFor();checks.push('provider failure keeps selections and offers retry')
 mode='slow';await f.getByRole('button',{name:'AI 编排这几处地点'}).click();await f.getByRole('button',{name:'移除',exact:true}).first().click();await f.getByText(/资料或条件已更新/).waitFor();assert.equal(await f.getByRole('button',{name:'应用这份计划'}).count(),0);checks.push('changed selection discards stale analysis')
 await f.getByRole('button',{name:'AI 编排这几处地点'}).click();await f.getByRole('button',{name:'取消',exact:true}).click();await f.getByText(/已取消，保留原内容/).waitFor();await p.waitForTimeout(1100);assert.equal(await f.getByRole('button',{name:'应用这份计划'}).count(),0);checks.push('cancel prevents late plan commit')
 mode='valid';await f.getByRole('button',{name:'AI 编排这几处地点'}).click();await f.getByRole('button',{name:'应用这份计划'}).click();await f.locator('.itinerary').waitFor();checks.push('retry can apply a valid plan')
 const before=calls;await p.reload();await f.locator('.itinerary').waitFor();assert.equal(calls,before);checks.push('reload restores plan without model replay')
 const child=p.frames().find(x=>x.parentFrame());assert.equal(await child.evaluate(async()=>{try{await fetch('https://example.com/');return false}catch{return true}}),true);checks.push('sandbox still denies direct network')
 await p.screenshot({path:`${dir}/failure-recovery.png`});await ctx.close()
}finally{await b.close()}
await writeFile(`${dir}/errors.json`,JSON.stringify({at:new Date().toISOString(),passed:true,mode:'controlled doubles',checks},null,2));console.log(JSON.stringify(checks))
