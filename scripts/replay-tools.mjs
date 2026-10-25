import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {chromium,expect} from '@playwright/test'
const out=process.env.TOOL_REPLAY_OUT||'artifacts/tools-qa/generated-replay'
await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'})
const results=[]
for(const id of ['live','search','refresh','slot','page','journey']){
 const dir=['page','journey'].includes(id)?'live-navigation':id==='search'&&(process.env.TOOL_SEARCH_DIR)?process.env.TOOL_SEARCH_DIR:'live'
 const record=JSON.parse(await readFile(`artifacts/tools-qa/${dir}/${id}.json`,'utf8'))
 const page=await browser.newPage({viewport:{width:1100,height:1000}});page.setDefaultTimeout(6000)
 const result={id,status:'failed',requests:[],errors:[],checks:[]};let generated=0,fail=false
 page.on('pageerror',e=>result.errors.push(e.message))
 await page.route('**/api/chat',route=>route.fulfill({contentType:'text/event-stream',body:record.frames.map(f=>'data: '+JSON.stringify(f)+'\n\n').join('')+'data: [DONE]\n\n'}))
 await page.route('**/api/photo?**',route=>route.fulfill({status:503,json:{status:'error'}}))
 await page.route('**/api/tools/invoke',async route=>{
   const p=route.request().postDataJSON();result.requests.push({tool:p.tool,input:p.input,target:p.target})
   const feed={items:[0,1,2].map(i=>({id:'qa'+i,title:(p.input.query||'测试资讯')+' '+i,author:'作者',url:'https://example.com/'+i,rank:i+1,score:i,scoreLabel:'积分',comments:0,tags:[]})),source:'QA substitute',fetchedAt:new Date().toISOString()}
   let value=p.tool==='glm.generate'?(generated++===0?record.generated:record.secondGenerated):{kind:'json',value:feed}
   const frame=fail?{type:'error',error:'可控外部服务失败'}:{type:'result',result:value}
   await route.fulfill({contentType:'text/event-stream',body:[frame,{type:'done'}].map(f=>'data: '+JSON.stringify({...f,requestId:p.requestId,pageId:p.pageId})+'\n\n').join('')})
 })
 const card=page.locator('.cs-card').last()
 try{
   await page.goto('http://127.0.0.1:8787/')
   await page.getByPlaceholder('描述你想要的交互卡片…').fill(record.prompt);await page.getByRole('button',{name:'发送',exact:true}).click()
   await page.getByRole('button',{name:'停止',exact:true}).waitFor({state:'hidden',timeout:12000})
   for(const width of [320,360,432]){
     await page.locator('.dil-stage').last().evaluate((el,w)=>{el.style.width=w+'px';el.style.maxWidth='none'},width)
     await expect(card).toBeVisible();expect(await page.locator('.cs-stage').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
   }
   if(id==='live'){await expect(card).toContainText('测试资讯 0');result.checks.push('自动加载真实契约替身')}
   if(id==='search'){
     await card.getByRole('textbox').first().fill('Svelte')
     await card.getByRole('button',{name:'搜索',exact:true}).click()
     await expect.poll(()=>result.requests.some(r=>r.input.query==='Svelte')).toBe(true)
     expect(result.requests.at(-1).input.query).toBe('Svelte');await expect(card).toContainText('Svelte 0');result.checks.push('编辑关键词后调用最新参数')
   }
   if(id==='refresh'){
     await card.getByRole('button',{name:'刷新获取',exact:true}).click();await expect(card).toContainText('测试资讯 0')
     const noteId=await card.getByRole('textbox',{name:'阅读笔记',exact:true}).first().getAttribute('id'),note=page.locator(`[id="${noteId}"]`)
     await note.fill('保留我的笔记');fail=true
     await card.getByRole('button',{name:'刷新获取',exact:true}).click();await expect(page.getByRole('alert')).toContainText('可控外部服务失败')
     await expect(note).toHaveValue('保留我的笔记');await expect(card).toContainText('测试资讯 0');result.checks.push('刷新失败保留列表与笔记')
   }
   if(id==='slot'||id==='page'){
     await card.getByRole('button',{name:/测试资讯 0/}).click()
     if(id==='slot')await card.getByRole('textbox',{name:'我的笔记',exact:true}).fill('局部替换不清空')
     await card.getByRole('button',{name:id==='slot'?'中文解释':/^深入探索/}).click()
     if(id==='slot'){
       await expect.poll(()=>generated).toBe(1);await expect(page.locator('.cs-tool-slot')).not.toContainText('点击按钮生成中文解释')
       await expect(card.getByRole('textbox',{name:'我的笔记',exact:true})).toHaveValue('局部替换不清空');await expect(page.getByRole('navigation',{name:'卡片页面历史'})).toHaveCount(0)
     }else await expect(page.getByRole('navigation',{name:'卡片页面历史'})).toContainText('2 / 2')
     result.checks.push(id==='slot'?'slot 原子替换、表单保留':'真实模型下一页进入历史')
   }
   if(id==='journey'){
     await card.getByRole('button',{name:'开始学习',exact:true}).click();await expect(page.getByRole('navigation',{name:'卡片页面历史'})).toContainText('2 / 2')
     await card.locator('[data-cs-component="chip"]').first().click();await expect(card).toContainText('再想想')
     await card.getByRole('button',{name:'继续探索',exact:true}).click();await expect(page.getByRole('navigation',{name:'卡片页面历史'})).toContainText('3 / 3')
     await page.getByRole('button',{name:'返回上一张页面',exact:true}).click();await expect(card).toContainText('再想想')
     await page.reload();await expect(page.getByRole('navigation',{name:'卡片页面历史'})).toContainText('2 / 3');await expect(card).toContainText('再想想')
     await page.getByRole('button',{name:'返回上一张页面',exact:true}).click();await expect(card.getByLabel('想学的概念',{exact:true})).toHaveValue('勒贝格测度')
     await page.getByRole('button',{name:'前进下一张页面',exact:true}).click();expect(generated).toBe(2);result.checks.push('连续两次生成、答题状态返回/刷新恢复、不重复生成')
   }
   await expect(page.locator('[data-cs-error]')).toHaveCount(0);expect(result.errors).toEqual([]);result.status='passed'
 }catch(e){result.error=e.message}
 result.text=await card.innerText().catch(()=>'');await page.screenshot({path:`${out}/${id}.png`});results.push(result)
 await writeFile(`${out}/summary.json`,JSON.stringify(results,null,2));console.log(id,result.status,result.error?.slice(0,180)||'');await page.close()
}
await browser.close()
