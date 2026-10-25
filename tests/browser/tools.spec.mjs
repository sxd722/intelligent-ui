import {test,expect} from '@playwright/test'
import {compileCard} from '../../shared/cardspec/compiler.mjs'
import {TOOL_DEMO,TOOL_PAGE,TOOL_SLOT} from '../../shared/cardspec/tool-fixtures.mjs'
const feed={items:Array.from({length:8},(_,i)=>({id:'item'+i,title:'真实来源测试资讯 '+i,author:'作者',url:'https://example.com/'+i,rank:i+1,score:i,scoreLabel:'积分',comments:0,tags:[]})),source:'测试',fetchedAt:new Date().toISOString()}
async function mock(page,{fail=false,delay=0}={}){
 const requests=[];let seq=0
 await page.route('**/api/tools/invoke',async route=>{
  const p=route.request().postDataJSON();requests.push(p)
  if(delay)await new Promise(r=>setTimeout(r,delay))
  const result=p.tool!=='glm.generate'?{kind:'json',value:feed}:{kind:p.target.startsWith('slot:')?'slot':'page',spec:compileCard(p.target.startsWith('slot:')?TOOL_SLOT:TOOL_PAGE,{final:true,cardId:'generated'+(++seq)}).spec}
  const frame=fail&&p.tool==='glm.generate'?{type:'error',error:'可控失败'}:{type:'result',result}
  await route.fulfill({contentType:'text/event-stream',body:[frame,{type:'done'}].map(f=>'data: '+JSON.stringify({...f,requestId:p.requestId,pageId:p.pageId})+'\n\n').join('')})
 });return requests
}
for(const width of ['320','360','432'])test(`tool card ${width}: live data, slot, next page and history survive reload`,async({page})=>{
 const requests=await mock(page)
 await page.goto('/cardspec-lab.html?fixture=tools');await page.getByLabel('宽度',{exact:true}).selectOption(width)
 await expect(page.getByTestId('diagnostics')).toHaveText('[]')
 await expect(page.getByRole('button',{name:/真实来源测试资讯 0/})).toBeVisible()
 await page.getByLabel('我的笔记',{exact:true}).fill('首页保留')
  await page.locator('.cs-region-body').first().evaluate(el=>el.scrollTo(0,150))
 await page.getByRole('button',{name:'解释一下',exact:true}).click()
 await expect(page.getByRole('button',{name:'有帮助 0',exact:true})).toBeVisible();await page.getByRole('button',{name:'有帮助 0',exact:true}).click()
 await page.getByRole('button',{name:'深入探索',exact:true}).click()
 await expect(page.getByRole('heading',{name:'深入了解',exact:true})).toBeVisible();await page.getByLabel('本页笔记',{exact:true}).fill('第二页保留')
 await expect(page.getByRole('navigation',{name:'卡片页面历史'})).toContainText('2 / 2')
 await expect.poll(()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('cardspec:lab:tools')||'{}').index)).toBe(1)
 await page.reload();await expect(page.getByLabel('本页笔记',{exact:true})).toHaveValue('第二页保留')
 await page.getByRole('button',{name:'返回上一张页面',exact:true}).click()
 await expect(page.getByLabel('我的笔记',{exact:true})).toHaveValue('首页保留');await expect(page.getByRole('button',{name:'有帮助 1',exact:true})).toBeVisible()
  await expect.poll(()=>page.locator('.cs-region-body').first().evaluate(el=>el.scrollTop)).toBeGreaterThan(0)
 await page.getByRole('button',{name:'前进下一张页面',exact:true}).click();await expect(page.getByLabel('本页笔记',{exact:true})).toHaveValue('第二页保留')
 expect(requests.filter(p=>p.tool==='glm.generate')).toHaveLength(2)
 await expect(page.locator('[data-cs-error]')).toHaveCount(0)
 expect(await page.locator('.cs-stage').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
})
test('main conversation restores cards and module toggle blocks tool execution',async({page})=>{
 const requests=await mock(page)
 // This is an app restoration test: a controlled valid card must not depend on
 // the real AutoCLI daemon owned by the separate production server on 8787.
 const spec=compileCard(TOOL_DEMO,{final:true,cardId:'qa-tools'}).spec
 await page.route('**/api/chat',route=>route.fulfill({contentType:'text/event-stream',body:[
  {type:'phase_begin',id:'qa-phase',phase:'dsl',title:'CardSpec',kind:'cardspec'},
  {p:'',o:'add',v:{message:{id:'qa-phase',status:'succeeded',content:{parts:[TOOL_DEMO]},metadata:{format:'cardspec',card_spec:spec}}}},
  {type:'phase_end',id:'qa-phase',status:'succeeded'},
  {type:'message_stream_complete',status:'succeeded'}
 ].map(f=>'data: '+JSON.stringify(f)+'\n\n').join('')+'data: [DONE]\n\n'}))
 await page.goto('/');await page.getByRole('button',{name:/Pipeline/}).click()
 await page.getByPlaceholder('描述你想要的交互卡片…').fill('QA_TOOL_CARD')
 await page.getByRole('button',{name:'发送',exact:true}).click()
 await expect(page.getByRole('button',{name:'深入探索',exact:true})).toBeEnabled()
 await page.getByLabel('我的笔记',{exact:true}).fill('应用级恢复')
 await expect.poll(()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('cardspec:conversation:v1')||'{}').messages?.length)).toBe(2)
 await page.reload();await expect(page.getByLabel('我的笔记',{exact:true})).toHaveValue('应用级恢复')
 await page.getByRole('checkbox',{name:'工具增强',exact:true}).uncheck()
 await expect(page.getByText('工具增强已关闭',{exact:true})).toBeVisible()
 const count=requests.length;await page.getByRole('button',{name:'刷新资讯',exact:true}).click()
 expect(requests.length).toBe(count)
})
test('history swipe works without taking over component gestures',async({page})=>{
 await mock(page);await page.goto('/cardspec-lab.html?fixture=tools')
 await page.getByRole('button',{name:'深入探索',exact:true}).click()
 const nav=page.getByRole('navigation',{name:'卡片页面历史'})
 await expect(nav).toContainText('2 / 2')
 let box=await nav.boundingBox()
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+80,box.y+box.height/2,{steps:5});await page.mouse.up()
 await expect(nav).toContainText('1 / 2')
 box=await nav.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2-80,box.y+box.height/2,{steps:5});await page.mouse.up()
 await expect(nav).toContainText('2 / 2')
 const input=await page.getByLabel('本页笔记').boundingBox()
 await page.mouse.move(input.x+5,input.y+10);await page.mouse.down();await page.mouse.move(input.x+100,input.y+10);await page.mouse.up();await expect(nav).toContainText('2 / 2')
})
test('generation failure and cancellation retain page and typed input',async({page})=>{
 await mock(page,{fail:true,delay:150})
 await page.goto('/cardspec-lab.html?fixture=tools');await expect(page.getByRole('button',{name:'深入探索',exact:true})).toBeEnabled()
 await page.getByLabel('我的笔记',{exact:true}).fill('不丢失')
 await page.getByRole('button',{name:'深入探索',exact:true}).click()
 await expect(page.getByRole('alert')).toContainText('可控失败');await expect(page.getByLabel('我的笔记',{exact:true})).toHaveValue('不丢失')
 await expect(page.getByRole('navigation',{name:'卡片页面历史'})).toHaveCount(0)
 await page.getByRole('button',{name:'深入探索',exact:true}).click();await page.getByRole('button',{name:'取消',exact:true}).click()
 await expect(page.getByLabel('我的笔记',{exact:true})).toHaveValue('不丢失')
})
