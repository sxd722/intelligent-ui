import fs from 'node:fs/promises'
import {chromium} from 'playwright'
import {compileCard} from '../shared/cardspec/compiler.mjs'
const root='artifacts/content-relations-qa/controlled'
const browser=await chromium.launch({channel:'chrome',headless:true})
for(const name of ['bamboo','cs343','care'])for(const arm of ['off','on']){
 if(process.env.QA_CASE&&process.env.QA_CASE!==name||process.env.QA_ARM&&process.env.QA_ARM!==arm)continue
 const dir=`${root}/${name}-${arm}`;let result;try{result=JSON.parse(await fs.readFile(dir+'/result.json','utf8'))}catch{continue}
 const spec=result.spec||compileCard(result.source||'',{final:true,context:{expressionDialect:'js-v1',cardSize:'auto',renderMode:'native'}}).spec
 if(!spec){console.log(name,arm,'no compiled candidate');continue}
 const summary=[]
 for(const size of ['auto','square'])for(const width of [320,360,432]){
  const path=`${dir}/layout-${width}-${size}`;await fs.mkdir(path,{recursive:true})
  const context=await browser.newContext({viewport:{width,height:920},reducedMotion:'reduce'});await context.route('**/api/**',r=>r.request().url().endsWith('/api/health')?r.continue():r.abort())
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto('http://127.0.0.1:8787/card-debug.html');await page.waitForFunction(()=>window.cardDebug)
  await page.evaluate(({spec,width,size})=>window.cardDebug.mount(spec,{width,size}),{spec,width,size});await page.waitForFunction(()=>window.cardDebug.ready());await page.waitForTimeout(600)
  const snapshot=await page.evaluate(()=>window.cardDebug.snapshot());await fs.writeFile(path+'/initial.json',JSON.stringify(snapshot,null,2));await page.locator('.cs-stage').screenshot({path:path+'/initial.png'})
  const samples=[];for(let i=0;i<20;i++){
   samples.push(await page.evaluate(()=>{const stage=document.querySelector('.cs-stage'),rect=stage.getBoundingClientRect();return {at:performance.now(),height:rect.height,width:rect.width,overflow:Math.max(0,stage.scrollWidth-stage.clientWidth),pages:document.querySelectorAll('button[aria-label^="卡片页面："]').length,relations:[...document.querySelectorAll('.cs-relation')].filter(e=>e.getClientRects().length).map(e=>({kind:e.dataset.relation,width:e.clientWidth,overflow:e.scrollWidth-e.clientWidth,parts:e.children.length}))}}));await page.waitForTimeout(100)
  }
  const heights=samples.map(s=>s.height),stable=Math.max(...heights)-Math.min(...heights)<=1
  const vertical=await page.evaluate(()=>[...document.querySelectorAll('.cs-stage,.cs-region-body,.cs-composition-body,.cs-relation')].filter(e=>e.getClientRects().length&&e.clientHeight>0&&e.scrollHeight>e.clientHeight+2).map(e=>({element:e.className,client:e.clientHeight,scroll:e.scrollHeight,overflowY:getComputedStyle(e).overflowY})));
  const layout={width,size,vertical,delivery:result.status,specSource:result.status==='succeeded'?'delivered':'retained-preview',errors,stable,horizontalOverflow:Math.max(...samples.map(s=>Math.max(s.overflow,...s.relations.map(r=>r.overflow)))),samples}
  await fs.writeFile(path+'/layout.json',JSON.stringify(layout,null,2));summary.push({...layout,samples:undefined});await context.close()
 }
 await fs.writeFile(dir+'/layouts.json',JSON.stringify(summary,null,2));console.log(name,arm,JSON.stringify(summary))
}
await browser.close()
