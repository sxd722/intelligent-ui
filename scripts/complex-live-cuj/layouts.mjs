import {chromium} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import {ROOT} from './cases.mjs'
await mkdir(ROOT+'/screenshots',{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true}),results=[]
const measure=page=>page.evaluate(()=>{const stage=document.querySelector('.cs-stage'),card=document.querySelector('.cs-card');if(!stage||!card)return null;const box=card.getBoundingClientRect();return {at:performance.now(),height:stage.getBoundingClientRect().height,mainVisiblePx:box.height,horizontalOverflow:Math.max(0,card.scrollWidth-card.clientWidth),pages:document.querySelectorAll('[aria-label^="卡片页面：第"]').length,scroll:[...card.querySelectorAll('[data-overflow],.cs-region-body')].filter(e=>e.clientHeight).map(e=>({label:e.getAttribute('aria-label'),client:e.clientHeight,scroll:e.scrollHeight,policy:e.getAttribute('data-overflow')})),clippedControls:[...card.querySelectorAll('button,input,select')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.bottom>box.bottom+1||r.top<box.top-1)}).map(e=>e.getAttribute('aria-label')||e.closest('label')?.innerText||e.innerText).slice(0,12)}})
try{for(const id of ['trip','movie-candidate','sentiment']){
 const page=await browser.newPage({viewport:{width:900,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8787/complex-live-cuj/viewer.html?id='+id);await page.waitForFunction(()=>window.qaSession)
 for(const width of [320,360,432])for(const size of ['square','auto']){
  await page.getByLabel('验收宽度').selectOption(String(width));await page.getByLabel('验收尺寸').selectOption(size);await page.waitForTimeout(400);const samples=[]
  for(let n=0;n<21;n++){samples.push(await measure(page));if(n<20)await page.waitForTimeout(100)}
  const screenshot=`screenshots/${id}-${width}-${size}.png`;await page.screenshot({path:ROOT+'/'+screenshot})
  results.push({id,width,size,screenshot,samples,stable:Math.max(...samples.map(s=>s.height))-Math.min(...samples.map(s=>s.height))<=1&&new Set(samples.map(s=>s.pages)).size===1,horizontalOverflow:Math.max(...samples.map(s=>s.horizontalOverflow)),errors:[...errors],scope:id==='movie-candidate'?'Rejected candidate only':'Generated card; initial layout only'})
 }
 await page.close()
}}finally{await browser.close()}
await writeFile(ROOT+'/layouts.json',JSON.stringify(results,null,2));console.log(JSON.stringify({total:results.length,stable:results.filter(r=>r.stable).length,overflow:results.filter(r=>r.horizontalOverflow>2).map(r=>({id:r.id,width:r.width,size:r.size}))}))
