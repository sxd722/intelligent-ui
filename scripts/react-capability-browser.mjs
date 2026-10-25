import {chromium} from '@playwright/test'
import {getQuickJS} from 'quickjs-emscripten'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createSandboxVM} from '../shared/cardspec/sandbox-engine.mjs'
import {sandboxDocument} from '../src/cardspec/sandbox-document.mjs'
import {cases} from './react-capability-cases.mjs'
const dir='artifacts/react-capability-20261020'
await mkdir(dir+'/screens',{recursive:true})
const records=JSON.parse(await readFile(dir+'/rechecked.json','utf8')),Q=await getQuickJS()
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[]
for(const row of records){
 // Render original output only: no repaired sample selection bias.
 const a=row.attempts[0],c=cases.find(c=>c.id===row.case)
 if(!(a.recheck||a.check).render)continue
 let vm
 const page=await browser.newPage({viewport:{width:432,height:500}})
 try{
  vm=createSandboxVM(Q,{code:a.module.code,input:c.data,state:c.initial})
  let snapshot=vm.snapshot()
  await page.exposeFunction('advanceSurface',payload=>{snapshot=vm.event(payload.handler,payload.event);return snapshot})
  await page.setContent('<style>body{margin:0;background:#e6eaf0}iframe{display:block;border:0;margin:12px;width:calc(100% - 24px);height:320px;border-radius:16px;background:#f5f8fb}</style><iframe sandbox="allow-scripts"></iframe>')
  await page.evaluate(({html,snapshot})=>{
   window.sample=snapshot
   addEventListener('message',async e=>{
    if(e.source!==document.querySelector('iframe').contentWindow||e.data?.sandbox!=='qa')return
    if(e.data.type==='event')window.sample=await window.advanceSurface(e.data)
    if(e.data.type==='ready'||e.data.type==='event')e.source.postMessage({sandbox:'qa',type:'render',...window.sample},'*')
   })
   document.querySelector('iframe').srcdoc=html
  },{html:sandboxDocument(a.module.css,'qa'),snapshot})
  const f=page.frameLocator('iframe')
  await f.locator('#root > *').first().waitFor()
  const metrics=[]
  for(const width of [320,360,432]){
   await page.setViewportSize({width,height:500})
   await page.waitForTimeout(50)
   metrics.push(await f.locator('body').evaluate(el=>({width:innerWidth,height:innerHeight,scrollWidth:el.scrollWidth,scrollHeight:el.scrollHeight,horizontal:el.scrollWidth>innerWidth+1,vertical:el.scrollHeight>innerHeight+1,unlabelledInputs:[...document.querySelectorAll('input')].filter(n=>!n.labels?.length&&!n.getAttribute('aria-label')&&!n.getAttribute('aria-labelledby')).length})))
  }
  let realClick=null
  if(row.case==='energy'){
   await f.getByRole('button',{name:'推进一步',exact:true}).click()
   await page.waitForFunction(()=>window.sample.state.energy===50)
   realClick=true
  }
  await page.setViewportSize({width:360,height:500})
  await page.locator('iframe').screenshot({path:dir+'/screens/'+row.id+'.png'})
  results.push({id:row.id,metrics,realClick})
 }catch(e){results.push({id:row.id,error:e.message})}finally{vm?.dispose();await page.close()}
}
await browser.close();await writeFile(dir+'/browser.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results.map(r=>({id:r.id,horizontal:r.metrics?.some(m=>m.horizontal),vertical:r.metrics?.some(m=>m.vertical),error:r.error}))))
