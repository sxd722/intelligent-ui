import {createServer} from 'node:http'
import {readFile,mkdir} from 'node:fs/promises'
import {resolve,extname,sep} from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright'

const dist=fileURLToPath(new URL('../../dist/',import.meta.url))
let occupied=false
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.woff2':'font/woff2','.svg':'image/svg+xml'}
// No production server/API proxy: only build-owned code/styles/WASM are served.
export async function runDebugBrowser(spec,{steps=[],scenarios=['normal','empty','failure'],width=432,size='square',signal,artifactDir}={}){
 if(occupied)return {status:'unverified',reason:'debug browser busy',runs:[]}
 occupied=true;let browser,server
 const cancelled=()=>{void browser?.close()}
 try{
  await readFile(resolve(dist,'card-debug.html'))
  server=createServer(async(req,res)=>{
   try{
    const path=decodeURIComponent(new URL(req.url,'http://debug.local').pathname)
    const name=resolve(dist,'.'+path)
    if(req.method!=='GET'||!name.startsWith(dist.endsWith(sep)?dist:dist+sep)||!(path==='/card-debug.html'||/^\/assets\/[\w./-]+$/.test(path))||!mime[extname(name)]){res.writeHead(403);return res.end()}
    res.setHeader('Content-Type',mime[extname(name)])
    res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; connect-src 'self'; img-src data: blob:; font-src 'self' data:; frame-src 'none'; form-action 'none'; base-uri 'none'")
    res.end(await readFile(name))
   }catch{res.writeHead(404);res.end()}
  })
  await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok)})
  const origin=`http://127.0.0.1:${server.address().port}`
  browser=await chromium.launch({channel:'chrome',headless:true,timeout:10000})
  signal?.throwIfAborted();signal?.addEventListener('abort',cancelled,{once:true})
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',acceptDownloads:false,reducedMotion:'reduce'})
  const blocked=[],runs=[]
  await context.route('**/*',route=>{
   const u=new URL(route.request().url())
   if(u.origin===origin&&(u.pathname==='/card-debug.html'||/^\/assets\/[\w./-]+$/.test(u.pathname))&&route.request().method()==='GET')return route.continue()
   blocked.push(u.origin===origin?u.pathname:u.origin);return route.abort()
  })
  const checks=scenarios.map(scenario=>({scenario,width}));if(!checks.some(c=>c.scenario==='normal'&&c.width===320))checks.push({scenario:'normal',width:320});if(!checks.some(c=>c.scenario==='normal'&&c.width===432))checks.push({scenario:'normal',width:432})
  for(const check of checks){
   const {scenario,width}=check
   signal?.throwIfAborted()
   const page=await context.newPage(),pageErrors=[]
   await page.setViewportSize({width,height:900})
   page.setDefaultTimeout(1800);page.on('pageerror',e=>pageErrors.push(e.message))
   page.on('popup',p=>void p.close())
   await page.goto(origin+'/card-debug.html',{waitUntil:'load',timeout:8000})
   await page.waitForFunction(()=>!!window.cardDebug)
   const options={scenario,width,size}
   await page.evaluate(({spec,options})=>window.cardDebug.mount(spec,options),{spec,options})
   await page.waitForFunction(()=>window.cardDebug.ready())
   await page.waitForTimeout(450)
   const settle=()=>page.waitForFunction(()=>![...document.querySelectorAll('.cs-logic')].some(el=>el.getAttribute('aria-busy')==='true'||[...el.querySelectorAll('[role=status]')].some(x=>x.textContent.includes('正在计算'))),null,{timeout:5000})
   await settle()
   const initial=await page.evaluate(()=>window.cardDebug.snapshot()),actions=[]
   // Model steps refer to accessible UI, never JS/expressions/arbitrary selectors.
   const scenarioSteps=steps.filter(s=>(s.scenario||'normal')===scenario)
   // Selection/detail paths only apply to populated data. Empty/error views
   // get their own reachable controls unless explicitly assigned model steps.
   const probes=scenarioSteps.length?scenarioSteps:[...initial.controls.filter(c=>c.role==='button'&&!c.disabled&&c.name&&c.name.length<100).slice(0,2).map(c=>({op:'click',handle:c.handle,name:c.name})),{op:'reload'}]
   for(const step of probes){
    signal?.throwIfAborted();const before=await page.evaluate(()=>window.cardDebug.snapshot())
    try{
     if(step.op==='reload'){
      await page.evaluate(()=>window.cardDebug.save());await page.reload()
      await page.waitForFunction(()=>!!window.cardDebug)
      await page.evaluate(({spec,options})=>window.cardDebug.mount(spec,{...options,restore:true}),{spec,options})
      await page.waitForFunction(()=>window.cardDebug.ready())
     }else{
      let el
      if(step.handle){
       const control=before.controls.find(c=>c.handle===step.handle)
       if(!control||control.disabled)throw Error('test target is absent, hidden or disabled; inspect current controls')
       el=page.locator('.cs-card').locator(`[data-debug-handle=${JSON.stringify(control.handle)}]`)
      }else{
       const card=page.locator('.cs-card')
       el=(step.op==='click'?card.getByRole(step.role||'button',{name:step.name,exact:true}):card.getByLabel(step.name,{exact:true})).filter({visible:true}).nth(step.index??0)
      }
      if(step.op==='click')await el.click()
      if(step.op==='fill')await el.fill(String(step.value))
      if(step.op==='select')await el.selectOption(String(step.value))
     }
     await page.waitForTimeout(160)
     await settle()
     const after=await page.evaluate(()=>window.cardDebug.snapshot())
     actions.push({step,ok:true,errors:after.errors,changed:JSON.stringify([before.state,before.componentState])!==JSON.stringify([after.state,after.componentState])||before.text!==after.text||before.calls.length!==after.calls.length,stateKeysChanged:Object.keys({...before.state,...after.state}).filter(k=>JSON.stringify(before.state?.[k])!==JSON.stringify(after.state?.[k])),componentStateChanged:JSON.stringify(before.componentState)!==JSON.stringify(after.componentState),...(step.op==='reload'?{restored:JSON.stringify([before.state,before.componentState])===JSON.stringify([after.state,after.componentState])}:{})})
    }catch(e){
     signal?.throwIfAborted()
     actions.push({step,ok:false,classification:'test_plan',error:String(e.message).slice(0,300)})
     // Later steps depend on the current path. Do not manufacture cascaded
     // failures such as clicking Back without ever entering a detail view.
     for(const skipped of probes.slice(actions.length))actions.push({step:skipped,ok:false,skipped:true,classification:'test_plan',error:'not run: preceding test step did not execute'})
     break
    }
   }
   const final=await page.evaluate(()=>window.cardDebug.snapshot())
   let screenshot
   if(artifactDir){await mkdir(artifactDir,{recursive:true});screenshot=`${scenario}-${width}.png`;await page.locator('.cs-stage').screenshot({path:resolve(artifactDir,screenshot),timeout:3000}).catch(()=>{screenshot=undefined})}
   runs.push({scenario,width,initial,final,actions,pageErrors,screenshot})
   await page.close()
  }
  return {status:'tested',runs,blockedRequests:[...new Set(blocked)],scope:'mock browser checks; not real data or semantic correctness'}
 }catch(e){signal?.throwIfAborted();return {status:'unverified',reason:String(e.message).slice(0,400),runs:[]}}
 finally{signal?.removeEventListener('abort',cancelled);await browser?.close().catch(()=>{});if(server){server.closeAllConnections();await new Promise(ok=>server.close(ok))}occupied=false}
}
