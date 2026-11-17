import {chromium} from '@playwright/test'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import assert from 'node:assert/strict'
const phase=process.argv[2]||'after',dir='artifacts/compact-flow'
await mkdir(dir,{recursive:true})
const source=await readFile('artifacts/generation-debug/b553cb52-6021-4306-a469-eb7a5dde3f49/3a9a34b91c1d4c9b06dc/candidate.cardspec','utf8')
const compiled=compileCard(source,{final:true,context:{renderMode:'hybrid',expressionDialect:'js-v1'}})
await validateRichContent(compiled)
assert.ok(compiled.complete,JSON.stringify(compiled.diagnostics))
await writeFile(dir+'/kilimanjaro-spec.json',JSON.stringify(compiled.spec))
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:900,height:900}}),results=[]
// Reuse deterministic image data for both captures: this is a renderer replay,
// not another model generation or a live fact/data validation.
await page.route('**/api/pexels/**',r=>r.fulfill({json:{status:'error'}}))
try{
 for(const width of [320,360,432]){
  await page.goto('http://127.0.0.1:8787/card-debug.html');await page.waitForFunction(()=>window.cardDebug)
  await page.evaluate(({spec,width})=>window.cardDebug.mount(spec,{width,size:'full'}),{spec:compiled.spec,width})
  await page.waitForFunction(()=>window.cardDebug.ready());await page.waitForTimeout(1600)
  const measure=()=>page.evaluate(()=>({height:document.querySelector('.cs-composition').getBoundingClientRect().height,carousel:document.querySelector('.cs-carousel').getBoundingClientRect().height,columns:getComputedStyle(document.querySelector('.cs-dial-track')).gridTemplateColumns,items:[...document.querySelectorAll('.cs-dial-slide')].map(e=>({height:e.clientHeight,scroll:e.scrollHeight,opacity:getComputedStyle(e.firstElementChild).opacity})),stats:document.querySelector('.cs-stat').getBoundingClientRect().height,snapshot:window.cardDebug.snapshot()}))
  const before=await measure();assert.equal(before.snapshot.horizontalOverflow,false)
  await page.locator('.cs-carousel').getByRole('button',{name:'选这条',exact:true}).first().click()
  assert.equal((await page.evaluate(()=>window.cardDebug.snapshot())).state.routeId,'marangu')
  await page.getByRole('radio',{name:'D2',exact:true}).click()
  await page.getByRole('combobox',{name:'月份',exact:true}).selectOption('04')
  await page.getByRole('checkbox').first().uncheck()
  const slider=page.getByRole('slider',{name:'预算',exact:true});await slider.focus();await slider.press('ArrowRight')
  const after=await page.evaluate(()=>window.cardDebug.snapshot())
  assert.equal(after.state.day,1);assert.equal(after.state.month,'04');assert.equal(after.state.gear.includes('boots'),false);assert.ok(after.state.cost>2500)
  assert.deepEqual(after.errors,[])
  await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(400)
  await page.locator('.cs-card').screenshot({path:`${dir}/${phase}-${width}.png`})
  await page.evaluate(()=>window.cardDebug.save());await page.reload();await page.waitForFunction(()=>window.cardDebug)
  await page.evaluate(({spec,width})=>window.cardDebug.mount(spec,{width,size:'full',restore:true}),{spec:compiled.spec,width});await page.waitForFunction(()=>window.cardDebug.ready())
  assert.deepEqual((await page.evaluate(()=>window.cardDebug.snapshot())).state,after.state)
  results.push({width,...before,interaction:after.state,restored:true})
 }
}finally{await writeFile(`${dir}/${phase}.json`,JSON.stringify(results,null,2));await browser.close()}
console.log(JSON.stringify(results.map(({width,height,carousel,columns,stats})=>({width,height,carousel,columns,stats}))))
