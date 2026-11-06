// Independent UI-only playthrough, no state injection or model tool calls.
import {chromium} from 'playwright'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {installDebugRandom} from '../server/cardspec/debug-random.mjs'
const dir='artifacts/sgs-harness-20261102/playthrough';await mkdir(dir,{recursive:true})
const spec=JSON.parse(await readFile('artifacts/sgs-harness-play/spec.json','utf8'))
const browser=await chromium.launch({channel:'chrome',headless:true})
const context=await browser.newContext({viewport:{width:432,height:850},reducedMotion:'reduce'})
await context.addInitScript(installDebugRandom,73129)
const page=await context.newPage(),trace=[],errors=[];page.on('pageerror',e=>errors.push(e.message))
let frame,game;const started=Date.now()
const read=async()=>{const s=await page.evaluate(()=>window.cardDebug.snapshot());return Object.values(s.componentState).find(c=>c.webSandbox)?.webSandbox.state}
const ready=async()=>{await page.waitForFunction(()=>window.cardDebug?.ready());await page.locator('.cs-web-sandbox[data-sandbox-ready=true]').waitFor();frame=await page.locator('.cs-web-sandbox iframe').contentFrame()}
const click=async name=>{await frame.getByRole('button',{name,exact:true}).filter({visible:true}).first().click();await page.waitForTimeout(200);game=await read();trace.push({op:'click',name,atMs:Date.now()-started,state:game});await writeFile(dir+'/trace.json',JSON.stringify(trace,null,2))}
const snap=async name=>page.locator('.cs-stage').screenshot({path:dir+'/'+name+'.png'})
try{
 await page.goto('http://127.0.0.1:8787/card-debug.html');await page.waitForFunction(()=>!!window.cardDebug)
 await page.evaluate(spec=>window.cardDebug.mount(spec,{width:432,size:'square'}),spec);await ready();await click('开 始 游 戏');await snap('start')
 let turns=0,restored=false
 while(!game.over&&turns<20&&Date.now()-started<180000){
  if(game.pending){await snap('ai-response');await click(game.hand.some(c=>c.n==='闪')?'使用【闪】':'承受伤害');await page.waitForTimeout(2000)}
  else if(game.turn==='ai')await page.waitForTimeout(2200)
  else{
   for(const name of ['桃','过河拆桥','顺手牵羊','决斗','杀']){
    const button=frame.getByRole('button',{name,exact:true}).first()
    if(await button.count()&&await button.isEnabled()){await click(name);await click('出 牌');await page.waitForTimeout(1100);game=await read();await snap('after-play');if(game.over)break}
   }
   if(!game.over){await click('结束回合');turns++;await snap('ai-turn')}
  }
  game=await read()
  if(turns===1&&!restored){
   const before=game;await page.evaluate(()=>window.cardDebug.save());await page.reload();await page.waitForFunction(()=>!!window.cardDebug);await page.evaluate(spec=>window.cardDebug.mount(spec,{width:432,size:'square',restore:true}),spec)
   await page.waitForFunction(()=>window.cardDebug.ready());const immediate=await read();restored=JSON.stringify(before)===JSON.stringify(immediate)
   trace.push({op:'reload',restored,before,immediate});await ready();game=await read()
  }
 }
 await snap('final');await writeFile(dir+'/result.json',JSON.stringify({fixture:false,pass:!!game.over&&restored&&!errors.length,turns,restored,over:game.over,elapsedMs:Date.now()-started,errors,state:game},null,2));console.log({turns,restored,over:game.over,errors})
}finally{await writeFile(dir+'/trace.json',JSON.stringify(trace,null,2));await browser.close()}
