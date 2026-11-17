import {chromium} from 'playwright'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {createHash} from 'node:crypto'
const args=Object.fromEntries(process.argv.slice(2).map(x=>x.replace(/^--/,'').split('=')))
if(!args.run)throw Error('--run required')
const dir=resolve(args.run),artifact=JSON.parse(await readFile(join(dir,'result.json'),'utf8'))
if(!artifact.spec)throw Error('No exact compiled spec')
const out=join(dir,'live-browser-'+Date.now());await mkdir(out,{recursive:true})
const allowed=['opencli.wikipedia.search','opencli.wikipedia.page','opencli.wikipedia.summary'],origin='http://127.0.0.1:8787'
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:432,height:900}}),page=await context.newPage()
let requests=0;const evidence=[],blocked=[],errors=[]
page.on('pageerror',e=>errors.push(e.message))
await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.origin===origin&&req.method()==='POST'&&url.pathname==='/api/tools/invoke'){const p=req.postDataJSON();if(allowed.includes(p.tool)&&p.target==='binding'&&requests<12){requests++;return route.continue()}blocked.push({url:url.pathname,tool:p.tool,reason:'read allowlist/budget'});return route.abort()}
 if(url.origin===origin&&req.method()==='GET'&&(url.pathname==='/card-debug.html'||url.pathname.startsWith('/assets/')))return route.continue();blocked.push({url:url.origin+url.pathname,reason:'QA network boundary'});return route.abort()})
async function settle(){await page.waitForTimeout(300);await page.waitForFunction(()=>window.cardDebug?.ready()&&Object.values(window.cardDebug.snapshot().bindings||{}).every(b=>b.status!=='loading'),null,{timeout:25000}).catch(()=>{});await page.waitForTimeout(250)}
async function capture(label){const snapshot=await page.evaluate(()=>window.cardDebug.snapshot());const screenshot=label+'.png';await page.screenshot({path:join(out,screenshot),fullPage:true});evidence.push({label,snapshot,screenshot});await writeFile(join(out,'evidence.json'),JSON.stringify({sourceHash:createHash('sha256').update(artifact.source).digest('hex'),mode:'live-read',requests,evidence,blocked,errors},null,2));return snapshot}
async function clickObserved(snapshot,rx,role='button'){const c=snapshot.controls.filter(c=>c.role===role&&!c.disabled&&rx.test(c.name));if(c.length!==1){evidence.push({unverified:'ambiguous/absent control',pattern:String(rx),matches:c.map(c=>c.name)});return false}await page.getByRole(role,{name:c[0].name,exact:true}).click({timeout:3000});await settle();return true}
const mount=async restore=>{await page.goto(origin+'/card-debug.html');await page.waitForFunction(()=>window.cardDebug);await page.evaluate(({spec,allowed,restore})=>window.cardDebug.mount(spec,{width:432,size:'square',restore,persistenceKey:'experiment-live-'+spec.cardId,liveReadTools:allowed}),{spec:artifact.spec,allowed,restore});await settle()}
try{
 await mount(false);let s=await capture('01-initial')
 for(const [index,query] of ['bioluminescence','biofluorescence'].entries()){
  const fields=s.controls.filter(c=>c.role==='textbox'&&/查询|搜索|关键词|query|search|主题/i.test(c.name));if(fields.length===1){await page.getByRole('textbox',{name:fields[0].name,exact:true}).fill(query);await settle();s=await page.evaluate(()=>window.cardDebug.snapshot());await clickObserved(s,/^(搜索|查询|检索|Search)$/i);s=await capture(`0${index*3+2}-query`)}else {const c=s.controls.filter(c=>['button','tab','radio'].includes(c.role)&&!c.disabled&&c.name===query);if(c.length===1){await page.getByRole(c[0].role,{name:c[0].name,exact:true}).click();await settle();s=await capture(`0${index*3+2}-query`)}else evidence.push({unverified:'query control not uniquely observed'})}
  const read=[...s.calls].reverse().find(c=>c.tool==='opencli.wikipedia.search'&&c.result?.value?.items?.length),title=read?.result.value.items[0]?.title
  if(title){const controls=s.controls.filter(c=>c.role==='button'&&!c.disabled&&c.name.includes(title));if(controls.length===1){await page.getByRole('button',{name:controls[0].name,exact:true}).click();await settle();s=await capture(`0${index*3+3}-detail`)}else evidence.push({unverified:'returned entity is not a unique selectable control',title,matches:controls.map(c=>c.name)})}
  if(await clickObserved(s,/^(读取正文|查看正文|加载正文)$/)){s=await capture(`detail-loaded-${index}`)}
  if(index===0){await clickObserved(s,/固定|保存摘录|保存依据/);s=await capture('04-pin');await clickObserved(s,/返回|关闭详情|收起详情/);s=await page.evaluate(()=>window.cardDebug.snapshot())}
 }
 await clickObserved(s,/^(刷新|重新查询|更新资料)$/);await capture('08-refresh');await page.evaluate(()=>window.cardDebug.save());await mount(true);await capture('09-restored')
}catch(e){errors.push(e.message);await capture('error').catch(()=>{})}finally{await writeFile(join(out,'summary.json'),JSON.stringify({sourceHash:createHash('sha256').update(artifact.source).digest('hex'),mode:'live-read',requests,errors,blocked,evidenceCount:evidence.length,taskStatus:'requires independent semantic review',sourceUnmodified:true},null,2));await browser.close()}
console.log(out)
