// Isolated worker: import only a host-selected pinned adapter, never user plugins,
// shell commands, dynamic discovery, updates, or arbitrary paths from a card.
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import {TOOLS} from '../../shared/cardspec/tools.mjs'
import {OPENCLI_PACKAGE,OPENCLI_VERSION,openCliInput} from './opencli.mjs'
import {queryTrains} from './12306-query.mjs'
import {guardPublicFetch} from './public-fetch-guard.mjs'
import {browserDocumentCommand} from './browser-document.mjs'
const load=p=>import(pathToFileURL(path.join(OPENCLI_PACKAGE,p)).href)
try{
 let source='';for await(const b of process.stdin){source+=b;if(source.length>30000)throw new Error('input too large')}
 const {tool,input,profile,bound}=JSON.parse(source),t=TOOLS[tool],args=openCliInput(tool,input)
 // Disable upstream's auto-restart/kill policy. This host owns its own lifecycle.
 const {daemonLifecycleHooks}=await load('dist/src/browser/daemon-lifecycle.js')
 for(const key of ['requestDaemonShutdown','spawnDaemonProcess','waitForDaemonStop'])daemonLifecycleHooks[key]=async()=>{throw new Error('浏览器桥接不可用或版本改变，请在工具连接中检查；没有修改其他进程')}
 if(t.browser){
  const {fetchDaemonStatus}=await load('dist/src/browser/daemon-transport.js')
  const s=await fetchDaemonStatus({contextId:profile||undefined})
  if(s?.daemonVersion!==OPENCLI_VERSION||!s.extensionConnected||s.profileRequired||s.profileDisconnected)throw new Error('Chrome 扩展未连接或 profile 不可用')
  if(bound&&(s.pid!==bound.daemonPid||s.contextId!==bound.profile))throw Error('绑定的 daemon 或 profile 已改变，请重新绑定')
 }
 const {installNodeNetwork}=await load('dist/src/node-network.js');installNodeNetwork()
 // The SDK sometimes wraps errors without preserving their code. Retain the
 // last explicit access gate in this single-invocation worker for that case.
 let accessFailure
 if(!t.browser){const guarded=guardPublicFetch(globalThis.fetch);globalThis.fetch=async(...args)=>{try{return await guarded(...args)}catch(e){if(['AUTH_REQUIRED','ACCESS_RESTRICTED','RATE_LIMITED'].includes(e.code))accessFailure=e;throw e}}}
 const {getRegistry}=await load('dist/src/registry.js')
 await load('clis/'+t.module)
 const native=getRegistry().get(`${t.site}/${t.command}`)
 const cmd=native&&browserDocumentCommand(native,t)
 if(!cmd||cmd.browser!==t.browser)throw new Error('Pinned adapter contract mismatch')
 const {executeCommand,prepareCommandArgs}=await load('dist/src/execution.js')
 let result
 if(tool==='opencli.12306.trains')result=await queryTrains(load,args)
 else if(bound){
  if(!t.browser||!t.readOnly)throw Error('Owl 绑定模式目前仅开放浏览器只读工具')
  const {Page}=await load('dist/src/browser/page.js')
  const {setDaemonCommandTimeoutSeconds}=await load('dist/src/browser/daemon-client.js');setDaemonCommandTimeoutSeconds(25)
  const rawPage=new Page(bound.session,undefined,bound.profile,undefined,'browser')
  rawPage._page=bound.page
  const blocked=new Set(['closeWindow','close','newPage','newTab','closeTab','selectTab','setActivePage','setFileInput','waitForDownload'])
  const page=new Proxy(rawPage,{get(target,key){if(blocked.has(key))return async()=>{throw Error('该命令需要独立窗口或额外权限，绑定模式不支持')};const value=target[key];return typeof value==='function'?value.bind(target):value}})
  if(await page.evaluate('6 * 7')!==42)throw Error('绑定页面已失效')
  const prepared=prepareCommandArgs(cmd,args)
  if(typeof cmd.navigateBefore==='string')await page.goto(cmd.navigateBefore)
  if(cmd.func)result=await cmd.func(page,prepared,false)
  else if(cmd.pipeline){const {executePipeline}=await load('dist/src/pipeline/index.js');result=await executePipeline(page,cmd.pipeline,{args:prepared,debug:false})}
  else throw Error('adapter has no executable entry')
 }else try{result=await executeCommand(cmd,args,false,{profile:profile||undefined,trace:'off'})}catch(e){throw accessFailure||e}
 if(t.id==='opencli.jd.add-cart'){
  await load('clis/jd/cart.js')
  const cart=await executeCommand(getRegistry().get('jd/cart'),{},false,{profile:profile||undefined,trace:'off'})
  if(!cart.some(r=>String(r.sku)===String(input.sku)&&Number(r.quantity)>=Number(input.num||1)))throw new Error('加入购物车结果无法回读确认，请到京东核对后再操作')
 }
 process.stdout.write(JSON.stringify(result))
}catch(e){process.stderr.write(JSON.stringify({code:e.code||e.name,message:String(e.message).replace(/(?:Bearer|token|secret)[=: ]+\S+/gi,'[redacted]').slice(0,700)}));process.exitCode=1}
