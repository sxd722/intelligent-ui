import {chromium} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const dir='artifacts/adaptive-eval/ui';await mkdir(dir,{recursive:true})
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[]
try{
 for(const fixture of ['adaptiveExplore','adaptivePlanner','adaptiveCompare','adaptiveNumeric','adaptiveSeries'])for(const width of [320,360,432])for(const size of ['square','auto']){
  const page=await browser.newPage({viewport:{width:900,height:1100}}),errors=[];page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message))
  try{
   await page.goto(`http://127.0.0.1:8787/cardspec-lab.html?fixture=${fixture}`)
   await page.getByLabel('宽度',{exact:true}).selectOption(String(width));await page.getByLabel('卡片尺寸',{exact:true}).selectOption(size)
   const card=page.locator('.cs-card');await card.waitFor()
   assert.deepEqual(JSON.parse(await page.getByTestId('diagnostics').innerText()).filter(d=>d.severity==='error'),[])
   if(['adaptiveExplore','adaptivePlanner','adaptiveCompare'].includes(fixture)){
    if(fixture==='adaptiveExplore'){await card.getByRole('button',{name:'户外 5',exact:true}).click();assert.match(await card.innerText(),/1\/2/)}
    else{
     if(fixture==='adaptivePlanner')await card.getByRole('button',{name:'候选',exact:true}).click()
     await card.locator('.cs-experience-item').nth(0).click();await card.locator('.cs-experience-item').nth(1).click()
     if(fixture==='adaptivePlanner'){await card.getByRole('button',{name:'确认选择',exact:true}).click();assert.equal(await card.locator('.cs-stat strong').innerText(),'2')}
     await card.getByRole('button',{name:'已选',exact:true}).click();assert.equal(await card.locator('.cs-experience-item').count(),2)
     await page.reload();await page.getByLabel('宽度',{exact:true}).selectOption(String(width))
     assert.equal(await card.locator('.cs-experience-item').count(),2)
    }
    await card.getByRole('button',{name:'原始资料',exact:true}).click();await card.locator('.cs-experience-sources>details>summary').first().click();await card.getByText('原始输出',{exact:true}).first().click();await card.locator('pre').first().waitFor({state:'visible'})
   }else if(fixture==='adaptiveNumeric'){
    const slider=card.getByRole('slider');await slider.fill('3');await slider.dispatchEvent('input');await page.waitForTimeout(300);assert.match(await card.innerText(),/17/)
    await card.getByRole('button',{name:'重置实验'}).click();await page.waitForTimeout(100);assert.match(await card.innerText(),/11/)
   }else{await card.getByRole('button',{name:'周一 负面 1',exact:true}).click();assert.match(await card.innerText(),/负面 · 1条原文/)}
   const box=await card.evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth,height:el.clientHeight,scrollHeight:el.scrollHeight}))
   assert.ok(box.scrollWidth<=box.width+1,JSON.stringify(box));assert.deepEqual(errors,[])
   await card.screenshot({path:`${dir}/${fixture}-${width}-${size}.png`})
   results.push({fixture,width,size,passed:true,box})
  }catch(e){results.push({fixture,width,size,passed:false,error:e.message,errors});await page.screenshot({path:`${dir}/error-${fixture}-${width}-${size}.png`})}
  await page.close();console.log(JSON.stringify(results.at(-1)))
 }
}finally{await browser.close()}
await writeFile(dir+'/results.json',JSON.stringify(results,null,2));if(results.some(r=>!r.passed))process.exitCode=1
