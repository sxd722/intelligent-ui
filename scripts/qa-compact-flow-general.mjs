import {chromium} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {CAROUSEL_FIXTURES} from '../shared/cardspec/carousel-fixtures.mjs'
const cases={gallery:CAROUSEL_FIXTURES.dialAcademy,forms:`<card><state id="a" type="string" initial=""/><title>候选备注</title><carousel id="c" label="备注"><carousel-item><strong>方案一</strong><input label="方案一备注" value={state.a} onChange="edit"/></carousel-item><carousel-item><strong>方案二</strong><text>保留完整说明和输入空间。</text></carousel-item></carousel><text>已记：{state.a}</text><action id="edit"><set target="a" value={event.value}/></action></card>`}
const b=await chromium.launch({channel:'chrome',headless:true}),p=await b.newPage({viewport:{width:900,height:900}}),results=[]
try{
 for(const [name,source] of Object.entries(cases))for(const size of ['square','auto','full'])for(const width of [320,360,432]){
  const c=compileCard(source,{final:true});assert.ok(c.complete,JSON.stringify(c.diagnostics))
  await p.goto('http://127.0.0.1:8787/card-debug.html');await p.waitForFunction(()=>window.cardDebug)
  await p.evaluate(({spec,width,size})=>window.cardDebug.mount(spec,{width,size}),{spec:c.spec,width,size});await p.waitForFunction(()=>window.cardDebug.ready());await p.waitForTimeout(500)
  if(name==='forms'){
   await p.getByRole('textbox',{name:'方案一备注'}).fill('继续保留')
   if(size!=='full'){await p.getByRole('button',{name:'下一项',exact:true}).click();await p.getByRole('button',{name:'上一项',exact:true}).click()}
   assert.equal(await p.getByRole('textbox').inputValue(),'继续保留')
  }else if(size!=='full'){
   await p.getByRole('button',{name:'下一项',exact:true}).click()
   assert.equal((await p.evaluate(()=>window.cardDebug.snapshot())).state.selected,1)
  }
  const snap=await p.evaluate(()=>window.cardDebug.snapshot());assert.deepEqual(snap.errors,[]);assert.equal(snap.horizontalOverflow,false)
  const layout=await p.locator('.cs-carousel').evaluate(e=>({height:e.offsetHeight,columns:getComputedStyle(e.querySelector('.cs-dial-track')).gridTemplateColumns,slides:[...e.querySelectorAll('.cs-dial-slide')].map(n=>({h:n.clientHeight,scroll:n.scrollHeight,opacity:getComputedStyle(n.firstElementChild).opacity,width:n.clientWidth}))}))
  if(size==='full')for(const s of layout.slides){assert.equal(s.opacity,'1');assert.ok(s.scroll<=s.h+2,'full content must not hide inside a slide')}
  if(size==='full'&&name==='forms')assert.ok(layout.slides[0].width>width-48,'forms span the grid')
  if(width===432)await p.locator('.cs-card').screenshot({path:`artifacts/compact-flow/${name}-${size}.png`})
  results.push({name,size,width,layout,state:snap.state})
 }
}finally{await writeFile('artifacts/compact-flow/general.json',JSON.stringify(results,null,2));await b.close()}
console.log(`${results.length} gallery/form viewport checks passed`)
