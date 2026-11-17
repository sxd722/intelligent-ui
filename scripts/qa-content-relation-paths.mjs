import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {journeyBrowser} from './cuj-qa-browser.mjs'
const name=process.argv[2],root='artifacts/content-relations-qa/controlled'
for(const arm of ['off','on']){
 if(process.env.QA_ARM&&process.env.QA_ARM!==arm)continue
 const dir=`${root}/${name}-${arm}`,r=JSON.parse(await fs.readFile(dir+'/result.json','utf8'))
 const spec=r.spec||compileCard(r.source||'',{final:true,context:{expressionDialect:'js-v1',cardSize:'auto',renderMode:'native'}}).spec
 if(!spec){console.log(name,arm,'no candidate');continue}
 for(const width of [320,432])await journeyBrowser(spec,{dir:`${dir}/journey-${width}${process.env.QA_REV?'-'+process.env.QA_REV:''}`,width,run:async q=>{
  const seek=async get=>{
   if(await get().count())return true
   const nav=await q.page.getByRole('button',{name:/^卡片页面：/}).evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')))
   for(const label of nav){await q.page.getByRole('button',{name:label,exact:true}).click();await q.page.waitForTimeout(220);if(await get().count())return true}
   return false
  }
  const clickMatch=async(pattern,expect)=>{
   let hits=(await q.snapshot()).controls.filter(c=>pattern.test(c.name)&&['button','radio','checkbox','tab','switch'].includes(c.role))
   if(!hits.length){await q.record('浏览宿主分页寻找 '+pattern,async()=>assert.ok(await seek(()=>q.page.getByRole('button',{name:pattern}).or(q.page.getByRole('radio',{name:pattern})))));hits=(await q.snapshot()).controls.filter(c=>pattern.test(c.name)&&['button','radio','checkbox','tab','switch'].includes(c.role))}
   assert.equal(hits.length,1,'Unique visible target '+pattern+': '+hits.map(c=>c.name).join(', '));await q.click(hits[0].name,expect)
  }
  if(name==='bamboo'){
   await q.click('伊尹放太甲而自立',{text:['太甲','伊尹']})
   await q.record('标记当前事件',async()=>{await q.page.getByRole('checkbox').check();await q.page.waitForTimeout(200);assert.equal(await q.page.getByRole('checkbox').isChecked(),true)})
   await q.click('共伯和干王位',{text:['摄政','共伯和']})
   await q.record('另一事件未被误标',async()=>assert.equal(await q.page.getByRole('checkbox').isChecked(),false))
   await q.click('伊尹放太甲而自立')
   await q.record('返回保留标记',async()=>assert.equal(await q.page.getByRole('checkbox').isChecked(),true))
   await q.reload({text:['伊尹']})
   await q.record('刷新保留标记',async()=>assert.equal(await q.page.getByRole('checkbox').isChecked(),true))
   const evidence=(await q.snapshot()).controls.filter(c=>c.role==='button'&&/依据/.test(c.name));if(evidence.length===1)await q.click(evidence[0].name,{text:['太甲自桐潜出杀伊尹']});else await q.check({text:['太甲自桐潜出杀伊尹']})
  }
  if(name==='cs343'){
   const pickQuestion=async title=>{if(arm==='off')await q.click(title)}
   await clickMatch(/^同步(?:\s|$)/)
   await q.record('标记薄弱',async()=>{await seek(()=>q.page.getByRole('checkbox',{name:/薄弱/}));const box=q.page.getByRole('checkbox',{name:/薄弱/});assert.equal(await box.count(),1);await box.check()})
   await pickQuestion('竞态条件与临界区')
   await q.record('填写当前题答案',async()=>{await seek(()=>q.page.getByRole('textbox'));const field=q.page.getByRole('textbox');assert.equal(await field.count(),1);await field.fill('两个线程同时读取旧值，写回时覆盖了一次更新。')},{text:['count++']})
   await clickMatch(/展开.*(?:答案|参考)|查看.*(?:答案|参考)|核对答案|显示.*答案|揭晓.*答案/,{text:['原子','临界区']})
   await clickMatch(/^并发(?:\s|$)/)
   await pickQuestion('线程与进程的取舍')
   await q.record('不同主题不复用答案草稿',async()=>{await seek(()=>q.page.getByRole('textbox'));assert.equal(await q.page.getByRole('textbox').inputValue(),'')})
   await clickMatch(/^同步(?:\s|$)/)
   await pickQuestion('竞态条件与临界区')
   await q.record('返回保留答案',async()=>{await seek(()=>q.page.getByRole('textbox'));assert.match(await q.page.getByRole('textbox').inputValue(),/同时读取旧值/)})
   await q.reload({text:['count++']})
   await q.record('刷新保留答案和薄弱标记',async()=>{await seek(()=>q.page.getByRole('textbox'));assert.match(await q.page.getByRole('textbox').inputValue(),/同时读取旧值/);await seek(()=>q.page.getByRole('checkbox',{name:/薄弱/}));assert.equal(await q.page.getByRole('checkbox',{name:/薄弱/}).isChecked(),true)})
  }
  if(name==='care'){
   const openRecords=async()=>{if(arm==='off'){const c=(await q.snapshot()).controls.find(c=>c.name==='本场景记录');if(c){const b=q.page.locator(`[data-debug-handle=${JSON.stringify(c.handle)}]`);if(await b.getAttribute('aria-expanded')!=='true')await q.click('本场景记录')}}}
   const field=label=>q.page.getByLabel(new RegExp('^'+label)).filter({visible:true})
   await clickMatch(/^(?:🌙\s*)?睡眠$/)
   await q.record('查看睡眠行动与观察',async()=>{assert.ok(await seek(()=>q.page.getByText('安全睡眠环境',{exact:true})));assert.match((await q.snapshot()).text,/呼吸/)})
   if(arm==='off')await q.click('偏好设置')
   await q.record('填写时间和备注',async()=>{assert.ok(await seek(()=>field('时间')));await field('时间').fill('09:15');await field('备注').fill('睡眠记录A')})
   await q.click(arm==='off'?'保存记录':'添加记录')
   if(arm==='off')await q.click('完成')
   await openRecords()
   await q.record('新记录有实际内容',async()=>{assert.ok(await seek(()=>q.page.getByText('睡眠记录A',{exact:true})));assert.match((await q.snapshot()).text,/09:15/)})
   await q.click('编辑')
   await q.record('编辑备注',async()=>{assert.ok(await seek(()=>field('备注')));await field('备注').fill('睡眠记录B')})
   await q.click('保存修改',{text:['睡眠记录B']})
   await clickMatch(/^(?:🍼\s*)?喂养$/)
   await openRecords()
   await q.record('另一场景不混入睡眠记录',async()=>{assert.equal(await q.page.getByText('睡眠记录B',{exact:true}).count(),0)})
   await clickMatch(/^(?:🌙\s*)?睡眠$/)
   await openRecords()
   await q.record('返回恢复睡眠记录',async()=>assert.ok(await seek(()=>q.page.getByText('睡眠记录B',{exact:true}))))
   await q.reload()
   await openRecords()
   await q.record('刷新恢复睡眠记录',async()=>assert.ok(await seek(()=>q.page.getByText('睡眠记录B',{exact:true}))))
   await q.click('删除')
   await q.record('删除确实移除',async()=>{assert.equal(await q.page.getByText('睡眠记录B',{exact:true}).count(),0);assert.match((await q.snapshot()).text,/还没有.*睡眠.*记录/)})
  }
 }})
}
