// Isolated browser, no OpenCLI/tools/model calls; exercises the production host.
import {chromium,expect} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import {GRAPHICS_CARD} from '../shared/cardspec/graphics-fixture.mjs'
const result=compileCard(GRAPHICS_CARD,{final:true,cardId:'graphics-qa-v1',context:{renderMode:'hybrid'}})
await validateRichContent(result);if(!result.complete)throw Error(JSON.stringify(result.diagnostics))
const dir='artifacts/graphics-qa';await mkdir(dir,{recursive:true})
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[]
try{
 const page=await browser.newPage({viewport:{width:432,height:900}})
 const requests=[];page.on('request',r=>{if(r.url().includes('/api/tools/invoke')||r.url().includes('/api/chat'))requests.push(r.url())})
 await page.addInitScript(spec=>{
  if(window!==top)return
  localStorage.setItem('cardspec:render-mode:v1','hybrid')
  if(!sessionStorage.getItem('cardspec:conversation:v1'))sessionStorage.setItem('cardspec:conversation:v1',JSON.stringify({messages:[{id:'graphics',role:'assistant',status:'succeeded',format:'cardspec',phases:[{id:'visual',kind:'cardspec',phase:'dsl',status:'succeeded',message:{status:'succeeded',metadata:{format:'cardspec',card_spec:spec}}}]}],toolsEnabled:false}))
 },result.spec)
 await page.goto('http://127.0.0.1:8787/')
 const frame=page.frameLocator('iframe[title="原创能量图"]'),stage=page.locator('.cs-stage').first()
 await expect(frame.locator('svg')).toBeVisible({timeout:15000})
 await stage.getByRole('slider').fill('70');await expect(frame.locator('text')).toHaveText('70%');checks.push('SVG updates from native slider')
 await stage.screenshot({path:dir+'/svg.png'})
 await stage.getByRole('radio',{name:'Canvas',exact:true}).click()
 const canvas=frame.locator('canvas');await expect(canvas).toBeVisible()
 const pixel=await canvas.evaluate(c=>Array.from(c.getContext('2d').getImageData(17,28,1,1).data));if(pixel[3]<200)throw Error('Canvas bitmap is empty')
 await canvas.click({position:{x:80,y:80}});await expect(stage.getByRole('slider')).not.toHaveValue('70');checks.push('Canvas paints pixels and updates native state')
 const value=await stage.getByRole('slider').inputValue()
 await page.reload();await expect(canvas).toBeVisible();await expect(stage.getByRole('slider')).toHaveValue(value);checks.push('page restore retains mode and state')
 for(const width of [320,360,432]){
  await page.setViewportSize({width,height:900})
  await expect(canvas).toBeVisible()
  if(!await frame.locator('body').evaluate(e=>e.scrollWidth<=e.clientWidth+1))throw Error('Graphic overflow at '+width)
 }
 await page.emulateMedia({reducedMotion:'reduce'})
 await expect(canvas).toHaveCSS('animation-name','none');checks.push('320/360/432 fit and reduced motion')
 await page.emulateMedia({reducedMotion:'no-preference'})
 await stage.getByLabel('视图选项').click();await stage.getByRole('button',{name:'暂停动效',exact:true}).click()
 await expect(canvas).toHaveCSS('animation-play-state','paused');checks.push('host pause controls Canvas CSS animation')
 await stage.screenshot({path:dir+'/canvas.png'})
 if(requests.length)throw Error('Unexpected tool/model calls');checks.push('zero tool/model calls during interaction and restore')
 await writeFile(dir+'/result.json',JSON.stringify({passed:true,checks,pixel},null,2));console.log(JSON.stringify({passed:true,checks}))
}finally{await browser.close()}
