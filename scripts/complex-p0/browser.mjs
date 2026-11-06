import {chromium} from '@playwright/test'
import fs from 'node:fs/promises'
import {ROOT,cases} from './cases.mjs'
await fs.mkdir(ROOT+'/screenshots',{recursive:true})
const browser=await chromium.launch({channel:'chrome',headless:true})
const results=[]
for(const c of cases.filter(c=>!process.env.CUJ_ONLY||c.id===process.env.CUJ_ONLY)){
 let run;try{run=JSON.parse(await fs.readFile(ROOT+'/'+c.id+'.json'))}catch{continue}
 const page=await browser.newPage({viewport:{width:900,height:1000}});page.setDefaultTimeout(2200)
 const r={id:c.id,generationStatus:run.status,checks:[],screenshots:[],errors:[]};page.on('pageerror',e=>r.errors.push(e.message))
 const state=()=>page.evaluate(()=>window.qaSession?.current().store.values)
 const scope=()=>page.evaluate(()=>{const s=window.qaScope();return {data:{...s.data},derived:{...s.derived}}})
 const settle=()=>page.waitForTimeout(750)
 const reach=async l=>{if(await l.isVisible())return;const nav=page.getByRole('button',{name:/卡片页面：第 \d+ 屏/});for(let i=0;i<await nav.count();i++){await nav.nth(i).click();await settle();if(await l.isVisible())return}throw Error('control not reachable')}
 const button=async name=>{const l=page.getByRole('button',{name,exact:true}).first();await reach(l);await l.click();await settle()}
 const fill=async(name,value,n=0)=>{const l=page.getByLabel(name,{exact:true}).nth(n);await reach(l);await l.fill(String(value));await settle()}
 const radio=async name=>{const l=page.getByRole('radio',{name,exact:true});await reach(l);await l.click();await settle()}
 const shot=async suffix=>{await settle();const file=`screenshots/${c.id}-${suffix}.png`;await page.screenshot({path:ROOT+'/'+file});r.screenshots.push(file)}
 const check=async(name,fn)=>{try{const actual=await fn();r.checks.push({name,status:actual.pass?'pass':actual.status||'fail',actual})}catch(e){r.checks.push({name,status:'fail',error:e.message.slice(0,400)})}await shot(name);r.checks.at(-1).state=await state()}
 try{
 await page.goto('http://127.0.0.1:8787/complex-p0/viewer.html?id='+c.id);await page.waitForFunction(()=>window.qaSession,{},{timeout:6000});await settle();await shot('initial')
 if(c.id==='trip'){
  await check('filter',async()=>{await button('北干');const s=await scope();await button('全部');return {pass:s.derived.shown.length<s.data.places.length}})
  await check('select-plan',async()=>{const data=(await scope()).data;for(const p of data.places.slice(0,2)){const l=page.getByRole('button').filter({hasText:p.name}).first();await reach(l);await l.click()}await button('生成两天行程');return {state:await state(),pass:!!(await state()).plan}})
  await check('constraints-and-detail',async()=>({pass:false,reason:'生成源码无详情binding；预算/年龄不参与约束分支，已被新增门控识别'}))
 }
 if(c.id==='movie'){
  await check('filter',async()=>{await radio('科幻');const a=await state();await radio('全部');return {pass:a.genre!==(await state()).genre}})
  await check('compare',async()=>{for(let i=0;i<2;i++){const l=page.getByRole('button',{name:'选',exact:true}).nth(i);await reach(l);await l.click();await settle()}await button('比较已选两部');return {pass:(await state()).picks.length===2,text:await page.locator('main').innerText()}})
  await check('detail',async()=>{await button('详情');await page.waitForTimeout(1800);return {pass:!!(await state()).detailId,calls:await page.evaluate(()=>window.qaCalls),text:await page.locator('main').innerText()}})
  await check('return',async()=>{const a=await state();await button('返回比较');return {pass:JSON.stringify(a.picks)===JSON.stringify((await state()).picks)}})
 }
 if(c.id==='sentiment'){
  await check('filter',async()=>{const l=page.getByLabel('来源',{exact:true});await reach(l);const opts=await l.locator('option').evaluateAll(es=>es.map(e=>e.value));await l.selectOption(opts.at(-1));return {pass:(await scope()).derived.filtered.length<(await scope()).data.items?.length,options:opts}})
  await check('evidence-detail',async()=>{const title=(await scope()).derived.filtered?.[0]?.title;if(!title)return {pass:false};const l=page.getByRole('button').filter({hasText:title}).first();await reach(l);await l.click();return {pass:!!(await state()).sel,text:await page.locator('main').innerText(),calls:await page.evaluate(()=>window.qaCalls)}})
  await check('classification-and-timeline',async()=>({pass:false,reason:'需按正文分类/分母和日期逐项核对，不能以列表/点击选中算分析完成',dataKeys:Object.keys((await scope()).data),derived:(await scope()).derived}))
 }
 if(c.id==='fever'){
  await check('urgent-age-temperature',async()=>{await fill('月龄',2);await fill('体温°C',38.2);await button('记录体温');const a=await scope();return {pass:a.derived.urgent===true,derived:a.derived}})
  await check('temperature-history',async()=>{await fill('体温°C',36.8);await button('记录体温');await radio('历史');return {pass:(await state()).temps.length>=2,temps:(await state()).temps,chart:await page.locator('svg').count()}})
  await check('medication-interval',async()=>{await radio('记录');await fill('药品名称','家长确认药品');await fill('实际用药时间','08:00');await fill('剂量（按说明书填写）','按医嘱记录1单位');await fill('说明书间隔(小时)',6);await button('保存用药记录');const a=await state(),s=await scope();return {pass:a.meds?.at(-1)?.nextTime==='14:00',meds:a.meds,derived:s.derived.nextEval}})
 }
 if(c.id==='study'){
  await check('subject-switch',async()=>{const before=(await page.locator('main').innerText());await radio('概率论');const after=await page.locator('main').innerText();return {pass:after!==before&&/概率|事件/.test(after),text:after}})
  await check('answer-feedback',async()=>{await button('开始做题');const text=await page.locator('main').innerText();const options=page.getByRole('button',{name:'0.2',exact:true});if(!await options.count())return {pass:false,reason:'答案选项待人工核对',text};await options.first().click();await button('提交答案');return {pass:(await state()).checked&&(await state()).picked==='0.2'&&(await page.locator('main').innerText()).includes('回答正确'),text:await page.locator('main').innerText()}})
 }
 if(c.id==='medicine'){
  await check('confirmation',async()=>{const before=await state();await button('用示例说明书识别');const pending=await state();await button('改为1次/日');await button('确认频率并安排提醒');const after=await state();return {pass:!before.confirmed&&!pending.confirmed&&after.confirmed===true,after}})
  await check('taken-undo',async()=>{const before=await state();await button('已服');const taken=await state();await button('撤销');const after=await state();return {pass:taken.log.length===before.log.length+1&&after.log.length===before.log.length,taken,after}})
  await check('schedule-frequency',async()=>({pass:false,reason:'需核验修改频率后时刻和日期关联，单一全局已服日志不等于逐次计划提醒',state:await state()}))
 }
 if(c.id==='schedule'){
  await check('week-view',async()=>{await radio('本周');return {pass:(await scope()).derived.scopeItems.length>0,text:await page.locator('main').innerText()}})
  await check('create-form',async()=>{await button('新增');return {pass:await page.locator('input').count()>2,text:await page.locator('main').innerText()}})
 }
 if(c.id==='gpa'){
  await check('add-remove',async()=>{const before=(await state()).rows.length;await button('添加课程');const added=(await state()).rows.length;await button('删除');return {pass:added===before+1&&(await state()).rows.length===before}})
  await button('重置')
  await check('weighted-value',async()=>{const text=await page.locator('main').innerText();await fill('绩点',2,0);return {pass:text.includes('3.40')&&(await page.locator('main').innerText()).includes('2.60'),text:await page.locator('main').innerText()}})
  await check('invalid-value',async()=>{await fill('绩点',5,0);return {pass:/无效|错误|范围|0.*4/.test(await page.locator('main').innerText()),text:await page.locator('main').innerText()}})
  await check('zero-credits',async()=>{await fill('学分',0,0);await fill('学分',0,1);const text=await page.locator('main').innerText();return {pass:!text.includes('NaN')&&!text.includes('Infinity'),text}})
 }
 if(c.id==='editor'||c.id==='game'){
  await page.waitForTimeout(1800);const frame=page.frames().find(f=>f!==page.mainFrame());if(!frame)throw Error('No web frame')
  r.webInitial=await frame.locator('body').innerText();r.webControls=await frame.locator('button,input,textarea').evaluateAll(es=>es.map(e=>({tag:e.tagName,label:e.getAttribute('aria-label'),text:e.innerText,value:e.value})))
  if(c.id==='editor'){
   await check('formula-recalculation',async()=>{const inputs=frame.locator('input');if(!await inputs.count())return {pass:false};await frame.getByLabel('单元格A1',{exact:true}).fill('10');await frame.getByLabel('单元格B1',{exact:true}).fill('5');return {pass:(await frame.locator('body').innerText()).includes('15'),text:await frame.locator('body').innerText()}})
   await check('invalid-formula-isolation',async()=>{await frame.getByLabel('单元格C1',{exact:true}).fill('=alert(1)');const text=await frame.locator('body').innerText();await frame.getByLabel('单元格C1',{exact:true}).fill('=A1+B1');return {pass:/ERR|错误|不支持/.test(text)&&(await frame.locator('body').innerText()).includes('15'),text}})
   await check('notes-switch',async()=>{await frame.getByRole('button',{name:'笔记',exact:true}).click();return {pass:await frame.locator('[contenteditable=true],textarea').count()>0,text:await frame.locator('body').innerText()}})
  await check('format-undo-export',async()=>{await frame.getByTitle('粗体',{exact:true}).first().click();const before=await frame.getByLabel('笔记块1',{exact:true}).inputValue();await frame.getByLabel('笔记块1',{exact:true}).fill('验收标题');await frame.getByRole('button',{name:'撤销',exact:true}).click();const undone=await frame.getByLabel('笔记块1',{exact:true}).inputValue()===before;const download=page.waitForEvent('download',{timeout:3500}).catch(()=>null);await frame.getByRole('button',{name:'导出文本',exact:true}).click();const file=await download;return {pass:undone&&!!file,undone,download:file?.suggestedFilename()||null}})
  }else{
   await check('play-action',async()=>{const buttons=frame.getByRole('button');const before=await frame.locator('body').innerText();let chosen;for(const btn of await buttons.all()){if(await btn.isEnabled()&&await btn.isVisible()){chosen=await btn.innerText();await btn.click();break}}await page.waitForTimeout(1500);const after=await frame.locator('body').innerText();return {pass:before!==after,chosen,text:after}})
  }
 }
 if(c.id==='game'){const frame=page.frames().find(f=>f!==page.mainFrame());
  await check('win-and-restart',async()=>{for(let i=0;i<3;i++){const b=frame.getByRole('button',{name:'前进',exact:true});if(await b.count()&&await b.isEnabled())await b.click();await settle()}const restart=frame.getByRole('button',{name:'重新开始',exact:true});const won=await restart.isVisible();if(won)await restart.click();return {pass:won,text:await frame.locator('body').innerText()}})
  await check('loss-reachable',async()=>{for(let i=0;i<4;i++){const b=frame.getByRole('button',{name:'挥火把',exact:true});if(await b.count()&&await b.isEnabled())await b.click();await settle()}return {pass:await frame.getByRole('button',{name:'重新开始',exact:true}).isVisible(),text:await frame.locator('body').innerText(),reason:'耗尽资源后应出现失败终局；源码的lose变量未写入phase'}})
 }
 if(c.id==='reading'){
  await check('structure-and-values',async()=>{await button('局限');await radio('细节');return {pass:(await state()).node==='limit'&&(await page.locator('main').innerText()).includes('样本小'),text:await page.locator('main').innerText(),state:await state()}})
  await check('quiz-and-read',async()=>{const summary=page.getByRole('button',{name:'理解测验',exact:true});await reach(summary);await summary.click();await button('绿地较多的路线舒适度更高，但不能据此断定因果');await page.getByRole('button',{name:'关闭详情',exact:true}).click();await button('标记已读');return {pass:(await state()).quiz==='b'&&(await state()).read===true}})
 }
 await check('reload-restore',async()=>{const before=await state();const webBefore=await page.evaluate(()=>window.qaSession.current().viewState);await page.reload();await page.waitForFunction(()=>window.qaSession);await settle();const after=await state();const webAfter=await page.evaluate(()=>window.qaSession.current().viewState);return {pass:JSON.stringify(before)===JSON.stringify(after)&&(!['editor','game'].includes(c.id)||JSON.stringify(webBefore?.components)===JSON.stringify(webAfter?.components)),before,after,webBefore,webAfter,calls:await page.evaluate(()=>window.qaCalls)}})
 r.calls=await page.evaluate(()=>window.qaCalls);r.finalState=await state();r.finalText=await page.locator('main').innerText()
 }catch(e){r.checks.push({name:'mount',status:'fail',error:e.message.slice(0,400)})}
 await fs.writeFile(ROOT+'/'+c.id+'-browser.json',JSON.stringify(r,null,2));await page.close();results.push(r);console.log(JSON.stringify({id:c.id,checks:r.checks.map(x=>[x.name,x.status])}))
}
await browser.close();await fs.writeFile(ROOT+'/browser-summary.json',JSON.stringify(results.map(r=>({id:r.id,checks:r.checks.map(c=>({name:c.name,status:c.status}))})),null,2))
