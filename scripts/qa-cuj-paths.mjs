import fs from 'node:fs/promises'
import {journeyBrowser} from './cuj-qa-browser.mjs'
const name=process.argv[2],base=process.env.QA_OUTPUT||'artifacts/cuj-continuity-qa/verified'
const result=JSON.parse(await fs.readFile(`${base}/${name}/result.json`,'utf8')),deck=result.deck
for(const width of [320,432]){
 if(name==='bamboo'){
  await journeyBrowser(deck[0].spec,{dir:`${base}/${name}/cuj-1-${width}`,width,run:async q=>{
   await q.click('今本',{text:['明中期'],state:{edition:'jin'}})
   await q.reload({state:{edition:'jin'}})
   await q.click('古本',{text:['辑佚'],state:{edition:'gu'}})
  }})
  await journeyBrowser(deck[1].spec,{dir:`${base}/${name}/cuj-2-${width}`,width,run:async q=>{
   await q.click('重要事件',{state:{cat:'event'}})
   await q.click('要点',{text:['舜囚尧']})
   await q.click('伊尹放太甲而自立',{text:['太甲自桐潜出杀伊尹','儒家叙事中伊尹']})
   await q.click('考古价值',{text:['简牍形制与整理']})
   await q.click('出土情境',{text:['同墓所出']})
   await q.click('内容概览',{text:['伊尹放太甲而自立']})
   await q.reload({state:{cat:'event',zone:'content',openItem:'e2'}})
  }})
  await journeyBrowser(deck[0].spec,{deck,dir:`${base}/${name}/cross-card-${width}`,width,run:async q=>{
   await q.click('今本',{state:{edition:'jin'}})
   await q.edge(true,{text:['今本'],state:{edition:'jin'}})
   await q.click('古本',{state:{edition:'gu'}})
   await q.edge(false,{text:['古本'],state:{edition:'gu'}})
   await q.reload({state:{edition:'gu'}})
  }})
 }
 if(name==='care'){
  await journeyBrowser(deck[0].spec,{dir:`${base}/${name}/steps-${width}`,width,run:async q=>{
   await q.click('睡眠',{text:['安全睡眠环境'],state:{scene:'sleep'}})
   await q.record('展开第一步',()=>q.page.getByRole('button',{name:'展开',exact:true}).first().click(),{text:['硬质平整床垫']})
   await q.click('喂养',{text:['摆好姿势再喂']})
   await q.click('睡眠',{text:['硬质平整床垫']})
   await q.reload({text:['硬质平整床垫'],state:{scene:'sleep'}})
   for(const [label,id,title]of [['哭闹安抚','cry','逐项排查需求'],['尿布与皮肤','skin','清洁与干燥'],['体温与不适','temp','规范测量体温']])await q.click(label,{state:{scene:id},text:[title]})
  }})
  await journeyBrowser(deck[1].spec,{dir:`${base}/${name}/record-${width}`,width,run:async q=>{
   await q.fill('时间','09:00')
   await q.fill('喂奶量（ml，可留空）','100')
   await q.fill('简要情况（可留空）','测试记录A')
   await q.click('新增记录',{text:['09:00','测试记录A']})
   await q.click('编辑')
   await q.fill('简要情况（可留空）','测试记录B')
   await q.click('保存修改',{text:['测试记录B']})
   await q.reload({text:['测试记录B']})
   await q.click('删除',{text:['还没有记录']})
   await q.click('自查')
   await q.click('精神差、叫不醒或持续嗜睡',{text:['建议尽快就医'],state:{checked:['alert']}})
   await q.reload({text:['建议尽快就医'],state:{checked:['alert']}})
  }})
  await journeyBrowser(deck[0].spec,{deck,dir:`${base}/${name}/cross-card-${width}`,width,run:async q=>{
   await q.click('睡眠',{state:{scene:'sleep'}})
   await q.edge(true,{text:['睡眠'],state:{scene:'sleep'}})
   await q.fill('时间','13:00')
   await q.fill('睡眠时段（如 13:00-15:00）','13:00-15:00')
   await q.click('新增记录',{text:['13:00-15:00']})
   await q.edge(false,{state:{scene:'sleep'}})
   await q.click('喂养',{state:{scene:'feed'}})
   await q.edge(true,{text:['还没有记录'],state:{scene:'feed'}})
   await q.edge(false,{state:{scene:'feed'}})
   await q.click('睡眠')
   await q.edge(true,{text:['13:00-15:00']})
   await q.reload({text:['13:00-15:00'],state:{scene:'sleep'}})
  }})
 }
 if(name==='cs343'){
  await journeyBrowser(deck[0].spec,{dir:`${base}/${name}/concept-${width}`,width,run:async q=>{
   await q.click('收起该分支',{state:{open:{concurrency:false}}})
   await q.record('子分支确实收起',async()=>{if((await q.snapshot()).controls.some(c=>c.role==='button'&&c.name==='同步'))throw Error('Collapsed branch remains selectable')})
   await q.click('展开该分支',{text:['同步'],state:{open:{concurrency:true}}})
   await q.click('同步',{state:{sel:'sync'},text:['条件变量']})
   await q.click('标记为薄弱',{state:{weak:{sync:true}}})
   await q.click('操作系统接口',{state:{sel:'os'},text:['系统调用']})
   await q.reload({state:{sel:'os',weak:{sync:true}}})
  }})
  await journeyBrowser(deck[1].spec,{dir:`${base}/${name}/exercise-${width}`,width,run:async q=>{
   await q.click('展开参考思路与易错点',{text:['消除循环等待']})
   await q.click('本题已做',{state:{done:{'q-sync-2':true}}})
   await q.reload({state:{done:{'q-sync-2':true},reveal:{'q-sync-2':true}}})
   await q.click('系统调用的开销来源',{text:['read()']})
   await q.click('展开参考思路与易错点',{text:['保存与恢复寄存器']})
  }})
  await journeyBrowser(deck[0].spec,{deck,dir:`${base}/${name}/cross-card-${width}`,width,run:async q=>{
   await q.click('标记为薄弱',{state:{weak:{concurrency:true}}})
   await q.edge(true,{state:{weak:{concurrency:true}}})
   await q.click('线程与进程的取舍',{text:['薄弱主题'],state:{sel:'q-conc-1'}})
   await q.click('展开参考思路与易错点',{text:['更适合多线程']})
   await q.click('取消该主题薄弱标记',{state:{weak:{concurrency:false}}})
   await q.edge(false,{state:{weak:{concurrency:false}},text:['标记为薄弱']})
   await q.reload({state:{weak:{concurrency:false}}})
  }})
 }
}
