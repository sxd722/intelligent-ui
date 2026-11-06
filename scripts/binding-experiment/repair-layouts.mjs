import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {chromium} from '@playwright/test'
const root='artifacts/tool-binding-repair-20261103',dest='tool-binding-repair-regression'
await mkdir(root+'/layouts',{recursive:true})
const results=JSON.parse(await readFile(root+'/regression/results.json','utf8')).filter(r=>r.arm==='A2S'&&r.complete)
const jobs=results.flatMap(r=>[320,360,432].flatMap(width=>['square','auto'].map(size=>({r,width,size})))),layouts=[]
const browser=await chromium.launch({channel:'chrome',headless:true})
const observe=async page=>page.evaluate(()=>{
 const card=document.querySelector('.cs-card'),stage=document.querySelector('.cs-stage'),box=card.getBoundingClientRect()
 return {at:performance.now(),stageHeight:stage.getBoundingClientRect().height,mainVisiblePx:box.height,horizontalOverflow:Math.max(0,card.scrollWidth-card.clientWidth),pages:document.querySelectorAll('[aria-label^="卡片页面：第"]').length,inner:[...card.querySelectorAll('.cs-region-body')].filter(e=>e.clientHeight>0).map(e=>({visible:e.clientHeight,content:e.scrollHeight})),buttons:[...card.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().height>0).length}
})
try{await Promise.all(Array.from({length:3},async()=>{while(jobs.length){
 const {r,width,size}=jobs.shift(),page=await browser.newPage({viewport:{width:width+40,height:950}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',route=>route.abort())
 const record={id:r.id,width,size,scope:'Initial layout/stability, not a repeated full task test'}
 try{
  await page.goto(`http://127.0.0.1:8787/${dest}/viewer.html?id=${r.id}&width=${width}&size=${size}`);await page.waitForFunction(()=>window.qaSession);await page.waitForTimeout(500)
  const samples=[];for(let n=0;n<21;n++){samples.push(await observe(page));if(n<20)await page.waitForTimeout(100)}
  record.samples=samples;record.horizontalOverflow=Math.max(...samples.map(s=>s.horizontalOverflow));record.stable=Math.max(...samples.map(s=>s.stageHeight))-Math.min(...samples.map(s=>s.stageHeight))<=1&&new Set(samples.map(s=>s.pages)).size===1
  record.hasVisibleControl=await page.locator('.cs-card button:visible').count()>0
  record.errors=errors;record.passed=record.stable&&record.horizontalOverflow<=2&&!errors.length
  record.screenshot=`layouts/${r.id}-${width}-${size}.png`;await page.screenshot({path:root+'/'+record.screenshot})
 }catch(e){record.passed=false;record.error=e.message}
 layouts.push(record);await page.close()
}}))}finally{await browser.close()}
await writeFile(root+'/layouts.json',JSON.stringify(layouts,null,2))
console.log(JSON.stringify({layouts:layouts.length,passed:layouts.filter(l=>l.passed).length,failed:layouts.filter(l=>!l.passed).map(({id,width,size,error,horizontalOverflow,stable})=>({id,width,size,error,horizontalOverflow,stable}))}))
