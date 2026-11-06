import {chromium} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import {cases,families,formats} from './visual-cases.mjs'
const dir=process.env.VISUAL_DIR||'artifacts/tooling-p0p1-20261103/visual';await mkdir(dir,{recursive:true})
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[]
try{
 for(const c of cases)for(const family of families.filter(f=>!process.env.VISUAL_FAMILY||f===process.env.VISUAL_FAMILY))for(const format of formats){
  const id=[c.id,family,format].join('-'),page=await browser.newPage({viewport:{width:480,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(3000)
  const r={id,case:c.id,family,format,layouts:[],checks:[]};const check=async(name,fn)=>{try{await fn();r.checks.push({name,passed:true})}catch(e){r.checks.push({name,passed:false,error:e.message.slice(0,250)})}}
  try{
   for(const width of [320,360,432])for(const size of ['square','auto']){
    await page.goto(`http://127.0.0.1:8787/tooling-p0p1/viewer.html?id=${id}&width=${width}&size=${size}`);await page.waitForSelector('.tool-stage');await page.waitForTimeout(120)
    const metrics=await page.locator('.cs-stage').evaluate(el=>({width:el.clientWidth,horizontal:el.scrollWidth>el.clientWidth+2,inner:[...el.querySelectorAll('.tv-body,.tool-stage')].map(e=>({name:e.className,height:e.clientHeight,scroll:e.scrollHeight,overflow:e.scrollHeight>e.clientHeight+2}))}))
    r.layouts.push({width,size,...metrics});if(format==='4x4'&&size==='square'&&[320,432].includes(width)){const file=id+'-'+width+'.png';await page.locator('.cs-stage').screenshot({path:dir+'/'+file});(r.screenshots??=[]).push(file)}
   }
   await check('selection-and-paging',async()=>{const next=page.getByRole('button',{name:'下一项',exact:true});await next.click();if(!/2\s*\//.test(await page.locator('.ts-pager').innerText()))throw Error('selection did not advance')})
   if(c.id==='weather')await check('shared-temperature-axis',async()=>{if(await page.locator('.ts-weather [role=button]').count()!==3&&format!=='2x2')throw Error('missing daily chart');if(!/21/.test(await page.locator('.ts-headline').innerText()))throw Error('selected weather unchanged')})
   else if(c.id==='scores')await check('score-baseline-toggle',async()=>{await page.getByRole('button',{name:'显示同级差值',exact:true}).click();if(!/\-0\.10/.test(await page.locator('.ts-dimensions').innerText()))throw Error('delta incorrect')})
   else{
    await check('select-pin-or-compare',async()=>{await page.getByRole('button',{name: c.id==='trains'?'固定车次':c.id==='movies'?'加入对比':'选入地点',exact:true}).click();if(await page.getByRole('button',{name:c.id==='trains'?'固定车次':c.id==='movies'?'加入对比':'选入地点',exact:true}).getAttribute('aria-pressed')!=='true')throw Error('missing selection feedback')})
    await check('detail-and-return',async()=>{await page.getByRole('button',{name:/^查看 /}).first().click();await page.waitForSelector('.tv-detail');await page.getByRole('button',{name:'← 返回候选',exact:true}).click();await page.waitForSelector('.tool-stage')})
   }
   await check('raw-output-is-optional',async()=>{await page.getByRole('button',{name:'数据',exact:true}).click();await page.waitForSelector('.tv-raw');if(!await page.locator('.tv-body').isHidden())throw Error('raw overlays content');await page.getByRole('button',{name:'数据',exact:true}).click()})
   await check('reload-retains-view',async()=>{await page.getByRole('button',{name:'下一项',exact:true}).click().catch(()=>{});const before=await page.locator('.ts-pager').innerText();await page.reload();await page.waitForSelector('.tool-stage');const after=await page.locator('.ts-pager').innerText();if(before!==after)throw Error('view index lost')})
  }catch(e){r.error=e.message}
  r.errors=errors;r.passed=!r.error&&!errors.length&&r.layouts.every(l=>!l.horizontal)&&r.checks.every(x=>x.passed);results.push(r);await page.close();await writeFile(dir+'/results.json',JSON.stringify(results,null,2));console.log(id+' '+r.passed)
 }
}finally{await browser.close()}
