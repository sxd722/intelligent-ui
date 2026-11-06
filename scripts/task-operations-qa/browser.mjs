import {chromium} from '@playwright/test'
import {readFile,writeFile,copyFile} from 'node:fs/promises'
import {CASES,ROOT,DEST,env} from './cases.mjs'
import {taskDataset} from '../../shared/cardspec/task-operations.mjs'
import {detailRequests} from '../../shared/cardspec/result-view.mjs'
import {auditFixedRoles} from '../../shared/cardspec/task-gates.mjs'
export async function inspectTask(browser,c,id,width,size){
 const p=await browser.newPage({viewport:{width:width+40,height:950}});p.setDefaultTimeout(2200);const checks=[],errors=[],calls=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/api/**',r=>r.abort())
 const check=async(name,f)=>{try{await f();checks.push({name,passed:true})}catch(e){checks.push({name,passed:false,error:e.message.slice(0,240)})}},assert=(v,m)=>{if(!v)throw Error(m)}
 const card=p.locator('.cs-card'),visit=async fn=>{if(await fn())return true;const dots=p.getByRole('button',{name:/卡片页面：第 \d+ 屏/});for(let i=0;i<await dots.count();i++){await dots.nth(i).click();await p.waitForTimeout(210);if(await fn())return true}return false}
 try{
  await p.goto(`http://127.0.0.1:8787/task-operations-qa/viewer.html?id=${id}&width=${width}&size=${size}`);await p.waitForFunction(()=>!!window.qaSession);await p.waitForTimeout(150)
  for(const [index,s]of c.sources.entries()){
   const expected=taskDataset(s.tool,env(s.rows),{input:s.input,task:s.task}),key=await p.evaluate(({tool,input})=>Object.entries(window.qaSession.current().spec.bindings).find(([k,b])=>b.tool===tool&&JSON.stringify(window.qaSession.current().bindings[k]?.valueInputKey?JSON.parse(window.qaSession.current().bindings[k].valueInputKey):null)===JSON.stringify(input))?.[0],s)
   // Binding matching uses parameter equality independent of JSON key order.
   const binding=key||await p.evaluate(({tool,input})=>Object.entries(window.qaSession.current().spec.bindings).find(([k,b])=>{const raw=window.qaSession.current().bindings[k]?.inputKey;const v=raw?JSON.parse(raw):{};return b.tool===tool&&Object.entries(input).every(([k,x])=>v[k]===x)})?.[0],s)
   const region=card.locator('[data-task-binding='+JSON.stringify(binding||'missing')+']');await visit(()=>region.isVisible())
   await check(index+'-constraints-from-original-task',async()=>{
    assert(await region.count()===1,'Missing host task view')
    const input=region.getByRole('textbox',{name:'筛选候选名称'})
    for(const r of expected.items){await input.fill(r.title);const visible=await region.locator('.task-candidate').count();assert(visible===(expected.eligible.some(x=>x.key===r.key)?1:0),'Constraint leak or missing eligible row: '+r.title)}
    await input.fill('')
   })
   await check(index+'-selection-and-result',async()=>{
    const wanted=expected.eligible.slice(0,s.task.selection==='multiple'?2:1)
    for(const r of wanted){await region.getByRole('textbox',{name:'筛选候选名称'}).fill(r.title);await region.getByRole('button',{name:(s.task.pin?'固定 ':'选择 ')+r.title,exact:true}).click()}
    await region.getByRole('textbox',{name:'筛选候选名称'}).fill('')
    await region.getByRole('button',{name:new RegExp('^'+(s.task.pin?'已固定':'已选')+' ')}).click()
    for(const r of wanted)assert((await region.locator('.task-selection').innerText()).includes(r.title),'Selected result absent')
    if(s.task.pin){const receipt=region.locator('[data-task-pinned]'),a=auditFixedRoles({required:[{name:s.task.pin,input:s.input}],results:[{role:s.task.pin,input:s.input,key:await receipt.getAttribute('data-task-pinned'),visible:await receipt.isVisible()}]});assert(a.status==='passed','Fixed receipt missing');assert((await receipt.innerText()).includes(s.input.date),'Date missing from pinned result')}
    if(s.task.compare){await region.getByRole('button',{name:'比较',exact:true}).click();for(const r of wanted)assert((await region.locator('table').innerText()).includes(r.title),'Compare omits selected object')}
    await region.getByRole('button',{name:/^候选 /}).click()
   })
   const row=expected.eligible[0],original=row&&expected.records[row.rawRef],request=original&&detailRequests(s.tool,original,s.input).find(q=>q.kind==='facts')
   if(request)await check(index+'-detail-identity-new-information-return',async()=>{
    await region.getByRole('textbox',{name:'筛选候选名称'}).fill(row.title);await region.getByRole('button',{name:'查询详情 '+row.title,exact:true}).click()
    await region.locator('[data-task-detail-audit="passed"]').waitFor();assert((await region.innerText()).includes('新增证据：'+row.title),'No new detail information')
    const invocations=await p.evaluate(()=>window.qaCalls);assert(invocations.some(x=>x.tool===request.tool&&Object.entries(request.input).every(([k,v])=>x.input[k]===v)),'Wrong business ID/context')
    await region.getByRole('button',{name:/^候选 /}).click();await region.getByRole('textbox',{name:'筛选候选名称'}).fill('')
   })
  }
  await check('refresh-restores-host-selections',async()=>{
   const before=await p.evaluate(()=>window.qaSession.current().viewState.components)
   await p.evaluate(()=>window.qaSession.save());await p.reload();await p.waitForFunction(()=>!!window.qaSession);await p.waitForTimeout(150)
   const after=await p.evaluate(()=>window.qaSession.current().viewState.components)
   const selections=v=>JSON.stringify(Object.values(v||{}).filter(x=>x.task).map(x=>x.task.selection))
   assert(selections(before)===selections(after),'Selection lost after refresh')
  })
  await check('no-error-or-horizontal-overflow',async()=>{assert(!errors.length,errors.join(';'));assert(!await card.locator('[data-task-audit="failed"],[data-cs-error],.cs-node-recovery').count(),'Host error');assert(await card.evaluate(e=>e.scrollWidth<=e.clientWidth+2),'Card horizontal overflow')})
  calls.push(...await p.evaluate(()=>window.qaCalls))
 }catch(e){checks.push({name:'page',passed:false,error:e.message.slice(0,240)})}
 const screenshot=`${id}-${width}-${size}.png`;await p.screenshot({path:ROOT+'/'+screenshot});await copyFile(ROOT+'/'+screenshot,DEST+'/'+screenshot);await p.close();return {id,case:c.id,width,size,passed:checks.every(c=>c.passed),checks,calls,screenshot}
}
if(process.argv[1]?.endsWith('browser.mjs')){
 const results=[],browser=await chromium.launch({channel:'chrome',headless:true}),jobs=CASES.flatMap(c=>[320,360,432].flatMap(width=>['square','auto'].map(size=>({c,width,size}))))
 try{await Promise.all(Array.from({length:3},async()=>{while(jobs.length){const {c,width,size}=jobs.shift(),r=await inspectTask(browser,c,c.id,width,size);results.push(r);console.log(JSON.stringify({id:r.id,width,size,passed:r.passed,fail:r.checks.filter(c=>!c.passed)}))}}))}finally{await browser.close()}
 await writeFile(ROOT+'/native-browser.json',JSON.stringify(results,null,2))
}
