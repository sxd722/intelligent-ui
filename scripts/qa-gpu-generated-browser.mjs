import {PNG} from 'pngjs'
const pixelDifference=(a,b)=>{a=PNG.sync.read(a);b=PNG.sync.read(b);if(a.width!==b.width||a.height!==b.height)return Infinity;let sum=0;for(let i=0;i<a.data.length;i++)sum+=Math.abs(a.data[i]-b.data[i]);return sum/a.data.length}
import {chromium} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const dir='artifacts/webgpu-material',spec=JSON.parse(await readFile(dir+'/generated-spec.json','utf8'))
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']}),page=await browser.newPage({viewport:{width:900,height:900}}),report=[]
try{
 for(const size of ['square','auto'])for(const width of [320,360,432]){
  await page.goto('http://127.0.0.1:8787/card-debug.html');await page.waitForFunction(()=>window.cardDebug)
  await page.evaluate(({spec,width,size})=>window.cardDebug.mount(spec,{width,size}),{spec,width,size})
  await page.waitForSelector('[data-gpu-status=ready]',{timeout:20000})
  const slider=page.getByRole('slider').first(),canvas=page.locator('.cs-gpu-material canvas')
  await page.getByRole('switch').uncheck();await page.waitForTimeout(200)
  await page.waitForTimeout(1000); const still=await canvas.screenshot();await page.waitForTimeout(500);const second=await canvas.screenshot();await writeFile(dir+'/still-a.png',still);await writeFile(dir+'/still-b.png',second);assert.ok(pixelDifference(still,second)<0.01,'animation off must hold pixels stable (1-level compositing dither allowed)')
  const before=await canvas.getAttribute('data-params');await slider.focus();await slider.press('ArrowRight');await page.waitForTimeout(300)
  const after=await canvas.getAttribute('data-params');assert.notEqual(before,after)
  assert.ok(pixelDifference(still,await canvas.screenshot())>0.1,'slider must change actual GPU pixels, not only metadata')
  const snapshot=await page.evaluate(()=>window.cardDebug.snapshot());assert.deepEqual(snapshot.errors,[]);assert.equal(snapshot.horizontalOverflow,false)
  await page.locator('.cs-card').screenshot({path:`${dir}/generated-${width}-${size}.png`})
  await page.evaluate(()=>window.cardDebug.save());await page.reload();await page.waitForFunction(()=>window.cardDebug)
  await page.evaluate(({spec,width,size})=>window.cardDebug.mount(spec,{width,size,restore:true}),{spec,width,size});await page.waitForSelector('[data-gpu-status=ready]')
  const restored=await page.evaluate(()=>window.cardDebug.snapshot());assert.deepEqual(restored.state,snapshot.state)
  report.push({width,size,before,after,state:snapshot.state,restored:restored.state,layout:snapshot.layout})
 }
}finally{await writeFile(dir+'/generated-browser.json',JSON.stringify(report,null,2));await browser.close()}
console.log('Generated card: six viewports, parameter feedback and refresh restoration passed')
