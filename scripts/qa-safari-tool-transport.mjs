import {chromium} from '@playwright/test'
import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {TOOL_DEMO,TOOL_PAGE,TOOL_SLOT} from '../shared/cardspec/tool-fixtures.mjs'

// Use the live Douban result as a deterministic UI replay; no Owl session is created.
const live=JSON.parse(await readFile('artifacts/safari-tool-qa/live.json','utf8'))
assert.equal(live.outcome.passed,true)
const browser=await chromium.launch({channel:'chrome',headless:true})
try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],requests=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.addInitScript(()=>Object.defineProperty(ReadableStream.prototype,Symbol.asyncIterator,{value:undefined,configurable:true}))
  await page.route('**/api/tools/invoke',route=>{
    const p=route.request().postDataJSON();requests.push(p.tool)
    const result=p.tool==='glm.generate'?{kind:p.target.startsWith('slot:')?'slot':'page',spec:compileCard(p.target.startsWith('slot:')?TOOL_SLOT:TOOL_PAGE,{final:true,cardId:'next'}).spec}:live.outcome.result
    return route.fulfill({contentType:'text/event-stream',body:[{type:'result',result},{type:'done'}].map(f=>'data: '+JSON.stringify({...f,pageId:p.pageId,requestId:p.requestId})+'\r\n\r\n').join('')})
  })
  await page.goto('https://device.tailnet.ts.net/cardspec-lab.html?fixture=counter')
  await page.getByText('输入 DSL 验证',{exact:true}).click(); await page.getByLabel('DSL源码').fill(TOOL_DEMO.replace('autocli.hackernews.top','opencli.douban.movie-hot').replace('items:[],source:', 'items:[],truncated:false,source:')); await page.getByRole('button',{name:'应用源码',exact:true}).click(); await page.getByRole('button',{name:'模拟结束',exact:true}).click(); await page.getByRole('button',{name:'刷新资讯',exact:true}).click(); await page.getByText(live.outcome.result.value.items[0].title,{exact:true}).first().waitFor({timeout:5000})
  await page.getByLabel('我的笔记',{exact:true}).fill('Safari 流兼容测试')
  await page.getByRole('button',{name:'刷新资讯',exact:true}).click()
  await page.getByRole('button',{name:'深入探索',exact:true}).click()
  await page.getByLabel('本页笔记',{exact:true}).waitFor()
  await page.getByRole('button',{name:'返回上一张页面',exact:true}).click()
  assert.equal(await page.getByLabel('我的笔记',{exact:true}).inputValue(),'Safari 流兼容测试')
  assert.deepEqual(errors,[])
  await page.screenshot({path:'artifacts/safari-tool-qa/browser.png',fullPage:true})
  const report={at:new Date().toISOString(),passed:true,mode:'Chromium with ReadableStream async iterator disabled; live Douban response replay',requests,errors}
  await writeFile('artifacts/safari-tool-qa/browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}finally{await browser.close()}





