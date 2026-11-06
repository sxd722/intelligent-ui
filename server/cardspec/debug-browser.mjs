import {createServer} from 'node:http'
import {readFile,mkdir} from 'node:fs/promises'
import {resolve,extname,sep} from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright'
import {buildObservation,observedClickRole,resolveClickStep} from './build-feedback.mjs'
import {assertSnapshot} from '../../shared/cardspec/debug-assertions.mjs'
import {auditLayout} from '../../src/cardspec/layout-audit.js'
import {auditVisuals} from '../../src/cardspec/visual-audit.mjs'
import {WEB_CDNS} from '../../shared/cardspec/web-policy.mjs'
import {installDebugRandom} from './debug-random.mjs'

const dist=fileURLToPath(new URL('../../dist/',import.meta.url))
let occupied=false
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.woff2':'font/woff2','.svg':'image/svg+xml'}
// No production server/API proxy: only build-owned code/styles/WASM are served.
export async function runDebugBrowser(spec,{steps=[],scenarios=['normal','empty','failure'],width=432,size='square',signal,artifactDir,seed=73129,viewports,captureSteps=false}={}){
 if(viewports!==undefined&&(!Array.isArray(viewports)||!viewports.length||viewports.length>6||viewports.some(w=>!Number.isInteger(w)||w<280||w>1440)))throw Error('invalid host QA viewports')
 if(occupied)return {status:'unverified',reason:'debug browser busy',runs:[]}
 occupied=true;let browser,server
 const mockAsset=/^\/api\/media\/[a-f0-9]{64}\.jpg$/.test(spec.context?.designMock?.url||'')?spec.context.designMock.url:null
 const cancelled=()=>{void browser?.close()}
 try{
  await readFile(resolve(dist,'card-debug.html'))
  // Trust the exact build-owned renderer, not model code. Vite's config bundling
  // can change function.toString() bytes, so source-time hashes are insufficient.
  const {sha256:rendererHash}=JSON.parse(await readFile(resolve(dist,'sandbox-renderer-hash.json'),'utf8'))
  if(!/^[A-Za-z0-9+/]{43}=$/.test(rendererHash))throw Error('invalid trusted renderer build hash')
  server=createServer(async(req,res)=>{
   try{
    const path=decodeURIComponent(new URL(req.url,'http://debug.local').pathname)
    if(req.method==='GET'&&path==='/api/health'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({cardSandbox:true,cardWebSandbox:true,debugMock:true}))}
    if(req.method==='GET'&&mockAsset&&path===mockAsset){res.setHeader('Content-Type','image/jpeg');return res.end(await readFile(resolve(dist,'../.cache/images/generated',mockAsset.split('/').at(-1))))}
    const name=resolve(dist,'.'+path)
    if(req.method!=='GET'||!name.startsWith(dist.endsWith(sep)?dist:dist+sep)||!(path==='/card-debug.html'||/^\/assets\/[\w./-]+$/.test(path))||!mime[extname(name)]){res.writeHead(403);return res.end()}
    res.setHeader('Content-Type',mime[extname(name)])
    if(spec.context?.renderMode!=='web')res.setHeader('Content-Security-Policy',`default-src 'none'; script-src 'self' 'wasm-unsafe-eval' 'sha256-${rendererHash}'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; frame-src 'self'; form-action 'none'; base-uri 'none'`)
    res.end(await readFile(name))
   }catch{res.writeHead(404);res.end()}
  })
  await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok)})
  const origin=`http://127.0.0.1:${server.address().port}`
  browser=await chromium.launch({channel:'chrome',headless:true,timeout:10000})
  signal?.throwIfAborted();signal?.addEventListener('abort',cancelled,{once:true})
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',acceptDownloads:false,reducedMotion:'reduce'})
  await context.addInitScript(installDebugRandom,seed)
  const blocked=[],runs=[]
  await context.route('**/*',route=>{
   const u=new URL(route.request().url())
   if(u.origin===origin&&(u.pathname===mockAsset||u.pathname==='/api/health'||u.pathname==='/card-debug.html'||/^\/assets\/[\w./-]+$/.test(u.pathname))&&route.request().method()==='GET')return route.continue()
   // Only the opt-in Web runtime may load public CDN dependencies. Tool/API
   // requests remain mocked/blocked; browser verification never executes CLI.
   if(spec.context?.renderMode==='web'&&WEB_CDNS.includes(u.origin)&&route.request().method()==='GET')return route.continue()
   blocked.push(u.origin===origin?u.pathname:u.origin);return route.abort()
  })
  const checks=viewports?scenarios.flatMap(scenario=>[...new Set(viewports)].map(width=>({scenario,width}))):scenarios.map(scenario=>({scenario,width}));if(!viewports&&!checks.some(c=>c.scenario==='normal'&&c.width===320))checks.push({scenario:'normal',width:320});if(!viewports&&!checks.some(c=>c.scenario==='normal'&&c.width===432))checks.push({scenario:'normal',width:432})
  for(const check of checks){
   const {scenario,width}=check
   signal?.throwIfAborted()
   const page=await context.newPage(),pageErrors=[]
   await page.setViewportSize({width,height:900})
   page.setDefaultTimeout(1800);page.on('pageerror',e=>pageErrors.push(e.message))
   page.on('console',m=>{if(m.type()==='error'&&/Content Security Policy|Refused to execute inline script|Executing inline script violates/.test(m.text()))pageErrors.push(m.text().slice(0,800))})
   page.on('popup',p=>void p.close())
   await page.goto(origin+'/card-debug.html',{waitUntil:'load',timeout:8000})
   await page.waitForFunction(()=>!!window.cardDebug)
   const options={scenario,width,size}
   await page.evaluate(({spec,options})=>window.cardDebug.mount(spec,options),{spec,options})
   await page.waitForFunction(()=>window.cardDebug.ready())
   await page.waitForTimeout(450)
   const settle=async()=>{
    await page.waitForFunction(()=>![...document.querySelectorAll('.cs-logic')].some(el=>el.getAttribute('aria-busy')==='true'||[...el.querySelectorAll('[role=status]')].some(x=>x.textContent.includes('正在计算'))),null,{timeout:5000})
    await page.waitForFunction(()=>[...document.querySelectorAll('.cs-sandbox')].every(el=>{const r=el.getBoundingClientRect();return !r.height||r.bottom<=0||r.top>=innerHeight||!el.querySelector('iframe')||el.getAttribute('data-sandbox-ready')==='true'||el.querySelector('[role=alert]')}),null,{timeout:11000})
   }
   await settle()
   // Read and operate only sandbox frames belonging to this card, using the
   // same accessible names as native controls. Never execute model test JS.
   const frameOwners=new WeakMap()
   const sandboxFrames=async()=>{const frames=[];for(const el of await page.locator('.cs-card .cs-sandbox iframe').filter({visible:true}).all()){const frame=await el.contentFrame();if(frame){frameOwners.set(frame,await el.evaluate(e=>e.closest('[data-cs-node]')?.getAttribute('data-cs-node')||''));frames.push(frame)}}return frames}
   const snapshot=async()=>{
    const value=await page.evaluate(()=>window.cardDebug.snapshot())
    value.visuals=[{owner:'',...await page.locator('.cs-card').evaluate(auditVisuals)}]
    for(const frame of await sandboxFrames()){
     try{
      const text=await frame.locator('body').innerText({timeout:1200});value.text=(value.text+'\n'+text).slice(0,9000)
      value.visuals.push({owner:frameOwners.get(frame)||'',...await frame.locator('html').evaluate(auditVisuals)})
      if(spec.context?.renderMode==='web'){
       const layout=await frame.locator('html').evaluate(auditLayout,{allowCssScroll:true})
       if(value.layout)value.layout.issues.push(...layout.issues.map(issue=>({...issue,webFrame:true,element:frameOwners.get(frame)?frameOwners.get(frame)+' / iframe / '+issue.element:issue.element})))
      }
      value.visualCount+=await frame.locator('svg,canvas,progress,meter,[role=progressbar],[role=meter]').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().width&&n.getBoundingClientRect().height).length)
      const controls=[]
      for(const el of (await frame.locator('button,input,select,textarea,[role=button],[role=tab],[role=checkbox],[role=slider]').filter({visible:true}).all()).slice(0,16)){
       const aria=await el.ariaSnapshot(),match=aria.match(/^- (button|tab|checkbox|radio|switch|slider|textbox|combobox)(?: ("(?:[^"\\]|\\.)*"))?/)
       if(!match?.[2])continue
       const values=await el.evaluate(n=>({disabled:!!n.disabled||n.getAttribute('aria-disabled')==='true',value:n.value,min:n.getAttribute('min'),max:n.getAttribute('max'),step:n.getAttribute('step'),checked:n.checked}))
       const owner=frameOwners.get(frame)||'',handle='sandbox:'+encodeURIComponent(owner)+':'+controls.length
       await el.evaluate((node,handle)=>node.setAttribute('data-debug-handle',handle),handle)
       controls.push({role:match[1],name:JSON.parse(match[2]),sandbox:true,owner,handle,...values})
      }
      value.controls.push(...controls)
      if(text.trim()||controls.length||value.visualCount)value.empty=false
     }catch{/* A removed frame will be represented by the host error/status. */}
    }
    return value
   }
   const initial=await snapshot(),actions=[]
   // Model steps refer to accessible UI, never JS/expressions/arbitrary selectors.
   const scenarioSteps=steps.filter(s=>(s.scenario||'normal')===scenario)
   // Selection/detail paths only apply to populated data. Empty/error views
   // get their own reachable controls unless explicitly assigned model steps.
   const probes=scenarioSteps.length?scenarioSteps:[...initial.controls.filter(c=>c.role==='button'&&!c.disabled&&c.name&&c.name.length<100).slice(0,2).map(c=>({op:'click',handle:c.handle,name:c.name})),{op:'reload'}]
   for(const requestedStep of probes){
    signal?.throwIfAborted();const before=await snapshot();const step=resolveClickStep(requestedStep,before.controls);let restoredState
    try{
     if(step.op==='reload'){
      await page.evaluate(()=>window.cardDebug.save());await page.reload()
      await page.waitForFunction(()=>!!window.cardDebug)
      await page.evaluate(({spec,options})=>window.cardDebug.mount(spec,{...options,restore:true}),{spec,options})
      await page.waitForFunction(()=>window.cardDebug.ready())
      // Verify the persisted host state at remount, before resumed timers are
      // allowed to advance it. waitMs later observes legitimate autonomous work.
      restoredState=await page.evaluate(()=>{const s=window.cardDebug.snapshot();return [s.state,s.componentState]})
     }else if(step.op!=='check'){
      let el
      if(step.handle){
       const control=before.controls.find(c=>c.handle===step.handle)
       if(!control||control.disabled)throw Error('test target is absent, hidden or disabled; inspect current controls')
       const scope=control.sandbox?(await sandboxFrames()).find(f=>frameOwners.get(f)===control.owner):page.locator('.cs-tool-card')
       if(!scope)throw Error('sandbox test target is not visible; inspect current controls')
       el=scope.locator(`[data-debug-handle=${JSON.stringify(control.handle)}]`)
      }else{
       const card=page.locator('.cs-tool-card')
       const role=observedClickRole(step,before.controls)
       el=(step.op==='click'?card.getByRole(role,{name:step.name,exact:true}):card.getByLabel(step.name,{exact:true})).filter({visible:true}).nth(step.index??0)
       if(!await el.count()){
        for(const frame of await sandboxFrames()){
         const candidate=(step.op==='click'?frame.getByRole(role,{name:step.name,exact:true}):frame.getByLabel(step.name,{exact:true})).filter({visible:true}).nth(step.index??0)
         if(await candidate.count()){el=candidate;break}
        }
       }
      }
      if(step.op==='click')await el.click()
      if(step.op==='fill'){
       if(await el.getAttribute('type')==='range'){
        const min=Number(await el.getAttribute('min')??0),max=Number(await el.getAttribute('max')??100),inc=Number(await el.getAttribute('step')||1),target=Number(step.value),ticks=Math.round((target-min)/inc)
        if(!Number.isFinite(target)||target<min||target>max||!Number.isFinite(ticks)||ticks<0||ticks>1000)throw Error('range test value out of bounds')
        // Its accessible label may include the live value. Home changes that
        // label, so keep this actual input instead of resolving a stale name.
        const range=await el.elementHandle()
        if(!range)throw Error('range control disappeared')
        try{await range.focus();await range.press('Home');for(let i=0;i<ticks;i++)await range.press('ArrowRight')}finally{await range.dispose()}
       }else await el.fill(String(step.value))
      }
      if(step.op==='select')await el.selectOption(String(step.value))
     }
     await page.waitForTimeout(160+(step.waitMs||0))
     await settle()
     const after=await snapshot()
     if(captureSteps&&artifactDir){await mkdir(artifactDir,{recursive:true});await page.locator('.cs-stage').screenshot({path:resolve(artifactDir,`${scenario}-${width}-step-${actions.length+1}.png`),timeout:3000}).catch(()=>{})}
     actions.push({step,ok:true,visuals:after.visuals,observed:buildObservation(after),assertion:assertSnapshot(step.expect,before,after),errors:after.errors,errorDetails:after.errorDetails,layoutIssues:after.layout?.issues||[],changed:JSON.stringify([before.state,before.componentState])!==JSON.stringify([after.state,after.componentState])||before.text!==after.text||before.calls.length!==after.calls.length,stateKeysChanged:Object.keys({...before.state,...after.state}).filter(k=>JSON.stringify(before.state?.[k])!==JSON.stringify(after.state?.[k])),componentStateChanged:JSON.stringify(before.componentState)!==JSON.stringify(after.componentState),...(step.op==='reload'?{restored:JSON.stringify([before.state,before.componentState])===JSON.stringify(restoredState),resumedStateChanged:JSON.stringify(restoredState)!==JSON.stringify([after.state,after.componentState])}:{})})
    }catch(e){
     signal?.throwIfAborted()
     actions.push({step,ok:false,classification:'test_plan',observed:buildObservation(before),error:String(e.message).slice(0,300)})
     // Later steps depend on the current path. Do not manufacture cascaded
     // failures such as clicking Back without ever entering a detail view.
     for(const skipped of probes.slice(actions.length))actions.push({step:skipped,ok:false,skipped:true,classification:'test_plan',error:'not run: preceding test step did not execute'})
     break
    }
   }
   const final=await snapshot()
   let screenshot
   if(artifactDir){await mkdir(artifactDir,{recursive:true});screenshot=`${scenario}-${width}.png`;await page.locator('.cs-stage').screenshot({path:resolve(artifactDir,screenshot),timeout:3000}).catch(()=>{screenshot=undefined})}
   runs.push({scenario,width,seed,initial,final,actions,pageErrors,screenshot})
   await page.close()
  }
  return {status:'tested',seed,runs,blockedRequests:[...new Set(blocked)],scope:'seeded mock browser checks; not real data, all random paths or semantic correctness'}
 }catch(e){signal?.throwIfAborted();return {status:'unverified',reason:String(e.message).slice(0,400),runs:[]}}
 finally{signal?.removeEventListener('abort',cancelled);await browser?.close().catch(()=>{});if(server){server.closeAllConnections();await new Promise(ok=>server.close(ok))}occupied=false}
}
