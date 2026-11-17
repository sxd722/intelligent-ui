import {readFile,writeFile,mkdir} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
const dir='artifacts/flight-no-fallback-qa';await mkdir(dir,{recursive:true})
const source=await readFile('artifacts/generation-debug/dd3f226b-76d2-425f-b658-bd4075ee7ad7/882ba0d00e377d0373ea/candidate.cardspec','utf8')
const compile=async(source,id)=>{const r=compileCard(source,{final:true,cardId:id,context:{renderMode:'web',cardSize:'full'}});await validateRichContent(r);assert.ok(r.complete,JSON.stringify(r.diagnostics));return r.spec}
const spec=await compile(source,'flight-review')
const counter='<card><sandbox id="timer" brief="计时器" height={180} initial={{n:0,running:false}} source={`import React,{useEffect} from "react";export default function App({state,setState,active}){useEffect(()=>{if(!state.running||!active)return;const t=setInterval(()=>setState(s=>({...s,n:s.n+1})),25);return()=>clearInterval(t)},[state.running,active]);return <div><p>计数 {state.n}</p><button onClick={()=>setState(s=>({...s,running:true}))}>启动</button><button onClick={()=>setState(s=>({...s,running:false}))}>暂停</button></div>}`}/></card>'
for(const [id,s,steps] of [['flight',spec,[{op:'click',name:'开始自由飞行',expect:{text:'空中巡航'}},{op:'click',name:'跑道起飞',expect:{text:'跑道加速'}},{op:'reload',expect:{text:'跑道加速'}},{op:'click',name:'↑ 拉升'},{op:'click',name:'← 左倾'},{op:'click',name:'切换视角',expect:{text:'CHASE CAM'}}]],['timer',await compile(counter,'timer-review'),[{op:'click',name:'启动',waitMs:400},{op:'reload'},{op:'click',name:'暂停'},{op:'reload'}]]]){
 const r=await runDebugBrowser(s,{scenarios:['normal'],viewports:[320,432],size:'full',steps,artifactDir:dir+'/'+id,signal:AbortSignal.timeout(60000)})
 await writeFile(dir+'/'+id+'.trace.json',JSON.stringify(r,null,2));assert.equal(r.status,'tested',r.reason)
 for(const run of r.runs){assert.deepEqual(run.final.errors,[]);for(const a of run.actions){assert.ok(a.ok,a.error);assert.notEqual(a.assertion?.passed,false,JSON.stringify(a.assertion));if(a.step.op==='reload')assert.equal(a.restored,true,JSON.stringify(a.restoreComparison))}}
 console.log(id,'passed')
}
// Actual application failure branch, in an isolated browser profile. No model
// requests and no changes to the user's conversation or OpenCLI binding.
const browser=await chromium.launch({channel:'chrome',headless:true})
try{
 const page=await browser.newPage({viewport:{width:950,height:1000}})
 const turn={id:'flight-qa-failed',role:'assistant',format:'cardspec',status:'failed',error:'QA: 局部验收未完成',startedAt:0,phases:[{id:'phase',kind:'cardspec',status:'failed',live:false,message:{status:'failed',content:{parts:[source]},metadata:{format:'cardspec',card_spec:spec}}}]}
 await page.addInitScript(({turn})=>{if(window!==window.top)return;localStorage.setItem('cardspec:render-mode:v1','web');sessionStorage.setItem('cardspec:conversation:v1',JSON.stringify({version:1,messages:[turn],toolsEnabled:false}))},{turn})
 await page.route('**/api/rsi-journal/**',route=>route.fulfill({json:{saved:true}}))
 await page.goto('http://127.0.0.1:8787/')
 await page.getByText('验收未完成 · 保留当前交互版本',{exact:true}).waitFor()
 assert.equal(await page.locator('[inert]').count(),0)
 assert.equal(await page.getByRole('status',{name:'卡片恢复'}).count(),0)
 await page.locator('.cs-web-sandbox').scrollIntoViewIfNeeded();await page.screenshot({path:dir+'/app-before.png'});await writeFile(dir+'/app-before.txt',await page.locator('body').innerText());const f=page.frameLocator('.cs-web-sandbox iframe');await f.getByRole('button',{name:'开始自由飞行',exact:true}).click();await f.getByRole('button',{name:'↑ 拉升',exact:true}).click();await f.getByRole('button',{name:'← 左倾',exact:true}).click()
 await f.getByRole('button',{name:'切换视角',exact:true}).click();await f.getByText('CHASE CAM',{exact:true}).waitFor()
 await page.locator('.cs-stage').screenshot({path:dir+'/failed-status-interactive.png'})
 await writeFile(dir+'/result.json',JSON.stringify({flight:true,timer:true,failedStatusInteractive:true,scope:'Original flight source unchanged; actual host tests at 320/432; full terminal paths not checked.'},null,2))
 console.log('failed status remains interactive')
}finally{await browser.close()}
