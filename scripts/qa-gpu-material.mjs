import {chromium} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const out='artifacts/webgpu-material';await mkdir(out,{recursive:true})
// Dedicated test browser; never attaches to or closes Owl/OpenCLI.
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']})
const page=await browser.newPage({viewport:{width:900,height:900}}),report=[]
try{
 for(const fixture of ['gpuPearl','gpuWave','gpuFailure']){
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto('http://127.0.0.1:8787/cardspec-lab.html?fixture='+fixture)
  const material=page.locator('.cs-gpu-material');await material.scrollIntoViewIfNeeded()
  await page.waitForFunction(()=>['ready','fallback'].includes(document.querySelector('.cs-gpu-material')?.dataset.gpuStatus),null,{timeout:30000})
  const status=await material.getAttribute('data-gpu-status')
  const reason=await material.locator('figcaption').getAttribute('title').catch(()=>'')
  if(fixture!=='gpuFailure')assert.equal(status,'ready',reason)
  else assert.equal(status,'fallback')
  await page.getByLabel('卡片动效').selectOption('off')
  for(const width of ['320','360','432']){
   await page.getByLabel('宽度',{exact:true}).selectOption(width)
   const slider=page.getByRole('slider');await slider.focus();await slider.press('ArrowRight');await page.waitForTimeout(200)
   const params=await material.locator('canvas').getAttribute('data-params')
   if(status==='ready')assert.ok(JSON.parse(params)[0]>0)
   const box=await material.boundingBox();assert.ok(box.height>=96&&box.width<=Number(width))
   await page.locator('.cs-card').screenshot({path:`${out}/${fixture}-${width}.png`})
   report.push({fixture,width,status,reason,params,box,errors})
  }
  if(status==='ready'){
   await material.locator('canvas').evaluate(el=>el.dataset.identity='retained')
   await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await page.waitForTimeout(200)
   await material.scrollIntoViewIfNeeded();assert.equal(await material.locator('canvas').getAttribute('data-identity'),'retained')
  }
 }
 const noGpu=await browser.newPage();await noGpu.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined}))
 await noGpu.goto('http://127.0.0.1:8787/cardspec-lab.html?fixture=gpuPearl');await noGpu.locator('.cs-gpu-material').scrollIntoViewIfNeeded()
 await noGpu.waitForSelector('[data-gpu-status=fallback]');await noGpu.getByRole('slider').press('ArrowRight');report.push({scenario:'no-webgpu',status:'fallback',controls:'operable'})
}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close()}
console.log(JSON.stringify(report.map(({fixture,width,status})=>({fixture,width,status}))))
