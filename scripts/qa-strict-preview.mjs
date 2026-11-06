// Exercise the real built chat UI with controlled SSE; no production API/CLI.
import fs from 'node:fs/promises'
import path from 'node:path'
import {createServer} from 'node:http'
import assert from 'node:assert/strict'
import {chromium,expect} from '@playwright/test'
import {compileCard} from '../shared/cardspec/compiler.mjs'
const root='artifacts/strict-stack-qa',dist=path.resolve('dist'),requests=[],frames=[]
const first=compileCard('<card><title>已完成主卡</title><text>第一张可用</text></card>',{final:true,cardId:'first'}).spec
const second=compileCard('<card><title>第二张调试稿</title><state id="n" type="number" initial={0}/><button onPress="inc">下一步</button><text>{state.n}</text><action id="inc"><increment target="n"/></action></card>',{final:true,cardId:'second'}).spec
let stream
const send=v=>{frames.push(v);stream.write('data: '+JSON.stringify(v)+'\n\n')}
const meta=v=>send({o:'patch',v:[{p:'/message/metadata',o:'append',v}]})
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://local')
 if(u.pathname==='/api/chat'){stream=res;res.writeHead(200,{'Content-Type':'text/event-stream'});res.flushHeaders();send({type:'phase_begin',id:'p',phase:'dsl',kind:'cardspec',title:'调试预览'});send({p:'',o:'add',v:{message:{status:'running',content:{parts:['']},metadata:{format:'cardspec'}}}});meta({card_spec:first,core_ready:true,card_deck:[{id:'first',status:'ready',spec:first},{id:'second',status:'generating',title:'第二张生成中'}]});return}
 if(u.pathname==='/api/health'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({cardSandbox:true,cardWebSandbox:false,apiKeyLoaded:true}))}
 if(u.pathname.startsWith('/api/')){requests.push(u.pathname);res.setHeader('Content-Type','application/json');return res.end('{}')}
 const file=path.resolve(dist,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(dist+path.sep))throw Error('path')
 res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.wasm':'application/wasm'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file))
 }catch{res.writeHead(404);res.end()}})
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port
const browser=await chromium.launch({channel:'chrome',headless:true}),ctx=await browser.newContext({viewport:{width:1100,height:900}}),page=await ctx.newPage()
await ctx.tracing.start({screenshots:true,snapshots:true})
try{
 await page.addInitScript(()=>localStorage.setItem('cardspec-refine-prompt','off'))
 await page.goto(origin);await page.getByLabel('卡片生成需求').fill('测试两张卡的调试预览');await page.getByRole('button',{name:'发送',exact:true}).click()
 await page.getByRole('button',{name:/第 2 屏，共 2 屏/}).click();await expect(page.getByText('第二张生成中',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'重试此卡'})).toHaveCount(0)
 await page.locator('.cs-deck').screenshot({path:root+'/second-generating.png'})
 meta({card_deck:[{id:'first',status:'ready',spec:first},{id:'second',status:'generating',spec:second,source:'draft'}]})
 await expect(page.getByRole('heading',{name:'第二张调试稿'})).toBeVisible();await expect(page.getByText('调试预览 · 验证完成后启用工具')).toBeVisible();await page.locator('.cs-deck').screenshot({path:root+'/second-preview.png'})
 // Failure preserves the usable candidate but must not masquerade as ready.
 meta({card_deck:[{id:'first',status:'ready',spec:first},{id:'second',status:'error',spec:second,error:'验证未完成，保留预览'}]})
 send({o:'patch',v:[{p:'/message/status',o:'replace',v:'succeeded'}]});send({type:'phase_end',id:'p',status:'succeeded'});send({type:'message_stream_complete',status:'succeeded'});stream.write('data: [DONE]\n\n');stream.end()
 await expect(page.getByRole('button',{name:'重试此卡'})).toBeVisible();await expect(page.getByRole('heading',{name:'第二张调试稿'})).toBeVisible();await page.locator('.cs-deck').screenshot({path:root+'/second-error-retained.png'})
 await page.waitForFunction(()=>{try{return JSON.parse(sessionStorage.getItem('cardspec:conversation:v1')).messages.at(-1).status==='succeeded'}catch{return false}})
 await page.reload();await expect(page.getByRole('heading',{name:'第二张调试稿'})).toBeVisible();await expect(page.getByRole('button',{name:'重试此卡'})).toBeVisible()
 assert(!requests.some(p=>p.includes('/invoke')))
 await fs.writeFile(root+'/preview-browser.json',JSON.stringify({pendingSibling:true,draftVisible:true,errorRetainsDraft:true,restoredIncomplete:true,automaticInvokes:0,frames},null,2))
 console.log('preview lifecycle passed')
}finally{await ctx.tracing.stop({path:root+'/preview-browser-trace.zip'});await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok))}
