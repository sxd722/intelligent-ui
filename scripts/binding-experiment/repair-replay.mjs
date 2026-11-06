import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {build} from 'esbuild'
import {chromium} from '@playwright/test'
import {S2_CASES,compile} from './s2-engine.mjs'
import {inspectS2} from './s2-browser.mjs'
const root='artifacts/tool-binding-repair-20261103',dest='dist/tool-binding-repair-regression'
process.env.S2_DEST=dest
await mkdir(root+'/replay',{recursive:true})
await build({entryPoints:['scripts/binding-experiment/s2-viewer.jsx'],bundle:true,format:'esm',platform:'browser',outfile:dest+'/viewer.js',define:{'process.env.NODE_ENV':'"production"'},loader:{'.woff2':'file','.ttf':'file','.woff':'file','.png':'file'},logLevel:'error'})
const results=JSON.parse(await readFile(root+'/regression/results.json','utf8')),old=JSON.parse(await readFile('artifacts/tooling-p0p1-20261103/regression/results.json','utf8'))
const browser=await chromium.launch({channel:'chrome',headless:true}),replayed=[],oldReplay=[],extra=[]
try{
 const jobs=results.filter(r=>r.arm==='A2S')
 await Promise.all(Array.from({length:2},async()=>{while(jobs.length){const r=jobs.shift();if(!r.complete){replayed.push({id:r.id,passed:false,reason:'Compilation failed'});continue}const v=await inspectS2(browser,S2_CASES.find(c=>c.id===r.case),r,{dir:root+'/replay'});replayed.push(v);console.log(JSON.stringify({replay:r.id,passed:v.passed}))}}))
 for(const id of ['06-cars','B04','19-write','B08']){
  const prev=old.find(r=>r.case===id&&r.arm==='A2S'),c=S2_CASES.find(c=>c.id===id),compiled=compile(c,'A2S',prev.source),r={...prev,id:'old-'+prev.id,spec:compiled.spec}
  await writeFile(dest+'/runs/'+r.id+'.json',JSON.stringify(r))
  oldReplay.push({id:r.id,compiled:compiled.complete,diagnostics:compiled.diagnostics,browser:compiled.complete?await inspectS2(browser,c,r,{dir:root+'/replay'}):null})
 }
 for(const r of results.filter(r=>r.arm==='A2S'&&S2_CASES.find(c=>c.id===r.case).write&&r.complete)){
  const page=await browser.newPage();await page.route('**/api/**',route=>route.abort())
  try{
   await page.goto(`http://127.0.0.1:8787/tool-binding-repair-regression/viewer.html?id=${r.id}&fault=error`);await page.waitForFunction(()=>window.qaSession)
   const initial=await page.evaluate(()=>window.qaCalls.length);await page.locator('[data-cs-on-press="refresh_s0"]').click();await page.waitForTimeout(150)
   const after=await page.evaluate(()=>({calls:window.qaCalls.length,status:window.qaSession.current().bindings.s0.status,error:window.qaSession.current().bindings.s0.error,text:document.querySelector('.cs-shell').innerText}))
   await page.screenshot({path:root+'/replay/'+r.id+'-error.png'});await page.reload();await page.waitForFunction(()=>window.qaSession);await page.waitForTimeout(150)
   const replayCalls=await page.evaluate(()=>window.qaCalls.length)
   extra.push({id:r.id,check:'write failure stays failure and refresh never replays',passed:initial===0&&after.calls===1&&after.status==='error'&&!/已暂停|状态：paused/.test(after.text)&&replayCalls===0,initial,after,replayCalls,screenshot:'replay/'+r.id+'-error.png'})
  }catch(e){extra.push({id:r.id,passed:false,error:e.message})}finally{await page.close()}
 }
 const r=results.find(r=>r.case==='18-static'&&r.arm==='A2S')
 if(r?.complete){
  const page=await browser.newPage();await page.goto(`http://127.0.0.1:8787/tool-binding-repair-regression/viewer.html?id=${r.id}`);await page.waitForFunction(()=>window.qaSession);await page.waitForTimeout(300)
  await page.getByRole('button',{name:'切换颜色',exact:true}).click();await page.waitForTimeout(60)
  const animations=await page.evaluate(()=>document.getAnimations().map(a=>({target:a.effect?.target?.dataset?.csNode,frames:a.effect?.getKeyframes?.().map(f=>({transform:f.transform,opacity:f.opacity}))})))
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);await page.getByRole('button',{name:'切换颜色',exact:true}).click()
  const reduced=await page.evaluate(()=>({text:document.querySelector('.cs-card').innerText,animations:document.getAnimations().length}))
  extra.push({id:r.id,check:'region motion reaches Web Animations and reduced motion preserves action',passed:animations.some(a=>a.target)&&reduced.animations===0,animations,reduced,scope:'Interaction transition; continuous breathing is not proven by this probe'})
  await page.close()
 }
}finally{await browser.close()}
await writeFile(root+'/replayed.json',JSON.stringify(replayed,null,2));await writeFile(root+'/old-replayed.json',JSON.stringify(oldReplay,null,2));await writeFile(root+'/supplementary.json',JSON.stringify({replay:{passed:replayed.filter(r=>r.passed).length,total:replayed.length},oldReplay:oldReplay.map(r=>({id:r.id,compiled:r.compiled,passed:!!r.browser?.passed})),extra},null,2))
