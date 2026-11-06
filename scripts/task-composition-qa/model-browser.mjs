import {readFile,writeFile} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import assert from 'node:assert/strict'
import {loadApiKey} from '../../server/env.mjs'
import {createModelClient} from '../../server/research/model-client.mjs'
import {compileCard} from '../../shared/cardspec/compiler.mjs'
import {cases,ROOT,DEST} from './cases.mjs'
const rows=JSON.parse(await readFile(ROOT+'/model4.json','utf8')),browser=await chromium.launch({channel:'chrome',headless:true})
const key=loadApiKey(),round=createModelClient({base:process.env.MODEL_BASE_URL||'https://model-gateway.example.invalid/v1',key:key.value,model:'deepseek-v4-flash'})
async function inspect(r,width){
 const p=await browser.newPage({viewport:{width:width+24,height:700}}),checks=[],errors=[];p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(e.message))
 const check=async(name,fn)=>{try{await fn();checks.push({name,passed:true})}catch(e){checks.push({name,passed:false,error:e.message.slice(0,500)})}}
 try{
 await p.goto(`http://127.0.0.1:8787/task-composition-qa.html?id=${r.id}&width=${width}`);await p.waitForFunction(()=>window.qaView?.().items.length>0,{},{timeout:7000})
 await check('complete-candidate-set',async()=>assert.equal(await p.evaluate(()=>window.qaView().items.length),r.case==='feed'?4:2))
 await check('selection-and-dependent-result',async()=>{
  await p.getByRole('button',{name:'候选',exact:true}).click();await p.locator('.tb-row').nth(1).click()
  await p.waitForFunction(()=>window.qaView().focus!==null,{},{timeout:7000})
  if(r.case!=='feed')await p.waitForFunction(()=>window.qaView().related[0]?.title.startsWith(window.qaView().focus.title),{},{timeout:7000})
  else assert.equal(await p.evaluate(()=>window.qaCalls.length),0,'内容合并不应触发新的搜索')
 })
 await check('details-return',async()=>{await p.getByRole('button',{name:'关联资料',exact:true}).click();await p.locator('[data-focus-title]').waitFor();await p.getByRole('button',{name:'候选',exact:true}).click();assert.equal(await p.locator('.tb-row[aria-pressed=true]').count(),1)})
 if(r.case==='trip')await check('date-is-linked',async()=>{await p.getByRole('combobox',{name:'出游日期'}).selectOption('2026-11-05');assert.equal(await p.evaluate(()=>window.qaView().observations[0]?.summary),'雨');await p.getByRole('button',{name:'地图',exact:true}).click();assert.equal(await p.locator('.cs-map-pin[aria-pressed=true]').count(),1)})
 if(r.case==='feed')await check('source-filter',async()=>{await p.getByRole('button',{name:'xiaohongshu',exact:true}).click();assert.equal(await p.locator('.tb-row').count(),2)})
 const calls=await p.evaluate(()=>window.qaCalls)
 await check('restore',async()=>{const selected=await p.evaluate(()=>window.qaView().focus?.id);await p.evaluate(()=>window.qaSession.save());await p.reload();await p.waitForFunction(()=>window.qaView?.().items.length>0,{},{timeout:7000});assert.equal(await p.evaluate(()=>window.qaView().focus?.id),selected);assert.equal(await p.evaluate(()=>window.qaCalls.length),0)})
 await check('runtime-and-width',async()=>{assert.deepEqual(errors,[]);assert.ok(await p.locator('.cs-stage').evaluate(e=>e.scrollWidth<=e.clientWidth+2))})
 const screenshot=r.id+'-'+width+'-model.png';await p.locator('.cs-stage').screenshot({path:ROOT+'/'+screenshot});return {width,checks,passed:checks.every(c=>c.passed),calls,screenshot}
 }catch(e){return {width,checks,passed:false,error:e.message}}finally{await p.close()}
}
try{for(const r of rows){
 r.browser=[];for(const w of [320,432])r.browser.push(await inspect(r,w));r.firstBrowserPass=r.browser.every(x=>x.passed)
 if(!r.firstBrowserPass){
  const previous=JSON.parse(await readFile(ROOT+'/'+r.id+'-trace.json','utf8')),feedback=r.browser.flatMap(b=>[b.error,...(b.checks||[]).filter(x=>!x.passed).map(x=>x.name+': '+x.error)]).filter(Boolean)
  const messages=[...previous.messages,{role:'assistant',content:r.source},{role:'user',content:'浏览器检查失败：'+JSON.stringify([...new Set(feedback)])+'。满足原需求，仅修正接线。合并多个内容来源用已有的两个binding一起compose，来源筛选与详情/返回已由task-board提供；此任务不需要按内容标题再次搜索。若是地点/电影关联，则继续保留依赖选择的搜索。只输出完整card。'}]
  const start=Date.now(),response=await round(messages,{temperature:.3,maxTokens:3000,thinking:{type:'disabled'},signal:AbortSignal.timeout(90000)}),source=response.message.content.trim().replace(/^```[^\n]*\n|\n```$/g,''),compiled=compileCard(source,{final:true,cardId:r.id,context:{expressionDialect:'js-v1'}})
  r.beforeRepair={source:r.source,browser:r.browser};r.repairMs=Date.now()-start;r.repairComplete=compiled.complete;r.repairDiagnostics=compiled.diagnostics
  await writeFile(ROOT+'/'+r.id+'-repair-trace.json',JSON.stringify({messages,response,ms:r.repairMs},null,2))
  if(compiled.complete){compiled.spec.prefetched=r.spec.prefetched;r.source=source;r.spec=compiled.spec;await writeFile(DEST+'/runs/'+r.id+'.json',JSON.stringify(r));r.browser=[];for(const w of [320,432])r.browser.push(await inspect(r,w))}
 }
 r.passed=r.browser.every(b=>b.passed);console.log(JSON.stringify({id:r.id,firstBrowserPass:r.firstBrowserPass,passed:r.passed,repairMs:r.repairMs}));await writeFile(ROOT+'/model-verified.json',JSON.stringify(rows,null,2))
}}finally{await browser.close()}
