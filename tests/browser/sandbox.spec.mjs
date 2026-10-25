import {test,expect} from '@playwright/test'
import {compileSandbox} from '../../server/cardspec/sandbox.mjs'
import {SANDBOX_REACT,SANDBOX_FIXTURE} from '../../shared/cardspec/sandbox-fixtures.mjs'
import {compileCard} from '../../shared/cardspec/compiler.mjs'
const initial={energy:60,steps:0},input={cost:10,charge:15}
let module
test.beforeAll(async()=>{module=await compileSandbox(SANDBOX_REACT,{initial,input})})
async function setup(page,{failure=false,sourceModule=module}={}){
 let calls=0
 await page.addInitScript(()=>{try{localStorage.setItem('cardspec:render-mode:v1','hybrid')}catch{}})
 await page.route('**/api/tools/invoke',async route=>{
  calls++;const p=route.request().postDataJSON(),base={requestId:p.requestId,pageId:p.pageId}
  const event=failure?{type:'error',error:'Controlled generation failure'}:{type:'result',result:{kind:'sandbox',module:sourceModule}}
  await route.fulfill({contentType:'text/event-stream',body:[event,{type:'done'}].map(e=>'data: '+JSON.stringify({...base,...e})+'\n\n').join('')})
 })
 await page.goto('/cardspec-lab.html?fixture=sandbox')
 return ()=>calls
}
test('async surface has real interactions, restores without another model call, native remains usable',async({page})=>{
 const calls=await setup(page),frame=page.frameLocator('iframe[title="储能实验视图"]')
 await expect(frame.getByText('60 / 100')).toBeVisible({timeout:12000})
 await frame.getByRole('button',{name:'推进一步'}).click();await expect(frame.getByText('50 / 100')).toBeVisible()
 await frame.getByRole('button',{name:'充能',exact:true}).click();await expect(frame.getByText('65 / 100')).toBeVisible()
 await page.reload();await expect(frame.getByText('65 / 100')).toBeVisible();expect(calls()).toBe(1)
 await page.getByLabel('视图选项').click();await page.getByRole('button',{name:'原生视图',exact:true}).click();await page.getByRole('button',{name:'推进一步',exact:true}).click()
 await expect(page.locator('.cs-sandbox')).toContainText('50')
 await page.getByLabel('UI能力').selectOption('native');await expect(page.locator('iframe')).toHaveCount(0)
 await page.getByRole('button',{name:'充能',exact:true}).click();await expect(page.locator('.cs-sandbox')).toContainText('65');expect(calls()).toBe(1)
})
test('generation failure keeps native controls; reload does not replay the LLM',async({page})=>{
 const calls=await setup(page,{failure:true});await expect(page.getByRole('alert')).toContainText('Controlled generation failure')
 await page.getByRole('button',{name:'推进一步',exact:true}).click();await expect(page.locator('.cs-sandbox')).toContainText('50')
 await page.reload();await expect(page.getByRole('button',{name:'推进一步',exact:true})).toBeVisible();expect(calls()).toBe(1)
})
test('Web creation works with external tools off; disabling Web restores functional native UI',async({page})=>{
 const calls=await setup(page)
 const spec=compileCard(SANDBOX_FIXTURE,{final:true,context:{renderMode:'hybrid'},cardId:'web-tools-independent'}).spec
 await page.route('**/api/chat',route=>route.fulfill({contentType:'text/event-stream',body:[
  {type:'phase_begin',id:'web-phase',phase:'dsl',title:'CardSpec',kind:'cardspec'},
  {p:'',o:'add',v:{message:{id:'web-phase',status:'succeeded',content:{parts:[SANDBOX_FIXTURE]},metadata:{format:'cardspec',card_spec:spec}}}},
  {type:'phase_end',id:'web-phase',status:'succeeded'},
  {type:'message_stream_complete',status:'succeeded'}
 ].map(f=>'data: '+JSON.stringify(f)+'\n\n').join('')+'data: [DONE]\n\n'}))
 await page.goto('/')
 await page.getByRole('button',{name:/Pipeline/}).click()
 await page.getByRole('checkbox',{name:'工具增强',exact:true}).uncheck()
 const before=calls()
 await page.getByPlaceholder('描述你想要的交互卡片…').fill('本地模拟器')
 await page.getByRole('button',{name:'发送',exact:true}).click()
 const f=page.frameLocator('iframe[title="储能实验视图"]')
 await expect(f.getByText('60 / 100')).toBeVisible()
 await f.getByRole('button',{name:'推进一步'}).click()
 await expect(f.getByText('50 / 100')).toBeVisible()
 expect(calls()).toBe(before+1)
 await page.getByLabel('UI能力').selectOption('native')
 await expect(page.locator('iframe')).toHaveCount(0)
 await page.getByRole('button',{name:'充能',exact:true}).click()
 await expect(page.locator('.cs-sandbox')).toContainText('75')
 await page.getByLabel('UI能力').selectOption('hybrid')
 await expect(f.getByText('50 / 100')).toBeVisible()
 expect(calls()).toBe(before+1)
})
test('host native-only policy overrides hybrid preference and restored modules',async({page})=>{
 const calls=await setup(page);await expect(page.frameLocator('iframe').getByText('60 / 100')).toBeVisible()
 await page.route('**/api/health',r=>r.fulfill({json:{ok:true,cardSandbox:false}}))
 await page.reload();await expect(page.getByRole('button',{name:'推进一步',exact:true})).toBeVisible()
 await expect(page.locator('iframe')).toHaveCount(0);await expect(page.getByLabel('UI能力')).toBeDisabled();expect(calls()).toBe(1)
 await page.getByRole('button',{name:'推进一步',exact:true}).click();await expect(page.locator('.cs-sandbox')).toContainText('50')
})
test('throwing React event is isolated from the complete native simulator',async({page})=>{
 const bad=await compileSandbox('export default function App(){return <button onClick={()=>{throw Error("local crash")}}>Crash</button>}')
 await setup(page,{sourceModule:bad});await page.frameLocator('iframe').getByRole('button',{name:'Crash'}).click()
 await expect(page.getByRole('alert')).toContainText('local crash');await page.getByRole('button',{name:'充能',exact:true}).click();await expect(page.locator('.cs-sandbox')).toContainText('75')
})

test('SVG namespace compatibility is silent in UI and preserves rendering, interaction and restore',async({page})=>{
 const sourceModule=await compileSandbox(`export default function App({state,setState}){return <div data-view="compat"><svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewbox="0 0 100 60" width={100} height={60}><circle cx={30} cy={30} r={20} stroke="teal" fill="none" stroke-width={3}/></svg><button onClick={()=>setState(s=>({...s,steps:s.steps+1}))}>Advance {state.steps}</button></div>}`,{initial,input})
 const calls=await setup(page,{sourceModule}),f=page.frameLocator('iframe')
 await expect(f.getByRole('button',{name:'Advance 0'})).toBeVisible()
 await expect(f.locator('svg')).toHaveAttribute('viewBox','0 0 100 60')
 await expect(f.locator('circle')).toHaveAttribute('stroke-width','3')
 expect(await f.locator('svg').evaluate(el=>el.namespaceURI)).toBe('http://www.w3.org/2000/svg')
 await expect(page.getByRole('alert')).toHaveCount(0)
 await f.getByRole('button',{name:'Advance 0'}).click();await expect(f.getByRole('button',{name:'Advance 1'})).toBeVisible()
 await page.reload();await expect(f.getByRole('button',{name:'Advance 1'})).toBeVisible();expect(calls()).toBe(1)
})
test('rapid input and multi-step local forms preserve the final value and focus',async({page})=>{
 const form=await compileSandbox(`export default function App({state,setState}){return <div>{state.review?<section><p>{state.note}</p><button onClick={()=>setState(s=>({...s,review:false}))}>Back</button></section>:<section><textarea aria-label="Note" value={state.note||""} onChange={e=>setState(s=>({...s,note:e.target.value}))}/><button onClick={()=>setState(s=>({...s,review:true}))}>Review</button></section>}</div>}`)
 await setup(page,{sourceModule:form});const f=page.frameLocator('iframe'),input=f.getByRole('textbox',{name:'Note'})
 await input.fill('local form');await input.pressSequentially(' rapid input')
 await f.getByRole('button',{name:'Review',exact:true}).click();await expect(f.getByText('local form rapid input',{exact:true})).toBeVisible()
 await f.getByRole('button',{name:'Back',exact:true}).click();await expect(input).toHaveValue('local form rapid input')
 await page.reload();await expect(input).toHaveValue('local form rapid input')
})
test('320/360/432 widths, both size modes, opaque frame and no unexpected network',async({page,baseURL})=>{
 const external=[];page.on('request',r=>{if(!r.url().startsWith(baseURL+'/')&&!r.url().startsWith('data:'))external.push(r.url())})
 await setup(page);const frame=page.frameLocator('iframe');await expect(frame.getByText('60 / 100')).toBeVisible()
 expect(await page.locator('iframe').getAttribute('sandbox')).toBe('allow-scripts')
 for(const width of [320,360,432]){
  await page.getByLabel('宽度',{exact:true}).selectOption(String(width))
  for(const size of ['square','auto']){
   await page.getByLabel('卡片尺寸').selectOption(size)
   await expect(frame.getByRole('button',{name:'推进一步'})).toBeVisible()
   expect(await frame.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  }
 }
 expect(external).toEqual([])
 await page.locator('.cs-stage').screenshot({path:'artifacts/sandbox-qa/enhanced.png'})
 await page.getByLabel('UI能力').selectOption('native')
 await page.locator('.cs-stage').screenshot({path:'artifacts/sandbox-qa/native.png'})
})

