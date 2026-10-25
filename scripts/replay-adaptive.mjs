import {chromium} from '@playwright/test'
import {mkdir,readdir,readFile,writeFile} from 'node:fs/promises'
const opts=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')))
const folders=(opts.input||'artifacts/direct-benchmark-2026-10-13').split(','),folder=opts.out||folders.at(-1),base=opts.base||'http://127.0.0.1:8787'
await mkdir(`${folder}/screenshots`,{recursive:true})
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'})
const results=[]
const records=new Map()
for(const input of folders)for(const file of (await readdir(input)).filter(f=>/^\d\d-.*-(cardspec|dil)\.json$/.test(f)))records.set(file,{input,record:JSON.parse(await readFile(`${input}/${file}`,'utf8'))})
for(const [file,{input,record}] of [...records].sort(([a],[b])=>a.localeCompare(b))){
 const r=record.result
 if(opts.cases&&!opts.cases.split(',').includes(r.id))continue
 const result={id:r.id,format:r.format,sourceFile:`${input}/${file}`, serverStatus:r.status,rendered:false,errors:[],widths:[],checks:[],trace:[]}
 const page=await browser.newPage({viewport:{width:1200,height:1000}});page.setDefaultTimeout(2500);page.setDefaultNavigationTimeout(15000)
 page.on('pageerror',e=>result.errors.push(e.message))
 // Replay recorded production SSE through the real app. No new model call.
 await page.route('**/api/chat',route=>route.fulfill({contentType:'text/event-stream',body:record.frames.map(({frame})=>`data: ${JSON.stringify(frame)}\n\n`).join('')+'data: [DONE]\n\n'}))
 await page.route('**/api/tools/invoke',route=>route.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({type:'error',error:'Replay is offline; external tools were not executed'})+'\n\n'}))
 await page.route('**/api/photo?**',route=>route.fulfill({status:503,json:{status:'error'}}))
 const card=page.locator(r.format==='cardspec'?'.cs-card':'.dil-card').last()
 const text=()=>card.innerText()
 const check=(condition,message)=>{if(!condition)throw new Error(message)}
 const button=name=>card.getByRole('button',{name}).first()
 const stat=async label=>Number(await card.locator('.cs-stat').filter({hasText:label}).locator('strong').first().innerText())
 const click=async name=>{const b=button(name);await b.click();await settle()}
 const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
 const assertText=async regex=>check(regex.test(await text()),`Expected ${regex}; visible: ${(await text()).slice(-500)}`)
 const step=async(label,fn)=>{try{await fn();result.checks.push({label,passed:true})}catch(e){result.checks.push({label,passed:false,reason:e.message.split('\n')[0],locatorUncertain:/Timeout|strict mode|locator\./.test(e.message)})}result.trace.push({step:label,text:await text().catch(()=>''),errors:await page.locator('[data-cs-error],.cs-action-error').allTextContents()})}
 try{
  await page.goto(base)
  await page.getByLabel('渲染协议').selectOption(r.format)
  // Replay starts in direct mode; no model or tool calls are needed.
  await page.getByPlaceholder('描述你想要的交互卡片…').fill(record.prompt)
  await page.getByRole('button',{name:'发送',exact:true}).click()
  await page.getByRole('button',{name:'停止',exact:true}).waitFor({state:'hidden',timeout:10000})
  await settle()
  result.rendered=await card.count()>0 && (await text()).trim().length>0
  result.fallbackOnly=r.format==='dil'&&!result.rendered&&await page.locator('.msg-assistant').count()>0
  if(!result.rendered)throw new Error(result.fallbackOnly?'DIL silently fell back to prose; no interactive .dil-card':'No rendered interactive card')
  for(const width of [320,360,432])for(const size of ['square','auto']){
   await page.getByLabel('卡片尺寸',{exact:true}).selectOption(size)
   await page.locator('.dil-stage').last().evaluate((el,width)=>{el.style.width=`${width}px`;el.style.maxWidth='none'},width)
   await page.waitForTimeout(150)
   result.widths.push(await page.locator('.dil-stage').last().evaluate(el=>({width:el.clientWidth,height:el.clientHeight,horizontalOverflow:el.scrollWidth>el.clientWidth+1,fit:el.dataset.csFit||null,density:el.dataset.csDensity||el.dataset.alDensity,scrollFallback:el.classList.contains('al-scroll')||el.querySelector('.cs-card')?.dataset.emergency==='true',smallestText:Math.min(...[...el.querySelectorAll('*')].filter(n=>n.children.length===0&&n.textContent.trim()).map(n=>parseFloat(getComputedStyle(n).fontSize))),clampedText:[...el.querySelectorAll('*')].filter(n=>parseInt(getComputedStyle(n).webkitLineClamp)>0&&n.scrollHeight>n.clientHeight+1).map(n=>({text:n.textContent.slice(0,100),lines:getComputedStyle(n).webkitLineClamp}))})))
  }
  await page.getByLabel('卡片尺寸',{exact:true}).selectOption('square')
  result.initialText=await text()
  await page.locator('.dil-stage').last().screenshot({path:`${folder}/screenshots/${file.replace('.json','-initial.png')}`,animations:'disabled'})
  const inputs=card.locator('input:not([type=checkbox]):not([type=range]),textarea')
  if(r.id==='01-counter'){
   await step('备注与加减归零',async()=>{await inputs.first().fill('QA保留');await click(/^增加$/);await click(/^增加$/);await assertText(/\b2\b/);await click(/^减少$/);await assertText(/\b1\b/);await click(/^归零$/);check(await inputs.first().inputValue()==='QA保留','note lost');await assertText(/\b0\b/);if(await button(/^减少$/).isEnabled())await click(/^减少$/);check(!/[-−]\s*1\b/.test((await text()).replace(/\d{4}-\d{2}-\d{2}/g,'')),'count below zero')})
  }else if(r.id==='02-water'){
   await step('8杯上限、撤销与重置',async()=>{for(let i=0;i<8;i++)await click(/记录一杯/);await assertText(/8/);if(await button(/记录一杯/).isEnabled())await click(/记录一杯/);check(!/\b9\b/.test(await text()),'count exceeded 8');await click(/撤销一杯/);await assertText(/7/);await click(/^重置$/);await assertText(/0/)})
  }else if(r.id==='03-checklist'){
   await step('勾选更新计数',async()=>{await card.getByRole('checkbox').first().check();await assertText(/1\s*(?:\/|项|个|，|已)/)})
   await step('第20项可达',async()=>{for(let i=0;i<20;i++){const last=card.getByText(/^任务\s*20$/).first();if(await last.count()){await last.scrollIntoViewIfNeeded();return}const next=button(/下一页|下一项|›/);if(!(await next.count())||!await next.isEnabled())break;await click(/下一页|下一项|›/)}throw new Error('Task20 not reachable')})
  }else if(r.id==='04-filter'){
   await step('搜索、分类与勾选保持',async()=>{await card.getByRole('checkbox').first().check();await card.getByText('电子',{exact:true}).first().click();await inputs.first().fill('充电');await assertText(/充电器/);check(!/护照|身份证|外套|雨伞/.test(await text()),'filter retained unrelated items');await inputs.first().fill('');await card.getByText('全部',{exact:true}).first().click();check(await card.getByRole('checkbox').first().isChecked(),'selection lost after filter')})
  }else if(r.id==='05-expenses'){
   await step('同名记录、删除与合计',async()=>{await inputs.nth(0).fill('QA支出');await inputs.nth(1).fill('10');await click(/^添加$/);await inputs.nth(0).fill('QA支出');await inputs.nth(1).fill('5');await click(/^添加$/);await assertText(/15/);await click(/删除/);check((await text()).split('QA支出').length-1===1,'deletion removed both duplicates or none');await assertText(/5|10/)})
  }else if(r.id==='06-calculator'){
   await step('费用派生重算',async()=>{await assertText(/132/);await assertText(/44/);check(/132\.00/.test(await text())&&/44\.00/.test(await text()),'required fixed two decimals not displayed');const people=card.getByRole('slider',{name:'人数',exact:true});if(await people.count())await people.fill('4');else await inputs.nth(1).fill('4');await assertText(/33/);if(await people.count()){await people.focus();await people.press('Home');check(Number(await people.inputValue())>=1,'people slider allows zero')}else await inputs.nth(1).fill('0');check(!/Infinity|NaN/.test(await text()),'invalid numeric result')})
  }else if(r.id==='07-form'){
   await step('表单校验、确认与返回',async()=>{check(!await button(/确认报名/).isEnabled(),'initial confirm should be disabled');await inputs.first().fill('测试姓名');await card.getByText('下午',{exact:true}).first().click();await card.getByRole('checkbox').first().check();await click(/确认报名/);await assertText(/测试姓名/);await assertText(/下午/);await click(/返回修改/);check(await inputs.first().inputValue()==='测试姓名','name lost')})
  }else if(r.id==='08-calendar'){
   await step('闰日选择和空日期',async()=>{await click(/2028-02-29|^29$/);await assertText(/闰日读书会/);await click(/2028-02-03|^3$/);await assertText(/暂无新闻/)})
   await step('换月再返回',async()=>{await click(/下个月|下月/);await assertText(/3月|2028-03|2028年3/);await click(/上个月|上月/);await click(/2028-02-29|^29$/);await assertText(/闰日读书会/)})
  }else if(r.id==='09-carousel'){
   await step('轮播条目独立备注',async()=>{const first=inputs.nth(0),second=inputs.nth(1);await first.fill('第一步备注');await click(/下一项|下一页|Next|›/);await page.waitForTimeout(400);await second.fill('第二步备注');await click(/上一项|上一页|Previous|‹/);await page.waitForTimeout(400);check(await first.inputValue()==='第一步备注','first note overwritten');check(await second.inputValue()==='第二步备注','second note lost')})
  }else if(['10-chart','11-mindmap','12-flowchart'].includes(r.id)){
   const label={'10-chart':'周二','11-mindmap':'项目','12-flowchart':'审核'}[r.id]
   await step('数据点或节点联动',async()=>{const before=await text();await card.getByText(label,{exact:true}).first().click();await settle();check(await text()!==before,'no visible detail update');if(r.id==='11-mindmap')await assertText(/做一个小作品检验理解/);if(r.id==='10-chart')await assertText(/-10/)})
  }else if(r.id==='13-reading'){
   await step('长正文完整性与已读开关',async()=>{check((await text()).length>=480,'less than required 8×60 characters in visible content; inspect collapsed/paginated alternatives');const toggles=card.getByRole('checkbox').or(card.getByRole('switch'));await toggles.first().check();check(await toggles.first().isChecked(),'toggle unchanged')})
  }else if(r.id==='14-quiz'){
   await step('三题完成和重开',async()=>{for(const answer of [/^(?:.*[.、\s])?4$/,/H2O/,/火星/]){await click(answer);const next=button(/下一题|看得分|查看得分|查看结果|完成练习/);if(await next.count()&&await next.isEnabled())await click(/下一题|看得分|查看得分|查看结果|完成练习/)}await assertText(/3/);await click(/重新开始/);await assertText(/2\s*\+\s*2/)})
  }else if(r.id==='15-resource-game'){
   await step('三次精致餐耗尽食材并重开',async()=>{for(let i=0;i<3;i++){await click(/精致餐/);const meal=button(/精致餐/);if(await meal.count())check(!await meal.isEnabled(),'same turn can consume twice');const next=button(/下一回合/);if(await next.count()&&await next.isEnabled())await click(/下一回合/)}await assertText(/结算|结束|食材不足|耗尽|终/);await click(/重新开始/);await assertText(/6/)})
  }else if(r.id==='16-delayed-story'){
   await step('七天选择与继续循环',async()=>{for(let day=1;day<=7;day++){const options=card.locator('button:enabled').filter({hasNotText:/继续|迎来结局|进入结局|查看结局|重开|重新开始|规则|说明|关闭/});check((await options.first().innerText()).match(/[+−-]\d/),'choice cost is not visible before decision');await options.first().click();await settle();const next=button(/继续|迎来结局|进入结局|查看结局/);if(await next.count()&&await next.isEnabled())await click(/继续|迎来结局|进入结局|查看结局/)}check(await button(/重新开始|重新开园|重开/).count()>0,'ending has no restart');check(await card.locator('button:enabled').filter({hasText:/[+−-]\d/}).count()===0,'choices remain active after day seven');await click(/重新开始|重新开园|重开/);await assertText(/1|一/)} )
  }else if(r.id==='17-card-battle'){
   await step('法力、每回合限制与敌方攻击',async()=>{await click(/火球/);await assertText(/7/);check(await stat(/法力/)===1,'resource cost was not deducted');check(!await button(/火球/).isEnabled(),'fireball reusable this turn');await click(/结束回合/);await assertText(/8/);check(await button(/火球/).isEnabled(),'fireball not reset');await click(/火球/);await assertText(/4/)})
   if(r.format==='cardspec')await step('法力恢复语义与非零生命不能判胜',async()=>{const before=await stat(/法力/);await click(/结束回合/);const restored=await stat(/法力/);const explicit=/恢复到3|恢复为3/.test(record.prompt);check(restored===3||(!explicit&&restored===before+3),'resource restore violates stated rule');result.resourceInterpretation=restored===3?'set to 3':'add 3 (original wording is ambiguous)';await click(/火球/);check(!/胜利|倒下|被击败/.test(await text()),'victory occurred with enemy HP=1')})
   if(r.format==='cardspec')await step('治疗费用、胜负与重开',async()=>{
    const hpBefore=await stat(/你的生命|玩家生命|我方生命|我方HP|玩家HP/)
    const manaBefore=await stat(/法力/);await click(/治疗/);check(await stat(/法力/)===manaBefore-1,'heal cost was not deducted');check(await stat(/你的生命|玩家生命|我方生命|我方HP|玩家HP/)===Math.min(10,hpBefore+2),'heal amount incorrect')
    await click(/结束回合/);await click(/火球/);check(await stat(/敌人生命|敌方生命|敌人HP|敌方HP/)===0,'enemy is not defeated');check(await stat(/你的生命|玩家生命|我方生命|我方HP|玩家HP/)>0,'player did not survive')
    const end=button(/结束回合/);if(await end.count())check(!await end.isEnabled(),'combat remains active after victory')
    await click(/重新开始/);check(await stat(/法力/)===3,'restart quota incorrect')
    for(let i=0;i<5;i++)await click(/结束回合/)
    await assertText(/失败|战败|输了|落败|败北|被击败/);await click(/重新开始/);check(await stat(/法力/)===3,'restart failed')
   })
  }else if(r.id==='18-chronicle'){
   await step('时代与事件详情联动',async()=>{await card.getByText('泰拉围攻',{exact:true}).first().click();await assertText(/皇宫决战/);await card.getByText('40K',{exact:true}).first().click();await assertText(/银河分裂/);await card.getByText('不屈远征',{exact:true}).first().click();await assertText(/舰队出征/)})
  }else if(r.id==='19-media'){
   await step('独立收藏',async()=>{const controls=card.getByRole('button',{name:/收藏|小鸟|绿叶/}).or(card.getByRole('switch',{name:/收藏/})).or(card.getByRole('checkbox',{name:/收藏/}));check(await controls.count()>=2,'cannot identify two bookmark controls');await controls.nth(0).click();await controls.nth(1).click();await assertText(/2/)})
  }else if(r.id==='32-quota'){
   await step('固定恢复与增量补充',async()=>{await click(/^使用一次$/);await assertText(/2/);await click(/^恢复到3$/);await assertText(/3/);await click(/^补充3点$/);await assertText(/6/);await click(/^重新开始$/);await assertText(/3/)})
  }else if(r.id==='20-cart'){
   await step('购物车结算快照',async()=>{const plus=card.getByRole('button',{name:/^[+＋]$|^增加/});await plus.nth(0).click();await plus.nth(0).click();await plus.nth(1).click();await plus.nth(1).click();await assertText(/22/);await assertText(/17/);await click(/^结算/);await assertText(/17/);await plus.nth(0).click();await assertText(/17/)})
  }
  result.finalText=await text()
  result.errors.push(...await page.locator('[data-cs-error],.cs-action-error').allTextContents())
  await page.locator('.dil-stage').last().screenshot({path:`${folder}/screenshots/${file.replace('.json','-after.png')}`,animations:'disabled'})
 }catch(e){result.errors.push(e.message.split('\n')[0]);await page.screenshot({path:`${folder}/screenshots/${file.replace('.json','-failure.png')}`}).catch(()=>{})}
 result.smokePassed=result.rendered&&!result.errors.length&&result.checks.length>0&&result.checks.every(c=>c.passed)
 await page.close();results.push(result);await writeFile(`${folder}/replay.json`,JSON.stringify(results,null,2))
 console.log(`${r.id} ${r.format}: rendered=${result.rendered}; checks=${result.checks.filter(c=>c.passed).length}/${result.checks.length}; errors=${result.errors.join(';')}`)
}
await browser.close()
