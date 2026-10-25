import {chromium} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {compileCloudSandbox} from '../sites/intelligent-ui/server/cloud-sandbox.mjs'
import {LINKED_REACT} from '../shared/cardspec/sandbox-linked-fixture.mjs'
const base=process.env.CLOUD_LINKED_URL||'http://127.0.0.1:8792',out=process.env.CLOUD_LINKED_OUT||'artifacts/cloud-linked';await mkdir(out,{recursive:true})
const source=`<card theme="soft">
<state id="level" type="number" initial={30}/><state id="count" type="number" initial={0}/>
<title>共享交互实验</title><slider label="强度" min={0} max={100} value={state.level} onChange="adjust"/>
<row><button onPress="reset">归零</button><button onPress="refresh">原生反馈</button></row>
<sandbox id="linked" label="动态图形" height={220} input={{level:state.level,count:state.count,status:"ready"}} actions={{adjust:"adjust",refresh:"refresh"}}
 brief="只画SVG波形与数据节点。自主CSS脉冲。读取data.level、count。点击波形调用adjust传value75，点击数据节点调用refresh。外部已有滑杆和归零按钮，不重复。图形可用键盘操作，标题短，透明底并继承颜色。">
<stat label="强度" value={state.level}/><stat label="反馈次数" value={state.count}/></sandbox>
<action id="adjust"><set target="level" value={clamp(event.value,0,100)}/></action>
<action id="reset"><set target="level" value={0}/></action>
<action id="refresh"><set target="count" value={state.count+1}/></action>
</card>`
const compiled=compileCard(source,{final:true,context:{renderMode:'hybrid'},cardId:'cloud-linked-proof'});assert.ok(compiled.complete,JSON.stringify(compiled.diagnostics))
const compat=process.env.CLOUD_LINKED_COMPAT==='1'
const reactSource=compat?LINKED_REACT.replace('<svg viewBox=', '<svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" data-compat="namespace" viewbox='):LINKED_REACT
const module=await compileCloudSandbox(reactSource),sse=events=>events.map(e=>'data: '+JSON.stringify(e)+'\n\n').join(''),results=[]
const browser=await chromium.launch({channel:'chrome',headless:true})
try{
 for(const live of [false,true]){
  if(live&&process.env.CLOUD_LINKED_LIVE!=='1')continue
  const context=await browser.newContext({viewport:{width:1200,height:950}}),page=await context.newPage();page.setDefaultTimeout(15000)
  let requests=0;page.on('request',r=>{if(r.url().endsWith('/api/sandbox/generate'))requests++})
  await page.route('**/api/chat',r=>r.fulfill({contentType:'text/event-stream',body:sse([
   {type:'phase_begin',id:'linked',phase:'dsl',kind:'cardspec'},
   {p:'',o:'add',v:{message:{id:'linked',status:'succeeded',content:{parts:[source]},metadata:{format:'cardspec',card_spec:compiled.spec}}}},
   {type:'phase_end',id:'linked',status:'succeeded'},{type:'message_stream_complete',status:'succeeded'}
  ])+'data: [DONE]\n\n'}))
  if(!live)await page.route('**/api/sandbox/generate',r=>{const p=r.request().postDataJSON();return r.fulfill({contentType:'text/event-stream',body:sse([{type:'result',result:{kind:'sandbox',module}},{type:'done'}].map(e=>({...e,requestId:p.requestId,pageId:p.pageId})))})})
  await page.goto(base+'/index.html');await page.getByTestId('cloud-generation-notice').waitFor()
  await page.getByLabel('UI能力').selectOption('hybrid')
  const hide=page.getByRole('button',{name:'hide stream',exact:true});if(await hide.isVisible())await hide.click()
  const start=Date.now(),reply=page.waitForResponse(r=>r.url().endsWith('/api/sandbox/generate'),{timeout:200000})
  await page.getByPlaceholder('描述你想要的交互卡片…').fill('共享交互实验')
  await page.getByRole('button',{name:'发送',exact:true}).click()
  const response=await reply,raw=await response.text();await writeFile(`${out}/${live?'live':'controlled'}.sse`,raw)
  const events=raw.split('\n').filter(l=>l.startsWith('data: ')).map(l=>JSON.parse(l.slice(6)))
  assert.ok(!events.some(e=>e.type==='error'),events.find(e=>e.type==='error')?.error)
  const f=page.frameLocator('.cs-sandbox iframe');await f.locator('svg').first().waitFor()
  if(compat&&!live){assert.equal(await f.locator('svg').getAttribute('viewBox'),'0 0 340 220');assert.equal(await f.locator('svg').getAttribute('data-compat'),'namespace');assert.equal(await page.getByRole('alert').count(),0)}
  assert.equal(await f.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)')
  if(!live){
   await f.getByRole('button',{name:'波形设为75'}).click();assert.equal(await page.getByRole('slider',{name:'强度'}).inputValue(),'75')
   await f.getByRole('button',{name:'图中查询'}).click();await f.getByText('强度 75 · 结果 1 · ready').waitFor()
   await page.getByRole('button',{name:'归零',exact:true}).click();await f.getByText('强度 0 · 结果 1 · ready').waitFor()
   await page.getByRole('slider',{name:'强度'}).fill('42');await f.getByText('强度 42 · 结果 1 · ready').waitFor()
   await page.getByLabel('视图选项').click();await page.getByRole('button',{name:'暂停动效'}).click()
   assert.equal(await f.locator('.wave').evaluate(e=>getComputedStyle(e).animationPlayState),'paused')
   await page.getByLabel('视图选项').click()
   for(const size of ['square','auto']){await page.getByLabel('卡片尺寸',{exact:true}).selectOption(size);for(const width of [320,360,432]){await page.setViewportSize({width,height:850});assert.ok(await f.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1))}}
   await page.reload();await f.getByText('强度 42 · 结果 1 · ready').waitFor();assert.equal(requests,1)
   await page.setViewportSize({width:1200,height:950});await page.getByLabel('UI能力').selectOption('native')
   assert.equal(await page.locator('iframe').count(),0);await page.getByRole('button',{name:'归零',exact:true}).click()
   await page.getByLabel('UI能力').selectOption('hybrid');await f.getByText('强度 0 · 结果 1 · ready').waitFor()
  }else{
   const before=await f.locator('body').innerText();await page.getByRole('slider',{name:'强度'}).fill('75')
   await page.waitForTimeout(300);assert.notEqual(await f.locator('body').innerText(),before)
   assert.equal(await page.getByRole('alert').count(),0)
  }
  await page.locator('.cs-stage').screenshot({path:`${out}/${live?'live':'controlled'}.png`})
  results.push({case:live?'live Worker/model surface':'controlled cloud bridge',passed:true,elapsedMs:Date.now()-start,requests,repairCount:events.find(e=>e.type==='result')?.result.repairCount})
  await context.close()
 }
 const response=await fetch(base+'/api/tools/invoke',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,403)
}catch(e){results.push({passed:false,error:e.stack});process.exitCode=1;for(const c of browser.contexts())for(const p of c.pages()){await writeFile(out+'/error.txt',await p.locator('body').innerText());await p.screenshot({path:out+'/error.png',fullPage:true}).catch(()=>{})}}
finally{await browser.close();await writeFile(out+'/results.json',JSON.stringify(results,null,2))}
console.log(JSON.stringify(results))
