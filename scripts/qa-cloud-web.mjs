import {chromium} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {SANDBOX_FIXTURE} from '../shared/cardspec/sandbox-fixtures.mjs'
import {compileCloudSandbox} from '../sites/intelligent-ui/server/cloud-sandbox.mjs'
const base=process.env.CLOUD_WEB_URL||'http://127.0.0.1:8792',out=process.env.CLOUD_WEB_DIR||'artifacts/cloud-web/preview'
await mkdir(out,{recursive:true})
const code=`export default function App({state,setState}){return <section style={{padding:12,background:"#0f172a",color:"white",borderRadius:16}} className="surface-enter"><svg viewBox="0 0 300 120" height="120" style={{width:"100%"}}><defs><linearGradient id="energy"><stop stopColor="#22d3ee"/><stop offset="1" stopColor="#34d399"/></linearGradient></defs><rect x="10" y="25" width={state.energy*2.8} height="55" rx="12" fill="url(#energy)" style={{transition:"width 240ms ease"}}/><text x="150" y="60" textAnchor="middle" fill="white">{state.energy}</text></svg><p>能量 {state.energy}</p><button onClick={()=>setState(s=>({...s,energy:s.energy-10,steps:s.steps+1}))} disabled={state.energy<10}>推进一步</button><button onClick={()=>setState({energy:60,steps:0})}>重置</button><button onClick={()=>{throw Error("controlled local failure")}}>测试局部错误</button></section>}`
const module=await compileCloudSandbox(code)
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[]
const sse=events=>events.map(e=>'data: '+JSON.stringify(e)+'\n\n').join('')
const parse=t=>t.split('\n').filter(x=>x.startsWith('data: ')&&x!=='data: [DONE]').map(x=>JSON.parse(x.slice(6)))
async function configure(page){
 await page.goto(base+'/index.html')
 await page.getByTestId('cloud-generation-notice').waitFor()
 await page.getByLabel('UI能力').selectOption('hybrid')
 assert.equal(await page.getByRole('checkbox',{name:'工具增强',exact:true}).count(),0)
 const hide=page.getByRole('button',{name:'hide stream',exact:true});if(await hide.isVisible())await hide.click()
}
try{
 const p=await browser.newPage({viewport:{width:1200,height:900}});p.setDefaultTimeout(12000)
 let calls=0
 const spec=compileCard(SANDBOX_FIXTURE,{final:true,context:{renderMode:'hybrid'},cardId:'cloud-web-controlled'}).spec
 await p.route('**/api/chat',r=>r.fulfill({contentType:'text/event-stream',body:sse([
  {type:'phase_begin',id:'web',phase:'dsl',kind:'cardspec'},
  {p:'',o:'add',v:{message:{id:'web',status:'succeeded',content:{parts:[SANDBOX_FIXTURE]},metadata:{format:'cardspec',card_spec:spec}}}},
  {type:'phase_end',id:'web',status:'succeeded'},{type:'message_stream_complete',status:'succeeded'}
 ])+'data: [DONE]\n\n'}))
 await p.route('**/api/sandbox/generate',r=>{calls++;const request=r.request().postDataJSON();return r.fulfill({contentType:'text/event-stream',body:sse([{type:'result',result:{kind:'sandbox',module}},{type:'done'}].map(e=>({...e,requestId:request.requestId,pageId:request.pageId})))})})
 await configure(p)
 await p.getByPlaceholder('描述你想要的交互卡片…').fill('controlled cloud Web surface')
 await p.getByRole('button',{name:'发送',exact:true}).click()
 const f=p.frameLocator('.cs-sandbox iframe')
 await f.getByText('能量 60',{exact:true}).waitFor()
 assert.equal(await p.locator('.cs-sandbox iframe').getAttribute('sandbox'),'allow-scripts')
 await f.getByRole('button',{name:'推进一步'}).click();await f.getByText('能量 50',{exact:true}).waitFor()
 const animation=await f.locator('section').evaluate(el=>getComputedStyle(el).animationName)
 assert.equal(animation,'surface-enter')
 await p.emulateMedia({reducedMotion:'reduce'})
 assert.equal(await f.locator('section').evaluate(el=>getComputedStyle(el).animationName),'none')
 await p.emulateMedia({reducedMotion:'no-preference'})
 for(const size of ['square','auto']){
  await p.setViewportSize({width:1200,height:900});await p.getByLabel('卡片尺寸',{exact:true}).selectOption(size)
  for(const width of [320,360,432]){
   await p.setViewportSize({width,height:850})
   assert.ok(await f.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth+1))
  }
 }
 await p.locator('.cs-stage').screenshot({path:out+'/controlled.png'})
 await p.reload();await f.getByText('能量 50',{exact:true}).waitFor();assert.equal(calls,1)
 await p.setViewportSize({width:1200,height:900});await p.getByLabel('UI能力').selectOption('native')
 assert.equal(await p.locator('iframe').count(),0)
 await p.getByRole('button',{name:'充能',exact:true}).click();assert.match(await p.locator('.cs-sandbox').innerText(),/75/)
 await p.getByLabel('UI能力').selectOption('hybrid');await f.getByText('能量 50',{exact:true}).waitFor()
 await f.getByRole('button',{name:'测试局部错误'}).click();await p.getByRole('alert').filter({hasText:'controlled local failure'}).waitFor()
 await p.getByRole('button',{name:'推进一步',exact:true}).click();assert.match(await p.locator('.cs-sandbox').innerText(),/65/)
 results.push({case:'controlled',passed:true,checks:['opaque iframe','QuickJS/WASM','local SVG gradient','CSS animation','reduced motion','320/360/432 square/auto','state restore without regeneration','disable Web','runtime error native fallback']})
 await p.close()

 // A real cloud Worker invokes the model and syntax-transforms its JSX. The
 // initial CardSpec is fixed here so this test isolates the new cloud path.
 const live=await browser.newPage({viewport:{width:1200,height:900}});live.setDefaultTimeout(15000)
 let generationTrace=''
 if(process.env.CLOUD_WEB_FULL!=='1')await live.route('**/api/chat',r=>r.fulfill({contentType:'text/event-stream',body:sse([
  {type:'phase_begin',id:'live',phase:'dsl',kind:'cardspec'},
  {p:'',o:'add',v:{message:{id:'live',status:'succeeded',content:{parts:[SANDBOX_FIXTURE]},metadata:{format:'cardspec',card_spec:{...spec,cardId:'cloud-web-live'}}}}},
  {type:'phase_end',id:'live',status:'succeeded'},{type:'message_stream_complete',status:'succeeded'}
 ])+'data: [DONE]\n\n'}))
 await configure(live)
 const reply=live.waitForResponse(r=>r.url().endsWith('/api/sandbox/generate'),{timeout:200000})
 const initialReply=process.env.CLOUD_WEB_FULL==='1'?live.waitForResponse(r=>r.url().endsWith('/api/chat'),{timeout:200000}):null
 await live.getByPlaceholder('描述你想要的交互卡片…').fill(process.env.CLOUD_WEB_FULL==='1'?'做一个小型储能调度模拟器，用SVG电池图平滑显示变化。初始能量60，推进一步扣10，低于10禁用；充能加15上限100，重置到60。按钮名：推进一步、充能、重置。开启Web增强并保留原生操作，无需真实数据或其他工具。':'cloud React generation smoke test')
 await live.getByRole('button',{name:'发送',exact:true}).click()
 if(initialReply)await writeFile(out+'/initial.sse',await(await initialReply).text())
 const response=await reply;assert.equal(response.status(),200)
 generationTrace=await response.text();await writeFile(out+'/surface.sse',generationTrace)
 const events=parse(generationTrace);assert.ok(!events.find(e=>e.type==='error'),events.find(e=>e.type==='error')?.error)
 assert.ok(events.find(e=>e.type==='result')?.result.module)
 const lf=live.frameLocator('.cs-sandbox iframe')
 await lf.locator('svg').waitFor({timeout:20000})
 const before=await lf.locator('body').innerText()
 await lf.getByRole('button',{name:/推进|步进/}).first().click()
 await live.waitForTimeout(400);const after=await lf.locator('body').innerText();assert.notEqual(before,after)
 await live.setViewportSize({width:360,height:850})
 assert.ok(await lf.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth+1))
 await live.locator('.cs-stage').screenshot({path:out+'/live.png'})
 await live.reload();await lf.locator('svg').waitFor();assert.equal(await lf.locator('body').innerText(),after)
 results.push({case:'live-cloud-jsx',passed:true,initialCard:process.env.CLOUD_WEB_FULL==='1'?'real model':'controlled',surface:'real model through Worker',before,after})
 await live.close()
}catch(e){
 results.push({passed:false,error:e.stack})
 for(const context of browser.contexts())for(const p of context.pages()){
  await writeFile(out+'/error.txt',await p.locator('body').innerText());await p.screenshot({path:out+'/error.png',fullPage:true}).catch(()=>{})
 }
 process.exitCode=1
}finally{await browser.close();await writeFile(out+'/results.json',JSON.stringify(results,null,2))}
console.log(JSON.stringify(results))
