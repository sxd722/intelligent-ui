import {chromium} from '@playwright/test'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const dir='artifacts/adaptive-eval-v2/generated-ui';await mkdir(dir,{recursive:true})
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[]
try{
 for(const id of ['08-calendar','21-opinion','22-family','23-movies','24-mlp','25-trains'])for(const width of [320,360,432])for(const size of ['square','auto']){
  const r=JSON.parse(await readFile(`artifacts/adaptive-eval-v2/adaptive-v1/r1/${id}-cardspec.json`))
  const page=await browser.newPage({viewport:{width:900,height:1100}}),errors=[];page.setDefaultTimeout(3000);page.on('pageerror',e=>errors.push(e.message))
  try{
   await page.goto('http://127.0.0.1:8787/cardspec-lab.html?fixture=counter')
   await page.getByLabel('宽度',{exact:true}).selectOption(String(width));await page.getByLabel('卡片尺寸',{exact:true}).selectOption(size)
   await page.getByText('输入 DSL 验证',{exact:true}).click();await page.getByLabel('DSL源码').fill(r.source);await page.getByRole('button',{name:'应用源码'}).click()
   const card=page.locator('.cs-card');await card.waitFor();assert.deepEqual(JSON.parse(await page.getByTestId('diagnostics').innerText()).filter(x=>x.severity==='error'),[])
   const text=()=>card.innerText()
   if(id==='08-calendar'){
    await card.locator('[data-date="2028-02-29"]').click();assert.match(await text(),/闰日读书会/)
    await card.getByRole('button',{name:'下个月',exact:true}).click();await card.getByRole('button',{name:'上个月',exact:true}).click()
    await card.locator('[data-date="2028-02-02"]').click();assert.match(await text(),/社区实验室开放/)
   }else if(id==='21-opinion'){
    await card.getByRole('radio',{name:'负面',exact:true}).check()
    await card.getByRole('button',{name:'b · 负面',exact:true}).click()
    assert.match(await text(),/异响令人担心/);assert.equal(await card.getByRole('button',{name:'a · 正面',exact:true}).count(),0)
   }else if(id==='22-family'){
    await card.getByRole('button',{name:'公园a',exact:true}).click();await card.getByRole('button',{name:'博物馆b',exact:true}).click()
    await card.getByRole('button',{name:'查看预算',exact:true}).click();assert.match(await text(),/30 元/)
    await card.getByRole('button',{name:'返回修改',exact:true}).click();assert.match(await text(),/已选 2 处/)
   }else if(id==='23-movies'){
    await card.getByRole('checkbox').nth(0).check();await card.getByRole('checkbox').nth(1).check()
    assert.match(await text(),/120/);assert.match(await text(),/90/)
    await card.getByRole('button',{name:'保存今晚的决定',exact:true}).click();assert.match(await text(),/已保存|决定/)
   }else if(id==='24-mlp'){
    await card.getByRole('slider').fill('3');await card.getByRole('slider').dispatchEvent('input')
    await card.getByText('17.0',{exact:true}).waitFor()
    await card.getByRole('switch').click();await card.getByText('18.0',{exact:true}).waitFor()
    await card.getByRole('button',{name:'重置',exact:true}).click();await card.getByText('11.0',{exact:true}).waitFor()
   }else{
    await card.getByRole('button',{name:'G2 11:00',exact:true}).click();await card.getByRole('button',{name:'G4 18:00',exact:true}).click()
    assert.match(await text(),/当前行程：去程 G2 11:00 → 返程 G4 18:00/)
    assert.match(await card.getByRole('link',{name:/12306/}).getAttribute('href'),/^https:\/\/www\.12306\.cn/)
    assert.doesNotMatch(await text(),/NaN|Invalid Date/)
   }
   const box=await card.evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth}));assert.ok(box.scrollWidth<=box.width+1);assert.deepEqual(errors,[])
   results.push({id,width,size,passed:true,box});await card.screenshot({path:`${dir}/${id}-${width}-${size}.png`})
  }catch(e){results.push({id,width,size,passed:false,error:e.message.split('\n')[0],locatorUncertain:/Timeout|strict mode|locator\./.test(e.message),errors});await page.screenshot({path:`${dir}/${id}-${width}-${size}-error.png`})}
  await page.close();console.log(JSON.stringify(results.at(-1)))
 }
}finally{await browser.close()}
await writeFile(dir+'/results.json',JSON.stringify(results,null,2));if(results.some(r=>!r.passed))process.exitCode=1
