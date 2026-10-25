import {chromium} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
const dir='artifacts/h5-baseline-v2',live=JSON.parse(await readFile(`${dir}/live.json`,'utf8'))
const places=live.results.find(r=>r.tool==='opencli.ctrip.search').value
const b=await chromium.launch({channel:'chrome',headless:true}),checks={mode:'recorded real Ctrip response; live map and illustration requests',requests:[]}
try{
 const p=await b.newPage({viewport:{width:1000,height:850}});p.setDefaultTimeout(25000)
 p.on('response',r=>{if(/tile.openstreetmap.org|api\/photo|api\/media/.test(r.url()))checks.requests.push({url:r.url(),status:r.status()})})
 await p.route('**/api/tools/invoke',async route=>{const q=route.request().postDataJSON();if(q.tool!=='opencli.ctrip.search')throw Error('Unexpected tool');await route.fulfill({contentType:'text/event-stream',body:[{type:'result',result:{kind:'json',value:places}},{type:'done'}].map(x=>'data: '+JSON.stringify({...x,requestId:q.requestId,pageId:q.pageId})+'\n\n').join('')})})
 await p.goto('http://127.0.0.1:8787/h5-baseline/index.html?case=family&width=432&size=square')
 const f=p.frameLocator('iframe');await f.getByRole('button',{name:'搜索亲子去处'}).click();await f.getByRole('button',{name:'找去处',exact:true}).click()
 await f.getByRole('button',{name:'地图选择 '+places.items[0].name,exact:true}).click()
 await Promise.allSettled([f.locator('.poi-map image').first().waitFor(),f.locator('.place-photo img').first().waitFor()])
 checks.loadedTiles=await f.locator('.poi-map image').count();checks.loadedIllustrations=await f.locator('.place-photo img').count()
 await p.locator('iframe').screenshot({path:`dir/family-live-media.png`.replace('dir',dir)})
 checks.trace=await p.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.endsWith(':trace'))))
}finally{await b.close()}
await writeFile(`${dir}/media.json`,JSON.stringify(checks,null,2));console.log(JSON.stringify(checks))
