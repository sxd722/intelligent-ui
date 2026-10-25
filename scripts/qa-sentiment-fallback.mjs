import {chromium} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {insightFixture} from '../src/baseline/insight-fixtures.mjs'
const dir='artifacts/sentiment-fallback',live=JSON.parse(await readFile(`${dir}/live.json`,'utf8')),results=[]
const browser=await chromium.launch({channel:'chrome',headless:true})
try{for(const width of [320,360,432])for(const size of ['square','auto']){
 const context=await browser.newContext({viewport:{width:600,height:900}}),p=await context.newPage();p.setDefaultTimeout(8000);const calls=[],errors=[]
 p.on('pageerror',e=>errors.push(e.message))
 await p.route('**/api/tools/invoke',async route=>{
  const q=route.request().postDataJSON();calls.push(q.tool);let e
  if(q.tool==='opencli.google.news')e={type:'result',result:{kind:'json',value:{items:[]}}}
  else if(q.tool==='opencli.weibo.search')e={type:'error',error:'没有微博结果'}
  else if(q.tool==='opencli.xiaohongshu.search')e={type:'error',error:'来源需要登录'}
  else if(q.tool==='glm.generate'){const rows=q.input.context.rows.map(r=>({rowKey:r.ref,title:r.title,content:r.body}));e={type:'result',result:{kind:'json',value:insightFixture('sentiment',rows)}}}
  else {const r=live.results.find(r=>r.tool===q.tool&&(q.tool!=='opencli.bilibili.comments'||r.input.bvid===q.input.bvid));e={type:'result',result:{kind:'json',value:r?.value||{items:[]}}}}
  await route.fulfill({contentType:'text/event-stream',body:[e,{type:'done'}].map(e=>'data: '+JSON.stringify({...e,requestId:q.requestId,pageId:q.pageId})+'\n\n').join('')})
 })
 try{
  await p.goto(`http://127.0.0.1:8787/h5-baseline/index.html?case=sentiment&width=${width}&size=${size}`)
  const f=p.frameLocator('iframe');await f.getByRole('button',{name:'搜索新闻与用户反馈',exact:true}).click()
  await f.getByRole('button',{name:'AI 分析车辆态度',exact:true}).click();await f.getByRole('button',{name:'重新标注样本',exact:true}).waitFor()
  assert.match(await f.locator('.content').innerText(),/样本 6（非全网）/)
  await f.getByRole('button',{name:'时间走势',exact:true}).click();await f.locator('.timeline-chart>button').first().click();await f.locator('.result-row').first().click();await f.locator('.quote').waitFor();assert.match(await f.getByRole('dialog').innerText(),/所在视频/)
  await f.getByRole('button',{name:'关闭面板'}).click();await f.getByRole('button',{name:'态度概览',exact:true}).click()
  await f.locator('.coverage-link').click();assert.match(await f.getByRole('dialog').innerText(),/来源需要登录/);assert.match(await f.getByRole('dialog').innerText(),/自动换源/)
  await f.getByRole('button',{name:'关闭面板'}).click()
  const before=calls.length;await p.reload();await f.getByRole('button',{name:'重新标注样本',exact:true}).waitFor();assert.equal(calls.length,before)
  const layout=await f.locator('.card').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth,height:e.clientHeight,content: e.querySelector('.content').clientHeight,contentScroll:e.querySelector('.content').scrollHeight}))
  assert.ok(layout.scroll<=layout.width);assert.ok(layout.contentScroll<=layout.content+2)
  assert.deepEqual(errors,[])
  await p.locator('iframe').screenshot({path:`${dir}/fallback-${width}-${size}.png`})
  results.push({width,size,passed:true,calls,layout})
 }catch(e){results.push({width,size,passed:false,error:e.message,errors});await p.screenshot({path:`${dir}/failure-${width}-${size}.png`})}
 await context.close();console.log(JSON.stringify(results.at(-1)))
}}finally{await browser.close()}
await writeFile(`${dir}/ui-replay.json`,JSON.stringify({mode:'recorded real comments + controlled errors/model',results},null,2));if(results.some(r=>!r.passed))process.exitCode=1
