// Explicit host diagnostic; not a model tool. Owns only its unique blank session.
import {randomUUID} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import {OPENCLI_PACKAGE,OPENCLI_VERSION} from './opencli.mjs'
const load=p=>import(pathToFileURL(path.join(OPENCLI_PACKAGE,p)).href)
let page
try{
 let input='';for await(const b of process.stdin){input+=b;if(input.length>1000)throw Error('input too large')}
 const {profile}=JSON.parse(input)
 const {daemonLifecycleHooks}=await load('dist/src/browser/daemon-lifecycle.js')
 for(const key of ['requestDaemonShutdown','spawnDaemonProcess','waitForDaemonStop'])daemonLifecycleHooks[key]=async()=>{throw Error('桥接未就绪；没有修改其他进程')}
 const {fetchDaemonStatus}=await load('dist/src/browser/daemon-transport.js')
 const status=await fetchDaemonStatus({contextId:profile})
 if(status?.daemonVersion!==OPENCLI_VERSION||!status.extensionConnected)throw Error('兼容的扩展尚未连接')
 const {setDaemonCommandTimeoutSeconds}=await load('dist/src/browser/daemon-client.js');setDaemonCommandTimeoutSeconds(6)
 const {Page}=await load('dist/src/browser/page.js')
 page=new Page('cardspec-probe-'+randomUUID(),15,profile,'background','adapter','ephemeral')
 // 1.8.6 permits only HTTP(S) navigation, including for diagnostics.
 await page.goto('http://127.0.0.1:8787/opencli-probe.html',{waitUntil:'none'})
 if(await page.evaluate('6 * 7')!==42)throw Error('浏览器脚本执行未返回预期结果')
 await page.closeWindow();page=null
 process.stdout.write(JSON.stringify({ok:true,checkedAt:new Date().toISOString(),message:'窗口创建、页面导航和脚本执行通过；网站登录仍需各站点验证。'}))
}catch(e){process.stderr.write(String(e.message).slice(0,700));process.exitCode=1}
finally{if(page)await page.closeWindow().catch(()=>{})}
