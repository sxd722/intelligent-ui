import {test,expect} from '@playwright/test'
test('dedicated-page binding reports success and failures without leaving the page',async({page})=>{
 let bound=false
 await page.route('**/api/tools/bind',r=>{bound=true;return r.fulfill({json:{ok:true,message:'专用标签页已绑定'}})})
 await page.route('**/api/tools/unbind',r=>{bound=false;return r.fulfill({json:{ok:true,message:'已解除绑定'}})})
 await page.setViewportSize({width:320,height:740})
 await page.goto('/opencli-probe.html');await page.getByRole('button',{name:'绑定此测试页',exact:true}).click()
 await expect(page.getByRole('status')).toHaveText('专用标签页已绑定');expect(bound).toBe(true)
 expect(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth)).toBe(true)
 await page.screenshot({path:'artifacts/opencli-expanded/binding-mobile.png',fullPage:true})
 await page.getByRole('button',{name:'解除绑定',exact:true}).click();await expect(page.getByRole('status')).toHaveText('已解除绑定');expect(bound).toBe(false)
})
const result={kind:'json',value:{items:[{date:'2026-10-14',description:'晴',minTempC:18,maxTempC:25,sunset:'18:00',rowKey:'d1'}],source:'OpenCLI · wttr',fetchedAt:new Date().toISOString(),truncated:false}}
for(const width of [320,360,432])test(`OpenCLI ${width}: read data and write confirmation`,async({page})=>{
 const calls=[]
 await page.route('**/api/tools/prepare',async route=>{
  const p=route.request().postDataJSON();await route.fulfill({json:{token:'test-confirmation',description:'播放音乐',input:p.input,notice:'修改外部播放状态'}})
 })
 await page.route('**/api/tools/invoke',async route=>{
  const p=route.request().postDataJSON();calls.push(p)
  await route.fulfill({contentType:'text/event-stream',body:[{type:'result',result},{type:'done'}].map(f=>'data: '+JSON.stringify({...f,requestId:p.requestId,pageId:p.pageId})+'\n\n').join('')})
 })
 await page.goto('/cardspec-lab.html?fixture=opencliWeather');await page.getByLabel('宽度',{exact:true}).selectOption(String(width))
 await expect(page.getByTestId('diagnostics')).toHaveText('[]')
 await page.getByRole('button',{name:'查询天气',exact:true}).click();await expect(page.getByText('晴',{exact:true})).toBeVisible()
 expect(calls[0].tool).toBe('opencli.wttr.forecast')
 await page.goto('/cardspec-lab.html?fixture=opencliMusic');await page.getByLabel('宽度',{exact:true}).selectOption(String(width))
 await page.getByLabel('歌曲或歌手',{exact:true}).fill('周杰伦')
 await page.getByRole('button',{name:'播放音乐',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'确认外部操作'})
 await expect(dialog).toContainText('周杰伦');expect(calls).toHaveLength(1)
 await page.getByRole('button',{name:'暂不执行',exact:true}).click();expect(calls).toHaveLength(1)
 await page.getByRole('button',{name:'播放音乐',exact:true}).click();await page.getByRole('button',{name:'确认执行',exact:true}).click()
 await expect.poll(()=>calls.length).toBe(2);expect(calls[1].confirmationToken).toBe('test-confirmation')
 expect(await page.locator('.cs-stage').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
})
test('connection panel distinguishes installed from browser and account readiness',async({page})=>{
 await page.route('**/api/tools/connections',r=>r.fulfill({json:{installed:true,version:'1.8.6',spotify:false,browser:{ready:false,reason:'需要连接 Chrome 扩展',profiles:[]}}}))
 await page.route('**/api/tools',r=>r.fulfill({json:{tools:[{id:'opencli.wttr.current',provider:'opencli',description:'天气',readOnly:true,available:true,reason:'无需登录'},{id:'opencli.jd.cart',provider:'opencli',description:'购物车',readOnly:true,available:false,reason:'需要连接 Chrome 扩展'}]}}))
 await page.goto('/');await page.getByRole('button',{name:'工具连接',exact:true}).click()
 await expect(page.getByRole('region',{name:'工具连接设置'})).toContainText('可调用 1 项')
 await expect(page.getByRole('region',{name:'工具连接设置'})).toContainText('需要连接 Chrome 扩展')
})

test('connection configuration saves capability switches and diagnoses unsupported hosts on mobile',async({page})=>{
 let disabledTools=[],diagnostic,probed=0
 await page.setViewportSize({width:360,height:800})
 await page.route('**/api/tools/connections',r=>r.fulfill({json:{installed:true,version:'1.8.6',spotify:false,disabledTools,desktopApp:{installed:true,runtimeVersion:'1.8.6',commandCount:1275,skills:['opencli-usage']},browser:{connected:true,ready:!diagnostic,reason:diagnostic?.message||'扩展已连接，尚未验证窗口操作',profiles:[{id:'desktop',name:'Desktop Chrome'}],profile:'desktop',diagnostic}}}))
 await page.route('**/api/tools',r=>r.fulfill({json:{tools:[{id:'opencli.wttr.current',site:'wttr',provider:'opencli',description:'天气',readOnly:true,available:!disabledTools.length,reason:disabledTools.length?'已在网页配置中停用':'无需登录'}]}}))
 await page.route('**/api/tools/configure',r=>{disabledTools=r.request().postDataJSON().disabledTools;return r.fulfill({json:{disabledTools}})})
 await page.route('**/api/tools/diagnose',r=>{probed++;diagnostic={ok:false,code:'unsupported-browser-host',checkedAt:new Date().toISOString(),message:'当前 Owl 环境不支持创建自动化窗口。请使用桌面 Chrome。'};return r.fulfill({json:diagnostic})})
 await page.goto('/');await page.getByRole('button',{name:'工具连接',exact:true}).click()
 const panel=page.getByRole('region',{name:'工具连接设置'}),toggle=page.getByRole('checkbox',{name:'启用 opencli.wttr.current'})
 await expect(panel).toContainText('内置 CLI 1.8.6')
 await toggle.uncheck();await expect(panel).toContainText('可调用 0 项');expect(disabledTools).toEqual(['opencli.wttr.current'])
 await page.reload();await page.getByRole('button',{name:'工具连接',exact:true}).click();await expect(toggle).not.toBeChecked()
 await page.getByRole('button',{name:'启用此站点',exact:true}).click();await expect(toggle).toBeChecked()
 await page.getByRole('button',{name:'测试实际浏览器能力',exact:true}).click();await expect(panel).toContainText('实际操作未通过');expect(probed).toBe(1)
 expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
})
