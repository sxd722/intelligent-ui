import {chromium} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const base=process.env.CLOUD_DESIGN_URL||'http://127.0.0.1:8792',out=process.env.CLOUD_DESIGN_OUT||'artifacts/cloud-design/preview'
await mkdir(out,{recursive:true})
const results=[]
const health=await(await fetch(base+'/api/health')).json()
assert.equal(health.photosEnabled,true);assert.equal(health.toolsEnabled,false);assert.equal(health.designs.length,4)
const resourceResponse=await fetch(base+'/api/photo?query=forest%20lake&role=background')
assert.equal(resourceResponse.status,200);const resource=await resourceResponse.json()
assert.equal(resource.provider,'Pexels');assert.ok(resource.photographer);assert.ok(resource.url.startsWith('/api/media?'))
const media=await fetch(base+resource.url);assert.equal(media.status,200);assert.match(media.headers.get('content-type'),/^image\//)
const cachedMedia=await fetch(base+resource.url);assert.equal(cachedMedia.status,200);await cachedMedia.arrayBuffer()
results.push({case:'actual Worker Pexels search and same-origin image',passed:true,photographer:resource.photographer,bytes:(await media.arrayBuffer()).byteLength})
const browser=await chromium.launch({channel:'chrome',headless:true});let currentPage;const network=[]
try{
 const page=await browser.newPage({viewport:{width:1100,height:1050}}),errors=[];currentPage=page
 page.on('response',r=>{if(r.url().includes('/api/'))network.push({url:r.url(),status:r.status()})});page.on('console',m=>{if(m.type()==='error')network.push({console:m.text()})})
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000)
 await page.goto(base+'/cardspec-lab.html?fixture=counter')
 const source='<card design="friendly" visualStyle="frosted-glass" backgroundQuery="forest lake"><state id="n" type="number" initial={1}/><title>周末，换个节奏</title><image id="lake" query="forest lake" mediaRole="hero" alt="湖泊示意素材"/><stat label="计划步行（公里）" value={state.n}/><button variant="primary" onPress="add">再走一公里</button><caption>摄影为场景示意，路线由你决定。</caption><action id="add"><set target="n" value={state.n+1}/></action></card>'
 await page.getByText('输入 DSL 验证',{exact:true}).click();await page.getByLabel('DSL源码').fill(source);await page.getByRole('button',{name:'应用源码',exact:true}).click()
 await page.getByLabel('图片',{exact:true}).selectOption('pexels')
 await page.locator('.cs-background[data-status=loaded]').waitFor()
 await page.waitForFunction(()=>[...document.querySelectorAll('.cs-image img')].some(img=>img.complete&&img.naturalWidth>0))
 await page.getByRole('button',{name:'再走一公里',exact:true}).click()
 assert.equal(await page.locator('.cs-stat strong').innerText(),'2')
 for(const design of ['atmospheric','friendly','cinematic','editorial']){
  await page.getByLabel('设计配方',{exact:true}).selectOption(design)
  for(const size of ['square','auto'])for(const width of ['320','360','432']){
   await page.getByLabel('卡片尺寸',{exact:true}).selectOption(size);await page.getByLabel('宽度',{exact:true}).selectOption(width)
   await page.waitForFunction(()=>{const el=document.querySelector('.cs-stage');return el?.dataset.csFit==='fit'})
   assert.ok(await page.locator('.cs-stage').evaluate(el=>el.scrollWidth<=el.clientWidth+1))
   assert.equal(await page.locator('.cs-stat strong').innerText(),'2')
  }
  await page.getByLabel('卡片尺寸',{exact:true}).selectOption('square')
  await page.locator('.cs-shell').screenshot({path:`${out}/${design}.png`})
 }
 assert.equal(await page.locator('[data-cs-error]').count(),0);assert.deepEqual(errors,[])
 assert.ok((await page.locator('.cs-background-credit').innerText()).includes('Pexels'))
 results.push({case:'real background + content photos; 4 recipes × 3 widths × 2 sizes; retained interaction',passed:true})
}catch(e){results.push({passed:false,error:e.stack,network});if(currentPage){await currentPage.screenshot({path:out+'/failure.png',fullPage:true});await writeFile(out+'/failure.txt',await currentPage.locator('body').innerText())};process.exitCode=1}
finally{await browser.close();await writeFile(out+'/results.json',JSON.stringify(results,null,2))}
console.log(JSON.stringify(results))
