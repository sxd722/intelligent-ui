import {chromium} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const file='artifacts/adaptive-eval-v2/live-generation.json',r=JSON.parse(await readFile(file))
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1300,height:1100}}),checks=[],errors=[];let calls=0
page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message))
await page.route('**/api/tools/invoke',route=>{calls++;return route.abort()})
try{
 await page.goto('http://127.0.0.1:8787/adaptive-review.html')
 await page.getByLabel('案例',{exact:true}).selectOption('live-sources')
 const card=page.locator('.cs-card');await card.waitFor()
 assert.deepEqual(await card.locator('.cs-stat strong').allTextContents(),['2','2','4'])
 checks.push({label:'预取的两来源各2条，无重复取数',passed:true})
 await card.getByRole('radio',{name:'B站',exact:true}).check()
 const original=r.message.metadata.card_spec.prefetched.find(d=>d.tool==='opencli.bilibili.search').value.items[0]
 await card.getByRole('button',{name:original.title,exact:true}).click()
 assert.equal(await card.getByRole('link',{name:'在B站查看 ↗',exact:true}).getAttribute('href'),original.url)
 assert.equal(calls,0);checks.push({label:'筛选及原始链接可用，零额外工具调用',passed:true})
 await card.screenshot({path:'artifacts/adaptive-eval-v2/live-card.png'})
 await page.getByLabel('评估意见',{exact:true}).fill('QA temporary feedback: verify immutable artifact hash')
 const feedback=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('rsi-adaptive-feedback'))))
 assert.equal(feedback.length,1);assert.match(feedback[0].artifactHash,/^[a-f0-9]{64}$/);assert.equal(feedback[0].trainingEligible,false)
 await page.reload();await page.getByLabel('案例',{exact:true}).selectOption('live-sources')
 assert.match(await page.getByLabel('评估意见',{exact:true}).inputValue(),/QA temporary/)
 checks.push({label:'反馈绑定产物hash、刷新恢复、未取得训练资格',passed:true})
 await page.evaluate(()=>localStorage.removeItem('rsi-adaptive-feedback'))
 assert.deepEqual(errors,[])
}catch(e){checks.push({label:'真实产物回放',passed:false,reason:e.message});process.exitCode=1}
finally{await browser.close()}
r.qa={rendered:checks.some(x=>x.passed),checks,errors,smokePassed:checks.length===3&&checks.every(x=>x.passed),widths:[]}
await writeFile(file,JSON.stringify(r,null,2));console.log(JSON.stringify(r.qa))
