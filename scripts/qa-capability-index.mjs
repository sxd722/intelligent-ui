import {chromium} from 'playwright'
import {mkdir,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {toolDiscoveryReference} from '../shared/cardspec/tool-discovery.mjs'
import {TOOLS} from '../shared/cardspec/tools.mjs'
import {componentIndex} from '../shared/cardspec/capability-index.mjs'
const out='artifacts/capability-index-20261022';await mkdir(out,{recursive:true})
const source=`<card><data id="good" value={[{id:"a",label:"甲"},{id:"b",label:"乙"}]}/><data id="bad" value={[{id:"a",label:"甲"},{id:"x",label:"重复一"},{id:"x",label:"重复二"},{id:null,label:"缺失"},{id:"z",label:"丙"}]}/><state id="rows" type="array" initial={[{id:"a",label:"甲"},{id:"b",label:"乙"}]}/><state id="n" type="number" initial={0}/><state id="chosen" type="string" initial="无"/><text className="large"><bold>逐行恢复测试</bold><italic>正常内容可继续操作</italic></text><stat label="计数" value={state.n}/><text>选中：{state.chosen}</text><row><button onPress="inc">计数加一</button><button onPress="break">模拟异常数据</button><button onPress="fix">恢复数据</button></row><region overflow="scroll"><each items={state.rows} as="entry" itemKey={entry.id}><button onPress="pick" args={entry}>{entry.label}</button></each></region><action id="inc"><increment target="n" value={1}/></action><action id="break"><set target="rows" value={data.bad}/></action><action id="fix"><set target="rows" value={data.good}/></action><action id="pick"><set target="chosen" value={args.label}/></action></card>`
await writeFile(out+'/fixture.cardspec',source)
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[]
try{
 for(const width of [320,360,432])for(const size of ['square','auto']){
  const page=await browser.newPage({viewport:{width:Math.max(400,width+40),height:1000}})
  // No real CLI, bindings, user session or Owl is used by this QA.
  await page.route('**/api/tools**',route=>route.fulfill({json:{tools:[],connections:[]}}))
  await page.goto('http://127.0.0.1:8787/cardspec-lab.html?fixture=counter')
  await page.getByText('输入 DSL 验证',{exact:true}).click()
  await page.getByLabel('DSL源码').fill(source);await page.getByRole('button',{name:'应用源码',exact:true}).click()
  await page.getByLabel('宽度',{exact:true}).selectOption(String(width))
  await page.getByLabel('卡片尺寸',{exact:true}).selectOption(size)
  const diagnostics=JSON.parse(await page.getByTestId('diagnostics').innerText());assert.equal(diagnostics.filter(d=>d.severity==='error').length,0)
  const card=page.locator('.cs-card'),button=name=>card.getByRole('button',{name,exact:true})
  await button('甲').click();await button('计数加一').click();await button('模拟异常数据').click()
  await page.waitForFunction(()=>document.querySelectorAll('.cs-node-recovery').length===3)
  assert.equal(await button('重复一').count(),0);assert.equal(await button('缺失').count(),0)
  await button('丙').click();await button('计数加一').click()
  assert.match(await card.innerText(),/选中：丙/);assert.match(await card.locator('[data-cs-component="stat"]').innerText(),/2/)
  await page.locator('.cs-stage').screenshot({path:`${out}/${width}-${size}-partial.png`})
  await button('恢复数据').click();assert.equal(await page.locator('.cs-node-recovery').count(),0)
  await button('乙').click();assert.match(await card.innerText(),/选中：乙/)
  assert.match(await card.locator('[data-cs-component="stat"]').innerText(),/2/)
  const overflow=await page.locator('.cs-stage').evaluate(el=>el.scrollWidth>el.clientWidth+1);assert.equal(overflow,false)
  results.push({width,size,passed:true,isolatedRows:3,unaffectedCounter:2,recovery:true,horizontalOverflow:overflow})
  await page.close()
 }
 const catalog=Object.values(TOOLS).map(t=>({...t,available:!t.unsupportedReason}))
 const metrics={componentIndexChars:componentIndex().length,oldToolIndexChars:toolDiscoveryReference(catalog).length,newToolIndexChars:toolDiscoveryReference(catalog,'',{compact:true}).length}
 await writeFile(out+'/results.json',JSON.stringify({results,metrics},null,2));console.log(JSON.stringify({results,metrics}))
}finally{await browser.close()}
