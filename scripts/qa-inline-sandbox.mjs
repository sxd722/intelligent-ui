import {chromium,expect} from '@playwright/test'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import {compileSandbox} from '../server/cardspec/sandbox.mjs'
import {mkdirSync,writeFileSync} from 'node:fs'
const base=process.env.QA_BASE||'http://127.0.0.1:8787',dir='artifacts/sandbox-inline';mkdirSync(dir,{recursive:true})
const jsx=`export const styles="@keyframes pulse{from{opacity:.4}to{opacity:1}}.orb{animation:pulse 2s infinite alternate}";export default function App({data,state,setState,bridge}){return <div style={{padding:8}}><svg viewBox="0 0 100 50" style={{width:'100%',height:90}}><circle className="orb" cx={data.n} cy={25} r={12} fill="var(--cs-accent)"/></svg><p>共享值 {data.n}</p><button onClick={()=>setState(s=>({...s,count:s.count+1}))}>本地计数 {state.count}</button><button onClick={()=>bridge.call('adjust',{value:data.n+5})}>增加共享值</button><button onClick={()=>{throw Error('controlled runtime failure')}}>测试局部异常</button></div>}`
// The intentional post-delivery error is injected only after production validation.
const safe=jsx.replace("throw Error('controlled runtime failure')","setState(s=>({...s,count:s.count+1}))")
const source=`<card><title>一次生成的交互视图</title><state id="n" type="number" initial={30}/><slider label="共享值" min={0} max={100} value={state.n} onChange="adjust"/><sandbox id="visual" label="预编译视图" brief="图形" input={{n:state.n}} initial={{count:0}} actions={{adjust:"adjust"}} height={230} source={${JSON.stringify(safe)}}/><action id="adjust"><set target="n" value={event.value}/></action></card>`
const r=compileCard(source,{final:true,context:{renderMode:'hybrid'}});await validateRichContent(r);if(!r.complete)throw Error(JSON.stringify(r.diagnostics))
if(base.includes('8792')){const {compileSandbox}=await import('../sites/intelligent-ui/server/cardspec/sandbox.mjs');r.spec.sandboxModules.visual=await compileSandbox(safe,{input:{n:30},initial:{count:0},capabilities:['adjust']})}
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[]
try{for(const width of [320,432]){
 if(width===432)r.spec.sandboxModules.visual=await compileSandbox(jsx,{input:{n:30},initial:{count:0},capabilities:['adjust']})
 const page=await browser.newPage({viewport:{width,height:900}}),calls=[],errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/api/tools/invoke',async route=>{calls.push(route.request().url());await route.abort()})
 await page.route('**/api/sandbox/generate',async route=>{calls.push(route.request().url());await route.abort()})
 await page.addInitScript(spec=>{if(window!==window.top)return;localStorage.setItem('cardspec:render-mode:v1','hybrid');if(sessionStorage.getItem('qa-inline-seeded'))return;sessionStorage.clear();sessionStorage.setItem('qa-inline-seeded','1');sessionStorage.setItem('cardspec:conversation:v1',JSON.stringify({messages:[{id:'m',role:'assistant',format:'cardspec',status:'succeeded',phases:[{id:'p',kind:'cardspec',phase:'dsl',status:'succeeded',message:{status:'succeeded',metadata:{format:'cardspec',card_spec:spec}}}]}],toolsEnabled:false}))},r.spec)
 await page.goto(base);await page.getByRole('button',{name:'全屏查看卡片',exact:true}).click()
 const f=page.frameLocator('iframe[title="预编译视图"]');await expect(f.getByRole('button',{name:'本地计数 0'})).toBeVisible({timeout:15000})
 await f.getByRole('button',{name:'本地计数 0'}).click();await expect(f.getByRole('button',{name:'本地计数 1'})).toBeVisible()
 await f.getByRole('button',{name:'增加共享值'}).click();await expect(page.getByRole('slider',{name:'共享值'})).toHaveValue('35')
 await page.getByRole('slider',{name:'共享值'}).fill('50');await expect(f.getByText('共享值 50',{exact:true})).toBeVisible()
 await page.reload();await page.locator('.cs-sandbox').scrollIntoViewIfNeeded();await expect(page.getByRole('slider',{name:'共享值'})).toHaveValue('50');await expect(f.getByRole('button',{name:'本地计数 1'})).toBeVisible({timeout:15000})
 await page.locator('.cs-sandbox').evaluate(el=>el.style.marginTop='2000px');await page.waitForTimeout(150);await page.locator('.cs-sandbox').evaluate(el=>el.style.marginTop='0px');await page.locator('.cs-sandbox').scrollIntoViewIfNeeded();await expect(f.getByRole('button',{name:'本地计数 1'})).toBeVisible()
 if(width===432){await f.getByRole('button',{name:'测试局部异常'}).click();await expect(page.getByRole('alert')).toContainText('controlled runtime failure');await page.getByRole('slider',{name:'共享值'}).fill('60');await page.getByRole('button',{name:'重新启动视图',exact:true}).click();await expect(f.getByRole('button',{name:'本地计数 1'})).toBeVisible();await expect(f.getByText('共享值 60',{exact:true})).toBeVisible()}
 expect(calls).toEqual([]);expect(errors).toEqual([]);await page.locator('.cs-stage').screenshot({path:`${dir}/${base.includes('8792')?'cloud':'local'}-${width}.png`});results.push({width,load:true,bridge:true,stateRestore:true,offscreenRestore:true,...(width===432?{runtimeIsolation:true,localRetry:true}:{}),modelCalls:calls.length,errors});await page.close()
}
}finally{await browser.close()}
writeFileSync(`${dir}/${base.includes('8792')?'cloud':'local'}-browser.json`,JSON.stringify(results,null,2));console.log(results)
