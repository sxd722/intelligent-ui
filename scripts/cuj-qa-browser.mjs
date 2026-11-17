// Independent, host-authored CUJ acceptance. This browser is not Owl/OpenCLI.
import {chromium} from 'playwright'
import fs from 'node:fs/promises'
import {resolveClickStep} from '../server/cardspec/build-feedback.mjs'
export async function journeyBrowser(spec,{deck,dir,width=432,size='auto',run}){
 await fs.mkdir(dir,{recursive:true})
 const browser=await chromium.launch({channel:'chrome',headless:true})
 const context=await browser.newContext({viewport:{width,height:920},reducedMotion:'reduce'})
 await context.route('**/api/**',route=>route.request().url().endsWith('/api/health')?route.continue():route.abort())
 const page=await context.newPage();page.setDefaultTimeout(2500)
 const errors=[],actions=[];let autoNavigation=[];page.on('pageerror',e=>errors.push(e.message))
 const mount=async restore=>{await page.goto('http://127.0.0.1:8787/card-debug.html');await page.waitForFunction(()=>!!window.cardDebug);await page.evaluate(({spec,options})=>window.cardDebug.mount(spec,options),{spec,options:{deck,width,size,restore}});await page.waitForFunction(()=>window.cardDebug.ready());await page.waitForTimeout(550)}
 const snapshot=()=>page.evaluate(()=>window.cardDebug.snapshot())
 const shot=async label=>{const file=`${String(actions.length).padStart(2,'0')}-${label}.png`;await page.locator('.cs-stage').screenshot({path:dir+'/'+file});return file}
 const verify=(after,expect)=>{for(const value of expect?.text||[])if(!after.text.includes(value))throw Error('Missing visible result: '+value);for(const [key,value]of Object.entries(expect?.state||{}))if(JSON.stringify(after.state[key])!==JSON.stringify(value))throw Error('State mismatch: '+key);if(after.errors.length)throw Error(after.errors.join('; '))}
 async function record(name,action,expect){
  const before=await snapshot();autoNavigation=[];let error
  try{await action();await page.waitForTimeout(350);verify(await snapshot(),expect)}catch(e){error=e.message}
  const after=await snapshot(),screenshot=await shot('action');actions.push({name,expect,ok:!error,error,autoNavigation,before,after,screenshot})
  if(error)throw Error(error)
  return after
 }
 const target=async name=>{let s=await snapshot(),t=resolveClickStep({op:'click',name},s.controls);if(t.handle)return t
  for(const nav of s.controls.filter(c=>c.name.startsWith('卡片页面：'))){const button=page.getByRole('button',{name:nav.name,exact:true});if(!await button.count())continue;await button.click();autoNavigation.push(nav.name);await page.waitForTimeout(250);s=await snapshot();t=resolveClickStep({op:'click',name},s.controls);if(t.handle)return t}
  throw Error('Target not observed: '+name)
 }
 const api={page,snapshot,record,
  click:(name,expect)=>record(name,async()=>{const t=await target(name);await page.locator(`[data-debug-handle=${JSON.stringify(t.handle)}]`).click()},expect),
  fill:(name,value,expect)=>record('填写 '+name,()=>page.getByLabel(name,{exact:true}).fill(value),expect),
  edge:(last,expect)=>record(last?'进入末卡':'返回首卡',async()=>{const s=await snapshot(),nav=s.controls.filter(c=>c.name.startsWith('卡片页面：'));if(!nav.length)throw Error('No host navigation');await page.getByRole('button',{name:(last?nav.at(-1):nav[0]).name,exact:true}).click()},expect),
  reload:(expect)=>record('刷新恢复',async()=>{await page.evaluate(()=>window.cardDebug.save());await mount(true)},expect),
  check:(expect)=>record('结果检查',async()=>{},expect)}
 let failure,initial
 try{await mount(false);initial=await snapshot();await shot('initial');await run(api)}catch(e){failure=e.message}
 const result={width,size,scope:'host-authored actual UI operations; fixture tool transport; no external/medical/historical correctness claim',ok:!failure&&!errors.length,failure,errors,initial,actions}
 await fs.writeFile(dir+'/trace.json',JSON.stringify(result,null,2));await browser.close();console.log(dir,JSON.stringify({ok:result.ok,failure,actions:actions.length}));return result
}
