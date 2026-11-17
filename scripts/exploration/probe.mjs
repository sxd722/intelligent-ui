import fs from 'node:fs/promises'
import {createHash,randomUUID} from 'node:crypto'
import {chromium} from 'playwright'
import {loadApiKey} from '../../server/env.mjs'
import {createModelClient} from '../../server/research/model-client.mjs'
import {redact} from '../../server/rsi-journal.mjs'
import {compileCard} from '../../shared/cardspec/compiler.mjs'
import {runDebugBrowser} from '../../server/cardspec/debug-browser.mjs'
const root='experiments/round1-20261117'
await fs.mkdir(root+'/p0',{recursive:true})
const health=JSON.parse(await fs.readFile(root+'/health.json','utf8'))
const result={at:new Date().toISOString(),compiler:{},browser:{},model:{},tools:[]}
const fixture='<card schemaVersion="1" actionMode="snapshot"><state id="n" type="number" initial={0}/><title>独立宿主计数探针</title><text>{state.n}</text><button onPress="add">增加一次</button><action id="add"><increment target="n"/></action></card>'
const compiled=compileCard(fixture,{final:true,context:{expressionDialect:'js-v1'},cardId:randomUUID()})
result.compiler={complete:compiled.complete,diagnostics:compiled.diagnostics,sourceHash:createHash('sha256').update(fixture).digest('hex')}
await fs.writeFile(root+'/p0/fixture.cardspec',fixture)
const browser=await chromium.launch({channel:'chrome',headless:true})
try{const page=await browser.newPage({viewport:{width:432,height:900}});await page.setContent('<html><body style="margin:0;background:#eb273c;width:180px;height:180px"></body></html>');await page.screenshot({path:root+'/p0/vision-red.png',clip:{x:0,y:0,width:180,height:180}})
result.browser=await page.evaluate(()=>{const c=document.createElement('canvas');const g=c.getContext('webgl2')||c.getContext('webgl');return {userAgent:navigator.userAgent,webgl:!!g,webgpuAPI:!!navigator.gpu,canvas2d:!!document.createElement('canvas').getContext('2d'),screenshot:true}})}finally{await browser.close()}
try{result.fixtureReplay=await runDebugBrowser(compiled.spec,{steps:[{op:'click',name:'增加一次',expect:{state:{n:1}}},{op:'reload',expect:{state:{n:1}}}],scenarios:['normal'],viewports:[432,320],artifactDir:root+'/p0/browser',signal:AbortSignal.timeout(45000)})}catch(e){result.fixtureReplay={status:'unverified',error:e.message}}
const key=loadApiKey();const requests=[]
const model='volcengine/deepseek-v4.1-flash'
const round=createModelClient({base:health.upstream,key:key.value,model,fetchImpl:async(url,options)=>{requests.push(redact(JSON.parse(options.body)));return fetch(url,options)}})
for(const [kind,content] of [['text','Reply with exactly READY.'],['vision',[{type:'text',text:'What single colour fills this image? Reply only the colour name.'},{type:'image_url',image_url:{url:'data:image/png;base64,'+(await fs.readFile(root+'/p0/vision-red.png')).toString('base64')}}]]]){
const start=Date.now();try{const r=await round([{role:'user',content}],{maxTokens:80,signal:AbortSignal.timeout(45000)});result.model[kind]={status:'completed',requested:model,resolved:r.model,content:r.message.content,usage:r.usage??null,elapsedMs:Date.now()-start,correct:kind==='text'?r.message.content.trim()==='READY':/red|红/i.test(r.message.content)}}catch(e){result.model[kind]={status:'failed',requested:model,error:e.message,elapsedMs:Date.now()-start}}}
await fs.writeFile(root+'/p0/model-requests.json',JSON.stringify(requests,null,2))
await fs.writeFile(root+'/capabilities.json',JSON.stringify(result,null,2))
console.log(JSON.stringify({compiler:result.compiler.complete,browser:result.browser,fixture:result.fixtureReplay.status,model:result.model}))
