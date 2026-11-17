import {readFile,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'
import assert from 'node:assert/strict'
const root='artifacts/subject-composition-qa',cases=JSON.parse(await readFile(root+'/fixtures.json','utf8')),browser=await chromium.launch({channel:'chrome',headless:true}),runs=[]
try{for(const c of cases)for(const width of [320,360,432])for(const size of ['square','full']){
 const page=await browser.newPage({viewport:{width:width+36,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('http://127.0.0.1:8787/card-debug.html');await page.waitForFunction(()=>!!window.cardDebug)
 await page.evaluate(({spec,width,size,snapshots})=>window.cardDebug.mount(spec,{width,size,snapshots}),{spec:c.spec,width,size,snapshots:c.snapshots});await page.waitForFunction(()=>window.cardDebug.ready())
 await page.locator('.cs-subject-role article').first().waitFor();const before=await page.evaluate(()=>window.cardDebug.snapshot())
 await page.getByRole('radio',{name:c.subjects[1].title,exact:true}).click();await page.waitForFunction(id=>window.cardDebug.snapshot().state.selected===id,c.subjects[1].id)
 await page.waitForFunction(()=>!Object.values(window.cardDebug.snapshot().bindings).some(b=>b.status==='loading'))
 const after=await page.evaluate(()=>window.cardDebug.snapshot());assert.equal(after.state.selected,c.subjects[1].id);assert.equal(await page.locator('.cs-subject-board').getAttribute('data-subject'),c.subjects[1].id)
 if(c.id==='rail'){
  await page.getByRole('button',{name:'查看车次 · 7 项 →',exact:true}).click();await page.getByRole('button',{name:'后一组 →',exact:true}).click();await page.getByText(size==='square'?'G102':'G104',{exact:true}).waitFor()
  await page.getByRole('button',{name:'← 返回概览',exact:true}).click();if(size==='square')await page.getByRole('tab',{name:'天气',exact:true}).click();await page.getByText('18°C',{exact:true}).waitFor()
 }else if(c.id==='travel'){if(size==='square')await page.getByRole('tab',{name:'周边',exact:true}).click();await page.getByText('西溪湿地附近餐厅',{exact:true}).waitFor();assert.ok(!(await page.locator('.cs-stage').innerText()).includes('湘湖附近餐厅'))}
 else {await page.getByText('缓存：这是可控测试用的不同解释文本。',{exact:true}).waitFor();if(size==='square')await page.getByRole('tab',{name:'讲解视频',exact:true}).click();await page.getByText('缓存的图解视频',{exact:true}).waitFor()}
 await page.evaluate(()=>window.cardDebug.save());await page.reload();await page.waitForFunction(()=>!!window.cardDebug)
 await page.evaluate(({spec,width,size,snapshots})=>window.cardDebug.mount(spec,{width,size,snapshots,restore:true}),{spec:c.spec,width,size,snapshots:c.snapshots});await page.waitForFunction(()=>window.cardDebug.ready())
 const final=await page.evaluate(()=>window.cardDebug.snapshot());assert.equal(final.state.selected,c.subjects[1].id);assert.deepEqual(final.errors,[]);assert.equal(final.horizontalOverflow,false);assert.deepEqual(errors,[])
 await page.locator('.cs-stage').screenshot({path:`${root}/${c.id}-${width}-${size}.png`});runs.push({case:c.id,width,size,status:'passed',before,after,final,errors});await page.close();console.log(c.id,width,size,'passed')
}}finally{await writeFile(root+'/browser.json',JSON.stringify(runs,null,2));await browser.close()}
