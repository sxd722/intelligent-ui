import fs from 'node:fs/promises'
import path from 'node:path'
import {createServer} from 'node:http'
import assert from 'node:assert/strict'
import {chromium,expect} from '@playwright/test'
import {compileCard} from '../shared/cardspec/compiler.mjs'
const root='artifacts/stitch-comparison-qa';await fs.mkdir(root,{recursive:true})
const spec=compileCard('<card><binding id="movies" tool="opencli.douban.movie-hot" input={{limit:10}} load="manual"/><state id="n" type="number" initial={0}/><title>今晚看什么</title><text>已选 {state.n} 部电影</text><button onPress="add">加入比较</button><action id="add"><increment target="n"/></action></card>',{final:true}).spec
assert(spec)
let comparison,comparisonStatus='generating',generations=0,refines=0,requests=[]
let real;try{real=JSON.parse(await fs.readFile(root+'/live-result.json','utf8'));if(real.status!=='ready')real=null}catch{}
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://local');let body='';for await(const chunk of req)body+=chunk
 const json=(value,status=200)=>res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify(value))
 if(url.pathname==='/api/health')return json({cardSandbox:true,cardWebSandbox:true,keyLoaded:true,stitchComparison:true})
 if(url.pathname==='/api/refine-prompt'){refines++;return json({prompt:'今晚看什么，海报筛选、详情和两片比较。'})}
 if(url.pathname==='/api/stitch-comparisons'&&req.method==='POST'){comparison=JSON.parse(body);requests.push({path:url.pathname,body:comparison});return json({...comparison,status:'queued'},202)}
 if(url.pathname.endsWith('/image')){res.setHeader('Content-Type','image/png');return res.end(await fs.readFile(real?`artifacts/stitch-comparison/${real.id}/${real.preview?'mock':'screen'}.png`:'artifacts/render-origin-qa/before-432.png'))}
 if(url.pathname.startsWith('/api/stitch-comparisons/'))return json({...real,id:comparison?.id,status:comparisonStatus,imageUrl:'/api/stitch-comparisons/'+comparison?.id+'/image',candidates:real?.candidates||[{id:'opencli.douban.movie-hot',purpose:'电影榜单'}],plannedTools:real?.plannedTools||['opencli.douban.movie-hot'],prompt:comparison?.prompt,elapsedMs:real?.elapsedMs||1234})
 if(url.pathname==='/api/chat'){
  generations++;requests.push({path:url.pathname,body:JSON.parse(body)});res.writeHead(200,{'Content-Type':'text/event-stream'})
  const send=v=>res.write('data: '+JSON.stringify(v)+'\n\n')
  send({type:'phase_begin',id:'test-card',phase:'dsl',kind:'cardspec',title:'卡片生成'});send({p:'',o:'add',v:{message:{status:'succeeded',content:{parts:['']},metadata:{format:'cardspec',card_spec:spec,core_ready:true}}}});send({type:'phase_end',id:'test-card',status:'succeeded'});send({type:'message_stream_complete',status:'succeeded'});res.end('data: [DONE]\n\n');return
 }
 if(url.pathname.startsWith('/api/'))return json({tools:[]})
 const f=path.resolve('dist','.'+(url.pathname==='/'?'/index.html':url.pathname));if(!f.startsWith(path.resolve('dist')+path.sep)){res.writeHead(403).end();return}
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json'}
 res.setHeader('Content-Type',mime[path.extname(f)]||'application/octet-stream');res.end(await fs.readFile(f))
}catch(e){res.writeHead(500).end(e.message)}})
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:1200,height:1000},reducedMotion:'reduce'})
await context.tracing.start({screenshots:true,snapshots:true})
await context.addInitScript(()=>{localStorage.setItem('cardspec-refine-prompt','on');localStorage.setItem('cardspec-stitch-compare','on')})
const page=await context.newPage()
try{
 await page.goto(origin);await page.getByLabel('卡片生成需求').fill('今晚看什么');await page.getByRole('button',{name:'提炼需求',exact:true}).click()
 await expect(page.getByRole('button',{name:'确认并生成',exact:true})).toBeVisible();assert.equal(refines,1);assert(!comparison)
 const finalPrompt='今晚看什么，海报筛选、详情和两片比较。只看科幻。'
 await page.getByLabel('卡片生成需求').fill(finalPrompt);await page.getByRole('button',{name:'确认并生成',exact:true}).click()
 await expect(page.getByRole('button',{name:'加入比较',exact:true})).toBeVisible()
 assert.equal(comparison.prompt,finalPrompt);assert.equal(generations,1)
 await page.getByRole('button',{name:'加入比较',exact:true}).click();await expect(page.locator('.cs-text')).toHaveText('已选 1 部电影')
 await page.getByRole('button',{name:'全屏查看卡片',exact:true}).click();await expect(page.getByRole('dialog',{name:'全屏卡片'})).toBeVisible()
 await page.screenshot({path:root+'/fullscreen-pending.png'})
 comparisonStatus='ready';await expect(page.locator('.stitch-mock')).toBeVisible({timeout:8000});await page.waitForFunction(()=>{const image=document.querySelector('.stitch-mock');return image?.complete&&image.naturalWidth>0})
 await page.getByLabel('标注两侧工具').check();await expect(page.locator('.card-focus-native .comparison-tools')).toContainText('opencli.douban.movie-hot')
 await expect(page.locator('.card-focus-reference .comparison-tools').first()).toContainText('Stitch 设计声明')
 const left=await page.locator('.card-focus-native').boundingBox(),right=await page.locator('.card-focus-reference').boundingBox();assert(right.x>left.x+left.width)
 await page.getByRole('button',{name:'加入比较',exact:true}).click();await expect(page.locator('.cs-text')).toHaveText('已选 2 部电影')
 await page.screenshot({path:root+'/fullscreen-annotated.png'})
 await page.getByRole('button',{name:'退出卡片全屏',exact:true}).click();await expect(page.locator('.cs-text')).toHaveText('已选 2 部电影')
 await page.reload();await expect(page.locator('.cs-text')).toHaveText('已选 2 部电影');assert.equal(generations,1);assert.equal(requests.filter(r=>r.path==='/api/stitch-comparisons').length,1)
 await page.getByRole('button',{name:'全屏查看卡片',exact:true}).click();await page.setViewportSize({width:390,height:844});await page.screenshot({path:root+'/mobile.png'})
 assert(await page.evaluate(()=>document.querySelector('.card-focus--open').scrollWidth<=innerWidth+2))
 await fs.writeFile(root+'/ui-checks.json',JSON.stringify({refineBeforeStitch:true,editedPromptShared:true,independentPending:true,sideBySideDesktop:true,interactiveStatePreserved:true,refreshRestoresWithoutRegenerating:true,mobileNoOverflow:true,usesRealStitchMock:!!real,requests},null,2))
 console.log('Stitch comparison UI passed')
}finally{await context.tracing.stop({path:root+'/browser-trace.zip'});await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok))}
