import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises'
import {chromium} from 'playwright'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
const root='artifacts/flight-failure-review';await mkdir(root,{recursive:true})
const source=await readFile('artifacts/generation-debug/dd3f226b-76d2-425f-b658-bd4075ee7ad7/882ba0d00e377d0373ea/candidate.cardspec','utf8')
const result=compileCard(source,{final:true,cardId:'flight-review',context:{renderMode:'web',webGraphics:true,cardSize:'full'}});await validateRichContent(result)
if(!result.complete)throw Error(JSON.stringify(result.diagnostics))
const browser=await chromium.launch({channel:'chrome',headless:true})
try{
 const page=await browser.newPage({viewport:{width:432,height:1000}})
 await page.goto('http://127.0.0.1:8787/card-debug.html');await page.waitForFunction(()=>window.cardDebug)
 await page.evaluate(spec=>window.cardDebug.mount(spec,{size:'full'}),result.spec)
 const frame=page.frameLocator('.cs-web-sandbox iframe')
 await frame.getByRole('button',{name:'开始自由飞行',exact:true}).click()
 await frame.getByRole('button',{name:'跑道起飞',exact:true}).click()
 await page.waitForTimeout(600)
 const before=await page.evaluate(()=>window.cardDebug.snapshot().componentState)
 // Mirror the existing runner's non-atomic observation-to-save interval.
 await frame.locator('body').innerText();await frame.getByRole('button').allTextContents()
 const saved=await page.evaluate(()=>{window.cardDebug.save();return window.cardDebug.snapshot().componentState})
 await page.reload();await page.waitForFunction(()=>window.cardDebug)
 await page.evaluate(spec=>window.cardDebug.mount(spec,{size:'full',restore:true}),result.spec)
 await page.waitForFunction(()=>window.cardDebug.ready())
 const restored=await page.evaluate(()=>window.cardDebug.snapshot().componentState)
 await frame.getByRole('button',{name:'↑ 拉升',exact:true}).click()
 await frame.getByRole('button',{name:'← 左倾',exact:true}).click()
 await frame.getByRole('button',{name:'切换视角',exact:true}).click()
 await page.waitForTimeout(450)
 const interacted=await page.evaluate(()=>window.cardDebug.snapshot().componentState)
 await page.locator('.cs-stage').screenshot({path:root+'/flight-current-432.png'})
 const evidence={before,saved,restored,interacted,oldComparison:JSON.stringify(before)===JSON.stringify(restored),savedComparison:JSON.stringify(saved)===JSON.stringify(restored),scope:'Original final candidate, no source repair; isolated local browser; no CLI or model calls.'}
 await writeFile(root+'/restore-investigation.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence))
}finally{await browser.close()}
// Temporary instrumented copy: preserve production behavior, capture the exact
// state saved vs. the earlier comparison snapshot. Never replace the real runner.
const probe=new URL('../server/cardspec/debug-browser-flight-probe.mjs',import.meta.url)
let runner=await readFile(new URL('../server/cardspec/debug-browser.mjs',import.meta.url),'utf8')
runner=runner.replace('let restoredState','let restoredState,savedAtReload')
runner=runner.replace('await page.evaluate(()=>window.cardDebug.save());await page.reload()', 'savedAtReload=await page.evaluate(()=>{window.cardDebug.save();const s=window.cardDebug.snapshot();return [s.state,s.componentState]});await page.reload()')
runner=runner.replace('restored:JSON.stringify([before.state,before.componentState])===JSON.stringify(restoredState)', 'audit:{before:[before.state,before.componentState],savedAtReload,restoredState},restored:JSON.stringify([before.state,before.componentState])===JSON.stringify(restoredState)')
await writeFile(probe,runner)
try{
 const {runDebugBrowser}=await import(probe.href)
 const r=await runDebugBrowser(result.spec,{scenarios:['normal'],viewports:[432],size:'full',steps:[{op:'click',name:'开始自由飞行'},{op:'click',name:'跑道起飞'},{op:'reload'}],signal:AbortSignal.timeout(40000)})
 await writeFile(root+'/instrumented-runner.json',JSON.stringify(r,null,2))
 for(const run of r.runs)for(const action of run.actions)if(action.audit)console.log(JSON.stringify({restored:action.restored,exactSavedRestored:JSON.stringify(action.audit.savedAtReload)===JSON.stringify(action.audit.restoredState),audit:action.audit}))
}finally{await unlink(probe)}
