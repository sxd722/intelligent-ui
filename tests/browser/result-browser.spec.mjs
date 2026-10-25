import {test,expect} from '@playwright/test'
const source='<card><binding id="rows" tool="opencli.douban.top250" input={{limit:3}} initial={{items:[],source:"",fetchedAt:"",truncated:false}} load="visible" refresh={30}/><title>周末候选 · 测试数据</title><text>浏览真实结果的通用入口</text></card>'
const value={items:[{id:'a',rowKey:'a',title:'候选 A',rating:8.6,year:2025},{id:'b',rowKey:'b',title:'候选 B',rating:8.2,year:2024}],source:'可控测试数据',fetchedAt:'2026-10-14T00:00:00Z',truncated:false}
async function apply(page){await page.goto('/cardspec-lab.html?fixture=counter');await page.getByText('输入 DSL 验证',{exact:true}).click();await page.getByLabel('DSL源码').fill(source);await page.getByRole('button',{name:'应用源码',exact:true}).click();await expect(page.getByTestId('diagnostics')).toHaveText('[]')}
for(const width of [320,360,432])test(`result forms, layouts, details, favorites and history at ${width}`,async({page})=>{
 const calls=[]
 await page.route('**/api/tools/invoke',async route=>{
  const p=route.request().postDataJSON();calls.push(p.tool)
  const result={...value,items:p.tool.endsWith('.subject')?[{id:'a',title:'候选 A',summary:'来源明确的详情内容。'.repeat(12),directors:'示例导演',duration:'120分钟'}]:p.tool.endsWith('.photos')?[{image_url:'https://img1.doubanio.com/view/photo/test.jpg'}]:value.items}
  await route.fulfill({contentType:'text/event-stream',body:[{type:'result',result:{kind:'json',value:result}},{type:'done'}].map(f=>'data: '+JSON.stringify({...f,requestId:p.requestId,pageId:p.pageId})+'\n\n').join('')})
 })
 await page.route('https://img1.doubanio.com/**',r=>r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4S8AAAAASUVORK5CYII=','base64')}))
 await apply(page);await page.getByLabel('宽度',{exact:true}).selectOption(String(width))
 await page.getByRole('button',{name:'浏览结果 · rows'}).click()
 const card=page.locator('.cs-result-card')
 await page.getByLabel('筛选已获取结果').fill('候选 A')
 await page.getByLabel('结果呈现方式').selectOption('gallery')
 await card.getByRole('button',{name:/候选 A.*评分/}).click()
 await expect(card).toContainText('示例导演')
 await expect(card.locator('img')).toHaveCount(1)
 await card.getByRole('button',{name:'加入收藏',exact:true}).click()
 await expect(card.getByRole('button',{name:'已收藏',exact:true})).toHaveAttribute('aria-pressed','true')
 await page.getByRole('button',{name:'返回上一张页面'}).click()
 await expect(page.getByLabel('筛选已获取结果')).toHaveValue('候选 A')
 await expect(page.getByLabel('结果呈现方式')).toHaveValue('gallery')
 await expect(card.getByRole('button',{name:'收藏 候选 A',exact:true})).toHaveAttribute('aria-pressed','true')
 await expect(card.locator('img')).toHaveCount(1)
 await page.getByLabel('结果呈现方式').selectOption('table');await expect(card.locator('table')).toBeVisible()
 await page.getByLabel('结果呈现方式').selectOption('list')
 await expect(page.locator('[data-cs-error]')).toHaveCount(0)
 const bounds=await card.boundingBox();expect(Math.abs(bounds.width-bounds.height)).toBeLessThan(2)
 expect(await card.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
 expect(calls.filter(t=>t==='glm.generate')).toHaveLength(0)
 await card.screenshot({path:`artifacts/dongchedi-qa/results-${width}.png`})
})
test('structured tool failure shows actionable message and preserves an honest empty view',async({page})=>{
 await page.route('**/api/tools/invoke',async route=>{const p=route.request().postDataJSON();await route.fulfill({contentType:'text/event-stream',body:[{type:'error',error:'来源要求验证',errorInfo:{code:'ACCESS_RESTRICTED',message:'来源要求验证',detail:'验证码中间页',retryable:false,recovery:'open_source',retryAt:Date.now()+300000}},{type:'done'}].map(f=>'data: '+JSON.stringify({...f,requestId:p.requestId,pageId:p.pageId})+'\n\n').join('')})})
 await apply(page);await expect(page.locator('.cs-tool-status')).toContainText('自动刷新已暂缓');await expect(page.getByRole('button',{name:'按实际结果调整'})).toHaveCount(0)
})

test('trusted thumbnail failure falls back once to the original image via local media service',async({page})=>{
 const images=[]
 await page.route('**/api/tools/invoke',async route=>{const p=route.request().postDataJSON();const result={kind:'json',value:{...value,items:[{...value.items[0],thumb_url:'https://img3.doubanio.com/view/photo/m/public/p123.webp',image_url:'https://img3.doubanio.com/view/photo/l/public/p123.webp'}]}};await route.fulfill({contentType:'text/event-stream',body:[{type:'result',result},{type:'done'}].map(f=>'data: '+JSON.stringify({...f,requestId:p.requestId,pageId:p.pageId})+'\n\n').join('')})})
 await page.route('**/api/tools/media?*',async route=>{const source=new URL(route.request().url()).searchParams.get('url');images.push(source);if(source.includes('/m/'))await route.fulfill({status:502,body:'unavailable'});else await route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4S8AAAAASUVORK5CYII=','base64')})})
 await apply(page);await page.getByRole('button',{name:'浏览结果 · rows'}).click()
 const img=page.locator('.cs-result-card img');await expect(img).toHaveAttribute('src',/photo%2Fl%2F/)
 await expect.poll(()=>img.evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true)
 expect(images).toHaveLength(2)
})
