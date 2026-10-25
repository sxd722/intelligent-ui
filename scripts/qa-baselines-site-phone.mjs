import {chromium} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
const cards=JSON.parse(await readFile('shared/cardspec/baselines/generated.json','utf8'))
const base='http://127.0.0.1:8792/cardspec-showcase/index.html'
const b=await chromium.launch({channel:'chrome',headless:true}),results=[]
try{
 for(const card of cards)for(const width of [320,360,432]){
  const p=await b.newPage({viewport:{width,height:850}})
  await p.goto(base+'?case='+card.id+'&mode=live')
  await p.locator('.cs-logic[aria-busy=false]').waitFor()
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'phone document overflow')
  assert.equal(await p.locator('.cs-card [role=alert]').count(),0)
  const download=p.waitForEvent('download');await p.getByRole('button',{name:'下载完整 DSL',exact:true}).click()
  const file=await download,content=await readFile(await file.path())
  assert.equal(createHash('sha256').update(content).digest('hex'),card.sha256)
  await p.getByLabel('本例反馈',{exact:true}).fill('演示反馈 '+card.id)
  await p.reload();await p.locator('.cs-logic[aria-busy=false]').waitFor()
  assert.equal(await p.getByLabel('本例反馈',{exact:true}).inputValue(),'演示反馈 '+card.id)
  const traceEvent=p.waitForEvent('download');await p.getByRole('button',{name:'导出反馈与 trace',exact:true}).click()
  const trace=JSON.parse(await readFile(await (await traceEvent).path(),'utf8'))
  assert.equal(trace.artifactHash,card.sha256);assert.equal(trace.trainingEligible,false);assert.equal(trace.mode,'fixture')
  if(width===360)await p.screenshot({path:'artifacts/native-baselines/site-ui/phone-'+card.id+'.png',fullPage:true})
  results.push({id:card.id,width,passed:true,checks:['phone-no-overflow','canonical-download','feedback-restore','feedback-hash-and-demo-mode']})
  await p.close()
 }
}finally{await b.close()}
await writeFile('artifacts/native-baselines/site-ui/phone-results.json',JSON.stringify(results,null,2))
console.log(JSON.stringify({passed:results.length,total:15}))
