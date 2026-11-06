// Independent browser evidence for an uncommitted candidate. A successful
// render does not promote it through the full requirement gate.
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createBuildWorkspace} from '../server/cardspec/build-workspace.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import {chromium} from 'playwright'
const name=process.argv[2],id=process.argv[3],dir=`artifacts/requirement-planning-qa/${name}`
const t=JSON.parse(await readFile(`artifacts/deep-build/${id}/trace.json`,'utf8')),request=JSON.parse(await readFile(dir+'/request.json','utf8'))
const workspace=createBuildWorkspace({extendedGeneration:true});workspace.write(Object.entries(t.workspace).map(([name,f])=>({name,content:f.content})))
const source=workspace.assemble().source,context={renderMode:request.renderMode,cardSize:request.cardSize,expressionDialect:'js-v1',extendedGeneration:!!request.extendedGeneration,viewport:{width:432,height:900}}
const compiled=compileCard(source,{final:true,context});await validateRichContent(compiled)
if(!compiled.complete||compiled.diagnostics.some(d=>d.severity==='error'))throw Error(JSON.stringify(compiled.diagnostics))
compiled.spec.deepBuild={artifactPath:`artifacts/deep-build/${id}`};compiled.spec.qaCandidate=true
await writeFile(dir+'/candidate-spec.json',JSON.stringify(compiled.spec,null,2));await writeFile(dir+'/candidate-source.cardspec',source)
const browser=await chromium.launch({channel:'chrome',headless:true}),rows=[]
try{
 for(const width of [432,320]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[];page.setDefaultTimeout(4000)
  page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8787/card-debug.html')
  await page.waitForFunction(()=>!!window.cardDebug);await page.evaluate(({spec,width,size})=>window.cardDebug.mount(spec,{width,size}),{spec:compiled.spec,width,size:request.cardSize})
  await page.waitForSelector('.cs-sandbox[data-sandbox-ready=true]',{timeout:15000})
  const frame=page.frameLocator('.cs-sandbox iframe');await frame.locator('body').waitFor();await page.waitForTimeout(200)
  const initial=await frame.locator('body').innerText();const actions=[],checks=[]
  if(width===432)await page.locator('.cs-stage').screenshot({path:dir+'/preview.png'})
  const click=async(label,wait=200)=>{const before=await frame.locator('body').innerText();await frame.getByRole('button',{name:label,exact:true}).first().click();await page.waitForTimeout(wait);const after=await frame.locator('body').innerText();actions.push({op:'click',label,changed:before!==after,text:after});return after}
  try{
   if(name==='game'){
    await click('开始游戏');const playing=await frame.locator('body').innerText()
    const after=await click('结束回合',2200);actions.at(-1).aiResponded=/AI|对手|敌方/.test(after)&&after!==playing
    const saved=await frame.locator('body').innerText();await page.evaluate(()=>window.cardDebug.save());await page.reload();await page.waitForFunction(()=>!!window.cardDebug);await page.evaluate(({spec,width,size})=>window.cardDebug.mount(spec,{width,size,restore:true}),{spec:compiled.spec,width,size:request.cardSize});await page.waitForSelector('.cs-sandbox[data-sandbox-ready=true]');await page.waitForTimeout(150);actions.push({op:'reload',restored:(await frame.locator('body').innerText())===saved})
    await click('再来一局');actions.at(-1).reset=/4\/4/.test(await frame.locator('body').innerText())
    if(width===432){
     for(let round=0;round<16;round++){
      if(/败\s*北|胜\s*利/.test(await frame.locator('body').innerText()))break
      const end=frame.getByRole('button',{name:'结束回合',exact:true});if(await end.isEnabled())await click('结束回合',2800);else await page.waitForTimeout(1000)
      const damage=frame.getByRole('button',{name:'承受伤害',exact:true});if(await damage.count())await click('承受伤害',500)
     }
     checks.push({name:'通过真实回合与AI行动到达结算',passed:/败\s*北|胜\s*利/.test(await frame.locator('body').innerText())})
     await page.locator('.cs-stage').screenshot({path:dir+'/game-over.png'})
    }
   }
   if(name==='learning-web'){
    await click('未命中');await click('单步推进');checks.push({name:'第一步预测正确',passed:/对\s*1\s*\/\s*错\s*0/.test(await frame.locator('body').innerText())})
    for(let i=0;i<5;i++)await click('单步推进')
    const fifo=await frame.locator('body').innerText();checks.push({name:'FIFO 六步应命中2次、未命中4次',passed:/命中\s*2\b/.test(fifo)&&/未命中\s*4\b/.test(fifo)});checks.push({name:'序列结束禁用推进',passed:await frame.getByRole('button',{name:'单步推进',exact:true}).isDisabled()})
    await click('LRU');for(let i=0;i<6;i++)await click('单步推进')
    const lru=await frame.locator('body').innerText();checks.push({name:'LRU 六步应命中1次、未命中5次',passed:/命中\s*1\b/.test(lru)&&/未命中\s*5\b/.test(lru)})
    await click('重置');checks.push({name:'重置计数与预测',passed:/命中\s*0\b/.test(await frame.locator('body').innerText())&&/对\s*0\s*\/\s*错\s*0/.test(await frame.locator('body').innerText())})
   }
   if(name==='budget-web'){
    checks.push({name:'两天请求没有变成三天',passed:!/[3三]\s*[天晚]/.test(initial)})
    await frame.getByRole('spinbutton',{name:'出行人数',exact:true}).fill('3');await page.waitForTimeout(200)
    const before=await frame.locator('body').innerText();await frame.getByRole('checkbox').first().check();await frame.getByRole('checkbox').nth(1).check();await page.waitForTimeout(200)
    const selected=await frame.locator('body').innerText();checks.push({name:'多选活动改变费用',passed:before!==selected&&/已选活动\s*2/.test(selected)})
    await frame.getByRole('tab',{name:'费用分布',exact:true}).click();await frame.getByRole('tab',{name:'两天行程',exact:true}).click();checks.push({name:'切换视图保留人数和活动',passed:await frame.getByRole('spinbutton',{name:'出行人数',exact:true}).inputValue()==='3'&&await frame.getByRole('checkbox').first().isChecked()})
    await frame.getByRole('spinbutton',{name:'总预算',exact:true}).fill('1');await page.waitForTimeout(200);checks.push({name:'低预算显示超支反馈',passed:/超|不足|差额/.test(await frame.locator('body').innerText())})
   }
  }catch(e){actions.push({error:e.message})}
  await page.locator('.cs-stage').screenshot({path:dir+`/played-${width}.png`});if(width===432)await page.locator('.cs-stage').screenshot({path:dir+'/played.png'})
  const aria=await frame.locator('body').ariaSnapshot().catch(e=>e.message),text=await frame.locator('body').innerText().catch(()=>''),layout=await frame.locator('html').evaluate(el=>({clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,clientWidth:el.clientWidth,scrollWidth:el.scrollWidth})).catch(e=>({error:e.message}))
  errors.push(...await page.locator('[role=alert]').allTextContents())
  rows.push({width,initial,actions,checks,text,aria,layout,errors});await page.close()
 }
}finally{await browser.close()}
await writeFile(dir+'/interaction.json',JSON.stringify({candidate:true,traceId:id,scope:'Independent browser checks, not a full requirement pass',rows},null,2))
console.log(JSON.stringify(rows.map(r=>({width:r.width,checks:r.checks,layout:r.layout,actions:r.actions.map(a=>({...a,text:undefined})),errors:r.errors}))))
