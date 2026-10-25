import {chromium,expect} from '@playwright/test'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {newPage} from '../src/cardspec/tool-session.mjs'
import {mkdirSync,writeFileSync} from 'node:fs'
const dir=process.env.QA_DIR||'artifacts/repair-navigation',base=process.env.QA_BASE||'http://127.0.0.1:8787';mkdirSync(dir,{recursive:true})
const specs=['甲','乙'].map((name,i)=>compileCard(`<card design="pearl"><state id="n" type="number" initial={0}/><title>页面${name}</title><stat label="进度" value={state.n}/><button onPress="add">记录</button><action id="add"><increment target="n"/></action></card>`,{final:true,cardId:'slide-'+i}).spec)
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[]
try{for(const width of [320,360,432])for(const history of [false,true]){
 const page=await browser.newPage({viewport:{width,height:900},isMobile:true,hasTouch:true}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(({specs,pages,history})=>{
  const metadata={format:'cardspec',card_spec:specs[0],...(!history?{card_deck:specs.map(s=>({id:s.cardId,spec:s,status:'ready'}))}:{})}
  sessionStorage.setItem('cardspec:conversation:v1',JSON.stringify({messages:[{id:'m',role:'assistant',format:'cardspec',status:'succeeded',phases:[{id:'p',kind:'cardspec',phase:'dsl',status:'succeeded',message:{status:'succeeded',metadata}}]}],toolsEnabled:false}))
  if(history)sessionStorage.setItem('cardspec:pages:'+specs[0].cardId,JSON.stringify({version:1,rootId:specs[0].cardId,index:0,pages}))
  window.navAnimations=[];const animate=Element.prototype.animate
  Element.prototype.animate=function(frames,options){if(frames.some?.(f=>f.transform?.includes('100%')))window.navAnimations.push({frames,options});return animate.call(this,frames,options)}
 },{specs,pages:specs.map(s=>newPage(s)),history})
 await page.goto(base+'/')
 await page.getByRole('button',{name:'全屏查看卡片',exact:true}).click()
 const stage=page.locator('.cs-stage'),nav=page.getByRole('navigation',{name:history?'卡片页面历史':'切换相关卡片'})
 await expect(nav).toBeVisible()
 expect(await nav.evaluate(n=>!!n.closest('.cs-stage'))).toBe(false)
 const a=await stage.boundingBox(),b=await nav.boundingBox();expect(b.y).toBeGreaterThanOrEqual(a.y+a.height-1)
 await stage.getByRole('button',{name:'记录',exact:true}).click()
 await nav.locator('button').nth(1).click();await expect(stage).toContainText('页面乙')
 await page.waitForTimeout(260)
 const transitions=await page.evaluate(()=>window.navAnimations)
 expect(transitions.some(a=>a.frames.at(-1).transform==='translateX(-100%)')).toBe(true)
 expect(transitions.some(a=>a.frames[0].transform==='translateX(100%)')).toBe(true)
 await expect(stage).toHaveCount(1)
 await nav.locator('button').first().click();await expect(stage).toContainText('页面甲');await expect(stage.locator('.cs-stat')).toContainText('1')
 await page.waitForTimeout(260);await page.screenshot({path:`${dir}/${history?'history':'deck'}-${width}.png`})
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>window.navAnimations=[])
 await nav.locator('button').nth(1).click();await expect(stage).toContainText('页面乙');expect(await page.evaluate(()=>window.navAnimations.length)).toBe(0)
 expect(errors).toEqual([]);results.push({width,history,dotsOutside:true,slideOutIn:true,stateRestored:true,reducedMotion:true,errors});await page.close()
}}finally{await browser.close();writeFileSync(`${dir}/navigation.json`,JSON.stringify(results,null,2))}
console.log(JSON.stringify(results))
