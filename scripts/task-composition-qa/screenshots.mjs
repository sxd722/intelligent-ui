import {chromium} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
import {cases,ROOT} from './cases.mjs'
const browser=await chromium.launch({channel:'chrome',headless:true}),shots=[]
try{
 for(const c of cases)for(const mode of ['native','hybrid'])for(const width of [320,432]){
  const id=c.id+'-'+mode,p=await browser.newPage({viewport:{width:width+24,height:800}})
  await p.goto(`http://127.0.0.1:8787/task-composition-qa.html?id=${id}&width=${width}`);await p.waitForFunction(()=>window.qaView?.().items.length>0)
  if(mode==='hybrid'){await p.frameLocator('iframe').getByRole('button',{name:/探索/}).first().waitFor();await p.getByRole('button',{name:'选择第一项',exact:true}).click()}
  else if(c.id==='trip')await p.locator('.cs-map-pin').first().click()
  else await p.locator('.tb-row').first().click()
  await p.waitForTimeout(300)
  const name=`${id}-${width}-square.png`;await p.locator('.cs-stage').screenshot({path:ROOT+'/'+name});shots.push(name);await p.close()
 }
 const models=JSON.parse(await readFile(ROOT+'/model-verified.json','utf8'))
 for(const r of models)for(const width of [320,432]){
  const p=await browser.newPage({viewport:{width:width+24,height:800}});await p.goto(`http://127.0.0.1:8787/task-composition-qa.html?id=${r.id}&width=${width}`);await p.waitForFunction(()=>window.qaView?.().items.length>0)
  await p.getByRole('button',{name:'候选',exact:true}).click();await p.locator('.tb-row').first().click();await p.waitForTimeout(300)
  await p.getByRole('button',{name:r.case==='trip'?'地图':'关联资料',exact:true}).click()
  const name=`${r.id}-${width}-model.png`;await p.locator('.cs-stage').screenshot({path:ROOT+'/'+name});shots.push(name);await p.close()
 }
 await writeFile(ROOT+'/screenshots.json',JSON.stringify({kind:'final-build-representative-snapshots',shots},null,2))
 console.log(shots.length+' screenshots')
}finally{await browser.close()}
