import {readFile,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'
import assert from 'node:assert/strict'
const dir='artifacts/reading-navigation-qa',spec=JSON.parse(await readFile(dir+'/host-spec.json','utf8')),source=await readFile(dir+'/host.cardspec','utf8')
const turn={id:'reading-navigation-live-ui',role:'assistant',format:'cardspec',status:'succeeded',phases:[{id:'qa',kind:'cardspec',status:'succeeded',live:false,message:{status:'succeeded',content:{parts:[source]},metadata:{format:'cardspec',card_spec:spec}}}]}
const browser=await chromium.launch({channel:'chrome',headless:true}),trace=[]
try{
 const page=await browser.newPage({viewport:{width:800,height:1000},reducedMotion:'reduce'}),responses=[]
 await page.addInitScript(({turn})=>{if(window!==window.top)return;localStorage.setItem('cardspec:render-mode:v1','native');localStorage.setItem('cards:display:size:v1','full');sessionStorage.setItem('cardspec:conversation:v1',JSON.stringify({version:1,messages:[turn],toolsEnabled:true}))},{turn})
 await page.route('**/api/rsi-journal/**',route=>route.fulfill({json:{saved:true}}))
 page.on('response',response=>{if(response.url().endsWith('/api/tools/invoke'))responses.push((async()=>{const request=response.request().postDataJSON(),start=Date.now();const frames=(await response.text()).split('\n').filter(s=>s.startsWith('data:')).map(s=>JSON.parse(s.slice(5)));trace.push({request,frames,receivedAt:new Date().toISOString(),readMs:Date.now()-start})})())})
 await page.goto('http://127.0.0.1:8787/');await page.getByRole('radio',{name:'地方豪强',exact:true}).click();await page.getByRole('button',{name:'车迟国三妖',exact:true}).click()
 await page.getByRole('button',{name:'解读 · 车迟国三妖',exact:true}).click();assert.equal(responses.length,0)
 await page.getByRole('button',{name:'查阅书内证据',exact:true}).click();for(let attempt=0;attempt<300&&responses.length<1;attempt++)await new Promise(resolve=>setTimeout(resolve,100));await Promise.all(responses)
 assert.equal(trace[0].request.input.query,'车迟国');assert.ok(trace[0].frames.some(f=>f.type==='result'&&f.result.value.items.length))
 await page.getByText('本条原始信息',{exact:true}).count();await page.locator('.cs-stage').screenshot({path:dir+'/live-evidence-first.png'})
 await page.getByRole('button',{name:'返回上一层',exact:true}).click();await page.getByRole('radio',{name:'灵感大王',exact:true}).click();await page.getByRole('button',{name:'查阅书内证据',exact:true}).click()
 for(let attempt=0;attempt<300&&responses.length<2;attempt++)await new Promise(resolve=>setTimeout(resolve,100));await Promise.all(responses)
 assert.equal(trace.at(-1).request.input.query,'通天河');assert.ok(trace.at(-1).frames.some(f=>f.type==='result'&&f.result.value.items.length))
 await page.locator('.cs-stage').screenshot({path:dir+'/live-evidence-second.png'});await writeFile(dir+'/live-ui.txt',await page.locator('.cs-stage').innerText())
 console.log('real selection→CLI→snippet passed',trace.map(t=>({query:t.request.input.query,items:t.frames.find(f=>f.type==='result')?.result.value.items.length})))
}finally{await writeFile(dir+'/live-ui-trace.json',JSON.stringify(trace,null,2));await browser.close()}
