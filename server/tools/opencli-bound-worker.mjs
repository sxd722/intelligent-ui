import {randomUUID} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import {OPENCLI_PACKAGE,OPENCLI_VERSION} from './opencli.mjs'
const load=p=>import(pathToFileURL(path.join(OPENCLI_PACKAGE,p)).href)
let cleanup
try{
 let source='';for await(const b of process.stdin){source+=b;if(source.length>4000)throw Error('input too large')}
 const {operation,lease}=JSON.parse(source)
 const {daemonLifecycleHooks}=await load('dist/src/browser/daemon-lifecycle.js')
 for(const key of ['requestDaemonShutdown','spawnDaemonProcess','waitForDaemonStop'])daemonLifecycleHooks[key]=async()=>{throw Error('桥接未就绪；没有修改其他进程')}
 const {fetchDaemonStatus}=await load('dist/src/browser/daemon-transport.js')
 const s=await fetchDaemonStatus({contextId:lease.profile||undefined})
 if(s?.daemonVersion!==OPENCLI_VERSION||!s.extensionConnected||s.profileRequired||s.profileDisconnected)throw Error('兼容的浏览器 profile 未连接')
 const {sendCommand,sendCommandFull,setDaemonCommandTimeoutSeconds}=await load('dist/src/browser/daemon-client.js')
 setDaemonCommandTimeoutSeconds(5)
 if(operation==='bind'){
  const routing={session:'cardspec-bound-'+randomUUID(),surface:'browser',contextId:s.contextId}
  const bound=await sendCommandFull('bind',routing)
  cleanup=()=>sendCommand('close-window',routing)
  // Only a deliberately opened local landing page can be leased. No arbitrary
  // active tab URLs, account pages or model-controlled page identities accepted.
  const info=await sendCommand('exec',{...routing,page:bound.page,code:'({url:location.href,title:document.title})'})
  if(info.url!=='http://127.0.0.1:8787/opencli-probe.html'&&info.url!=='http://localhost:8787/opencli-probe.html')throw Error('选中的不是连接测试页；请手动选中 /opencli-probe.html 后再绑定。未导航其他页面。')
  if(!bound.page)throw Error('绑定未返回页面标识')
  process.stdout.write(JSON.stringify({session:routing.session,profile:s.contextId,daemonPid:s.pid,page:bound.page,url:info.url,title:info.title}))
  cleanup=null
 }else if(operation==='unbind'){
  if(s.pid===lease.daemonPid)await sendCommand('close-window',{session:lease.session,surface:'browser',contextId:lease.profile})
  process.stdout.write('{}')
 }else if(operation==='checkpoint'){
  if(s.pid!==lease.daemonPid)throw Error('daemon 已重启，请重新绑定')
  const result=await sendCommandFull('exec',{session:lease.session,surface:'browser',contextId:lease.profile,code:'({url:location.href,title:document.title,answer:6*7})'})
  if(result.data?.answer!==42||!result.page)throw Error('无法确认原有绑定页')
  process.stdout.write(JSON.stringify({...lease,page:result.page,url:result.data.url,title:result.data.title}))
 }else if(operation==='check'){
  if(s.pid!==lease.daemonPid)throw Error('daemon 已重启，请重新绑定')
  const info=await sendCommand('exec',{session:lease.session,surface:'browser',contextId:lease.profile,page:lease.page,code:'({url:location.href,title:document.title,answer:6*7})'})
  if(info.answer!==42)throw Error('绑定页面脚本测试失败')
  process.stdout.write(JSON.stringify({ok:true,checkedAt:new Date().toISOString(),message:'绑定页脚本测试通过；不创建窗口，不修改页面。'}))
 }else throw Error('unknown binding operation')
}catch(e){process.stderr.write(String(e.message).slice(0,700));process.exitCode=1}
finally{if(cleanup)await cleanup().catch(()=>{})}
