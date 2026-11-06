import {chromium} from '@playwright/test';import fs from 'node:fs/promises';
const root='artifacts/design-first-20261103',out=[];await fs.mkdir(root+'/screenshots',{recursive:true});const b=await chromium.launch({channel:'chrome',headless:true});
for(const id of ['host-weekend','image-weekend','host-observe']){
 const ctx=await b.newContext({viewport:{width:700,height:920}});await ctx.tracing.start({screenshots:true,snapshots:true});const p=await ctx.newPage(),errors=[],calls=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/\/api\/(chat|tools\/invoke)/.test(r.url()))calls.push(r.url())});const r={id,checks:{},layouts:[],errors};
 try{
  await p.goto('http://127.0.0.1:8787/design-first/viewer.html?id='+id,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.qaSession);await p.waitForTimeout(1500);
  const board=p.locator('.cs-task-board');r.checks.hostComposition=await board.count()===1;if(!r.checks.hostComposition)throw Error('模型未采用宿主候选构图，需人工检查该实现');
  const first=await board.locator('.tb-row').first().getAttribute('aria-label'),title=first.slice(3);
  await board.getByLabel('筛选候选入口').click();await board.getByLabel('筛选候选',{exact:true}).fill('__no_match__');r.checks.filterEmpty=await board.getByText('暂无匹配结果').isVisible();await board.getByLabel('筛选候选',{exact:true}).fill(title);r.checks.filterCandidate=await board.locator('.tb-row').count()===1;await board.getByLabel('筛选候选',{exact:true}).fill('');await board.getByLabel('收起筛选').click();
  await board.locator('.tb-pick').first().click();await board.getByLabel('后一组').click();await board.locator('.tb-pick').first().click();await board.getByRole('button',{name:'已选 2',exact:true}).click();r.checks.multiSelect=await board.locator('.tb-comparison article').count()===2;
  await board.locator('.tb-detail-pick').first().click();r.checks.details=(await board.locator('.tb-description').innerText()).length>30;await board.getByRole('button',{name:'← 返回候选',exact:true}).click();r.checks.returnPreservesSelection=await board.getByRole('button',{name:'已选 2',exact:true}).count()===1;
  if(await board.locator('.tb-apply').count()){await board.locator('.tb-apply').click();r.checks.apply=await board.locator('.tb-apply').innerText().then(t=>t.includes('已提交'));r.savedState=await p.evaluate(()=>window.qaScope().state)}else r.checks.apply=false;
  const before=await p.evaluate(()=>JSON.stringify(window.qaSession.current().viewState));await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.qaSession);await p.waitForTimeout(300);r.checks.reload=await p.locator('.cs-task-board').getByRole('button',{name:'已选 2',exact:true}).count()===1;r.checks.noModelReplay=calls.length===0;
  for(const width of [320,360,432])for(const size of ['square','auto']){
   await p.getByLabel('验收宽度').selectOption(String(width));await p.getByLabel('验收尺寸').selectOption(size);await p.waitForTimeout(300);const path=`screenshots/${id}-${width}-${size}.png`;await p.screenshot({path:root+'/'+path});const metrics=await p.locator('.cs-card').evaluate(card=>({overflow:card.scrollWidth-card.clientWidth,boardBody:[...card.querySelectorAll('.tb-body')].map(e=>({height:e.clientHeight,scroll:e.scrollHeight})),mockBody:[...card.querySelectorAll('.cs-mock-body')].map(e=>({height:e.clientHeight,scroll:e.scrollHeight})),images:[...card.querySelectorAll('img')].map(e=>({loaded:e.complete&&e.naturalWidth>0,url:e.currentSrc})),art:card.querySelector('.cs-mock-art')?.getBoundingClientRect().height||0}));r.layouts.push({width,size,path,...metrics});
  }
  r.checks.visibleContent=r.layouts.every(l=>l.boardBody.every(x=>x.height>50)&&l.overflow<2);
  if(id==='image-weekend'){r.checks.reusesGeneratedArt=r.layouts.every(l=>l.art>0);await p.route('**/api/media/**',route=>route.abort());await p.reload({waitUntil:'domcontentloaded'});await p.waitForTimeout(600);r.checks.imageFailureKeepsControls=await p.locator('.cs-task-board').getByLabel('筛选候选入口').isVisible();await p.screenshot({path:root+'/screenshots/image-failure.png'});}
 }catch(e){r.failure=e.message}
 finally{await ctx.tracing.stop({path:root+'/'+id+'-browser.zip'});await ctx.close()};out.push(r);console.log(JSON.stringify({id,checks:r.checks,failure:r.failure}));
}
await b.close();await fs.writeFile(root+'/acceptance.json',JSON.stringify(out,null,2));
