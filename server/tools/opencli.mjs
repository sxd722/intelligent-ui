import {spawn} from 'node:child_process'
import {readFile,mkdir,writeFile,unlink} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import net from 'node:net'
import {createBoundBrowser} from './opencli-bound.mjs'
import {createOpenCliSettings,inspectOpenCliApp,browserProbeFailure} from './opencli-settings.mjs'
import {TOOLS,validateToolInput,validateJson,OPENCLI_RESULT_SCHEMA} from '../../shared/cardspec/tools.mjs'
import {validateTrainWindow} from './12306-query.mjs'
export const OPENCLI_VERSION='1.8.6'
export const OPENCLI_INTEGRITY='sha512-2+phJOV7JkSeQR4uOnapAkhSwQDjNzHYzlCXZJBYiYi7bUxQz95nGbGuXeTseprZWES0kysVGySH63B1HG51hw=='
export const OPENCLI_ROOT=fileURLToPath(new URL('../../.tools/opencli/1.8.6/',import.meta.url))
export const OPENCLI_PACKAGE=path.join(OPENCLI_ROOT,'node_modules/@jackwener/opencli')
export const OPENCLI_PROFILE=path.join(OPENCLI_ROOT,'profile')
export function openCliInput(tool,input){
 validateToolInput(tool,input)
 const t=TOOLS[tool];if(t?.provider!=='opencli')throw new Error('unsupported OpenCLI tool')
 if(t.unsupportedReason)throw new Error(t.unsupportedReason)
 if(tool==='opencli.12306.trains')validateTrainWindow(input)
 if(t.site==='yollomi'){
  let u;try{u=new URL(input.image)}catch{throw new Error('图片需要可访问的 HTTPS URL')}
  if(u.protocol!=='https:'||u.username||u.password||/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(u.hostname))throw new Error('图片需要公开 HTTPS URL')
 }
 return {...t.defaults,...Object.fromEntries(Object.entries(input).map(([k,v])=>{
  if(t.idTypes?.[k]==='string')v=String(v)
  else if(t.idTypes?.[k]==='integer'){
   if(typeof v==='string'&&!/^\d+$/.test(v))throw Error(`${k}: numeric identifier required`)
   v=Number(v);if(!Number.isSafeInteger(v))throw Error(`${k}: invalid identifier`)
   validateJson(v,{...t.inputSchema.properties[k],type:'integer'})
  }
  return [t.mapping[k],v]
 }))}
}
function clean(value,depth=0,bounds={truncated:false}){
 if(depth>12)throw new Error('工具返回数据嵌套过深')
 if(value==null)return null
 if(typeof value==='number')return Number.isFinite(value)?value:null
 if(typeof value==='boolean')return value
 if(typeof value==='string'){if(value.length>20000)bounds.truncated=true;return value.slice(0,20000)}
 if(Array.isArray(value)){if(value.length>500)bounds.truncated=true;return value.slice(0,500).map(v=>clean(v,depth+1,bounds))}
 if(typeof value!=='object')throw new Error('工具返回非 JSON 数据')
 const result={}
 for(const [k,v] of Object.entries(value)){
  if(['__proto__','prototype','constructor'].includes(k))throw new Error('工具返回非法字段')
  result[k]=clean(v,depth+1,bounds)
  if(/url$/i.test(k)&&typeof result[k]==='string'){try{const u=new URL(result[k]);if(!['https:','http:'].includes(u.protocol))result[k]=null}catch{result[k]=null}}
 }
 return result
}
export function normalizeOpenCli(tool,raw,input={}){
 const t=TOOLS[tool]
 const envelope=!Array.isArray(raw)&&raw&&Array.isArray(raw.rows)?raw:null
 if(envelope)raw=envelope.rows
 if(!Array.isArray(raw))throw new Error('OpenCLI output must be an array of records')
 const limit=input.limit??t.defaults?.limit
 const bounds={truncated:t.resultScope==='first-page'||raw.length>100||(envelope?envelope.truncated===true:typeof limit==='number'&&raw.length>=limit)},keys=new Map()
 const items=raw.slice(0,100).map((row,i)=>{
  if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('OpenCLI returned a malformed row')
  const item=clean(row,0,bounds)
  // Cross-tool IDs are opaque strings in cards, even when upstream APIs use
  // numbers. Only native numeric-ID arguments are converted back at dispatch.
  for(const [key,value] of Object.entries(item))if(typeof value==='number'&&/^(id|uid|.*Id|.*_id)$/.test(key))item[key]=String(value)
  for(const col of [...t.columns,...(t.additionalFields||[])])if(!Object.hasOwn(item,col))item[col]=null
  for(const col of t.nullableEmptyFields||[])if(item[col]==='')item[col]=null
  const identity=t.identityFields?JSON.stringify(t.identityFields.map(field=>item[field]??null)):item.id??item.bookId??item.sku??item.train_no??item.shop_id??item.hotelId??item.url??item.uri??item.date??item.location??JSON.stringify(item)
  const key=createHash('sha256').update(`${tool}:${identity}`).digest('hex').slice(0,24),n=(keys.get(key)||0)+1;keys.set(key,n)
  item.rowKey=`row:${n===1?key:`${key}-${n}`}`
  return item
 })
 return validateJson({items,source:`OpenCLI · ${t.site}`,fetchedAt:new Date().toISOString(),truncated:bounds.truncated,...(envelope?.coverage?{coverage:envelope.coverage}:{})},OPENCLI_RESULT_SCHEMA)
}
export async function installed(){
 const pkg=JSON.parse(await readFile(path.join(OPENCLI_PACKAGE,'package.json'),'utf8'))
 const lock=JSON.parse(await readFile(path.join(OPENCLI_ROOT,'package-lock.json'),'utf8'))
 if(pkg.version!==OPENCLI_VERSION||lock.packages?.['node_modules/@jackwener/opencli']?.integrity!==OPENCLI_INTEGRITY)throw new Error('OpenCLI 版本或 npm 完整性不匹配，请运行 npm run tools:install')
}
export function workerEnv(){
 // Never expose model, Pexels or unrelated service credentials to adapters.
 const keep=['SystemRoot','WINDIR','PATH','TEMP','TMP','APPDATA','LOCALAPPDATA','HTTPS_PROXY','HTTP_PROXY','ALL_PROXY','NO_PROXY','NODE_EXTRA_CA_CERTS','SPOTIFY_CLIENT_ID','SPOTIFY_CLIENT_SECRET']
 return {...Object.fromEntries(keep.filter(k=>process.env[k]).map(k=>[k,process.env[k]])),HOME:OPENCLI_PROFILE,USERPROFILE:OPENCLI_PROFILE,OPENCLI_CONFIG_DIR:path.join(OPENCLI_PROFILE,'.opencli'),NO_COLOR:'1'}
}
export function createOpenCli({run,settingsDirectory=OPENCLI_ROOT,restoreHandoff=false}={}){
 let daemon=null,closed=false,active=0,starting=null,config={profile:''},ready
 const queue=[],children=new Set()
 const settings=createOpenCliSettings(settingsDirectory),probes=new Map();let probing=null
 const boundBrowser=createBoundBrowser(controlBinding)
 async function controlBinding(operation,lease){
  if(run)throw Error('Injected CLI runtime cannot control the live browser binding')
  return new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,[fileURLToPath(new URL('./opencli-bound-worker.mjs',import.meta.url))],{env:workerEnv(),cwd:OPENCLI_ROOT,shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});children.add(child)
   let out='',err='',done=false
   const finish=(e,value)=>{if(done)return;done=true;clearTimeout(timer);children.delete(child);e?reject(e):resolve(value)}
   const timer=setTimeout(()=>{child.kill();finish(Error('绑定控制超时，请重试'))},15000)
   child.stdout.on('data',b=>{out+=b;if(out.length>10000){child.kill();finish(Error('绑定输出过长'))}})
   child.stderr.on('data',b=>{err=(err+b).slice(-1000)})
   child.once('error',e=>finish(e));child.once('close',code=>{if(code!==0)return finish(Error(err||'绑定控制失败'));try{finish(null,JSON.parse(out))}catch{finish(Error('绑定返回格式错误'))}})
   child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({operation,lease}))
  })
 }
 ready=(async()=>{
  try{config=JSON.parse(await readFile(path.join(OPENCLI_ROOT,'connection.json'),'utf8'))}catch{}
  // One-use, short-lived local handoff explicitly prepared by the maintainer.
  // This verifies the existing daemon/session/page; it never binds a new tab.
  if(!restoreHandoff||run)return
  const checkpoint=path.join(OPENCLI_ROOT,'binding-handoff.json')
  try{const saved=JSON.parse(await readFile(checkpoint,'utf8'));await unlink(checkpoint)
     if(saved.expiresAt>Date.now()&&saved.expiresAt<Date.now()+600001){
      if(saved.lease?.profile===config.profile)await boundBrowser.restore(saved.lease)
      else if(saved.mode==='bound'&&!saved.lease&&saved.profile===config.profile)await boundBrowser.release()
     }
  }catch(e){if(e.code!=='ENOENT')process.stderr.write('[OpenCLI] Binding handoff unavailable; explicit rebind required\n')}
 })()
 async function bridge(){
  await ready
  try{
   const query=config.profile?`?contextId=${encodeURIComponent(config.profile)}`:''
   const r=await fetch('http://127.0.0.1:19825/status'+query,{headers:{'X-OpenCLI':'1'},signal:AbortSignal.timeout(700)})
   if(!r.ok)throw new Error('bridge unavailable')
   const s=await r.json()
   if(s.daemonVersion!==OPENCLI_VERSION)return {ready:false,connected:false,daemonVersion:s.daemonVersion,reason:`19825 上的桥接版本为 ${s.daemonVersion||'未知'}，项目需要 ${OPENCLI_VERSION}。请使用 CLI 版本一致的 App，或退出 App 的桥接服务后再连接项目运行时；未更改其他进程。`,profiles:[]}
   const connected=!!s.extensionConnected&&!s.profileRequired&&!s.profileDisconnected,profile=s.contextId||config.profile,diagnostic=probes.get(`${s.pid}:${profile}`)
   return {connected,ready:connected&&diagnostic?.ok!==false,diagnostic,daemonPid:s.pid,reason:s.profileRequired?'请选择一个浏览器 profile':s.profileDisconnected?'所选浏览器 profile 未连接':!s.extensionConnected?'打开 Chrome 并启用 OpenCLI 扩展':diagnostic?.ok===false?diagnostic.message:diagnostic?.ok?'浏览器实际操作测试通过；网站登录将在调用时检查':'扩展已连接，尚未验证窗口操作；请运行实际能力测试',profile,profiles:(s.profiles||[]).map(p=>({id:p.contextId,name:p.name||p.contextId})),extensionVersion:s.extensionVersion}
  }catch{return {ready:false,reason:'浏览器桥接未启动；点击连接浏览器，然后启用 Chrome 的 OpenCLI 扩展',profiles:[]}}
 }
 async function status(){
  let ok=true,reason='';try{await installed()}catch(e){ok=false;reason=e.code==='ENOENT'?'OpenCLI 尚未安装，请运行 npm run tools:install':e.message}
  const browser=await bridge(),binding=boundBrowser.status(browser);let spotify=false
  Object.assign(browser,binding.mode==='bound'?{ready:browser.connected&&binding.bound,reason:binding.reason,diagnostic:null}: {},{binding})
  try{const t=JSON.parse(await readFile(path.join(OPENCLI_PROFILE,'.opencli/spotify-tokens.json'),'utf8'));spotify=!!t.access_token&&!!t.refresh_token}catch{}
  return {installed:ok,reason,browser,spotify,version:OPENCLI_VERSION,disabledTools:await settings.get(),desktopApp:await inspectOpenCliApp()}
 }
 async function available(t,s){
  s||=await status()
  if((s.disabledTools||[]).includes(t.id))return {enabled:false,available:false,reason:'已在网页配置中停用',connection:'disabled'}
  if(t.unsupportedReason)return {available:false,reason:t.unsupportedReason,connection:'unsupported-version'}
  if(!s.installed)return {available:false,reason:s.reason,connection:'not-installed'}
  if(t.auth==='oauth'&&!s.spotify)return {available:false,reason:'Spotify 尚未授权；在工具连接中查看授权步骤',connection:'authorization-required'}
  if(t.browser&&!s.browser.ready)return {available:false,reason:s.browser.reason,connection:'browser-required'}
  if(t.browser&&s.browser.binding?.mode==='bound'&&!t.readOnly)return {available:false,reason:'绑定页面模式仅开放读取；写操作请使用桌面 Chrome 独立窗口模式',connection:'bound-read-only'}
  const version=String(s.browser.extensionVersion||'0.0.0').replace(/^v/,'').split('.').map(Number)
  const supportsJournal=version[0]>1||version[0]===1&&(version[1]>0||version[1]===0&&version[2]>=22)
  if(t.browser&&!t.readOnly&&!supportsJournal)return {available:false,reason:'写操作需要 OpenCLI 扩展 1.0.22 或更新版本',connection:'extension-update-required'}
  return {available:true,reason:t.browser?'浏览器已连接，首次调用检查网站登录':t.auth==='oauth'?'已有授权，调用时检查令牌':'无需登录',connection:t.browser?'browser-connected':t.auth==='oauth'?'authorized':'public'}
 }
 async function connect(profile){
  await installed();await ready
  if(typeof profile!=='string'||profile.length>128||/[\r\n]/.test(profile))throw new Error('invalid browser profile')
  await boundBrowser.owned()
  config={profile};await mkdir(OPENCLI_ROOT,{recursive:true});await writeFile(path.join(OPENCLI_ROOT,'connection.json'),JSON.stringify(config))
  if(!starting)starting=(async()=>{
   const s=await bridge();if(s.ready||s.profiles.length)return
   const free=await new Promise(resolve=>{const server=net.createServer();server.once('error',()=>resolve(false));server.listen(19825,'127.0.0.1',()=>server.close(()=>resolve(true)))})
   if(!free)return // Never replace another daemon, even if its version differs.
   await mkdir(OPENCLI_PROFILE,{recursive:true})
   daemon=spawn(process.execPath,[path.join(OPENCLI_PACKAGE,'dist/src/daemon.js')],{env:workerEnv(),cwd:OPENCLI_PROFILE,windowsHide:true,shell:false,stdio:'ignore'})
   daemon.once('error',()=>{});daemon.once('exit',()=>{daemon=null})
   await new Promise(resolve=>setTimeout(resolve,500))
  })().finally(()=>{starting=null})
  await starting;return status()
 }
 async function acquire(signal){
  signal?.throwIfAborted();if(closed)throw new Error('OpenCLI closed')
  if(active<2){active++;return}
  await new Promise((resolve,reject)=>{const task={resolve:()=>{signal?.removeEventListener('abort',abort);resolve()},reject};const abort=()=>{const i=queue.indexOf(task);if(i>=0)queue.splice(i,1);reject(signal.reason)};queue.push(task);signal?.addEventListener('abort',abort,{once:true})})
 }
 async function executionContext(tool){
  const t=TOOLS[tool]
  if(t.browser){const s=await bridge();if(!s.ready)throw new Error(s.reason);return s.profile}
  return t.auth==='oauth'?'project-spotify-profile':'public'
 }
 async function diagnose(){
  const binding=boundBrowser.status(await bridge())
  if(binding.mode==='bound')return boundBrowser.run(lease=>controlBinding('check',lease))
  if(probing)return probing
  probing=(async()=>{
   const s=await bridge()
   if(!s.connected)throw Error(s.reason)
   let result
   try{
    result=await new Promise((resolve,reject)=>{
     const child=spawn(process.execPath,[fileURLToPath(new URL('./opencli-probe-worker.mjs',import.meta.url))],{env:workerEnv(),cwd:OPENCLI_ROOT,shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});children.add(child)
     let out='',err='',done=false
     const finish=(e,value)=>{if(done)return;done=true;clearTimeout(timer);children.delete(child);e?reject(e):resolve(value)}
     const timer=setTimeout(()=>{child.kill();finish(Error('浏览器测试超时'))},20000)
     child.stdout.on('data',b=>{out+=b;if(out.length>10000){child.kill();finish(Error('测试输出过长'))}})
     child.stderr.on('data',b=>{err=(err+b).slice(-700)})
     child.once('error',e=>finish(e));child.once('close',code=>{if(code!==0)return finish(Error(err||'测试进程失败'));try{finish(null,JSON.parse(out))}catch{finish(Error('测试返回格式错误'))}})
     child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({profile:s.profile}))
    })
   }catch(e){result=browserProbeFailure(e)}
   probes.set(`${s.daemonPid}:${s.profile}`,result)
   return {...result,profile:s.profile}
  })().finally(()=>{probing=null})
  return probing
 }
 async function invoke(tool,input,signal,expectedContext){
  const args=openCliInput(tool,input),t=TOOLS[tool]
  if((await settings.get()).includes(tool))throw Error('该工具已在网页配置中停用')
  await ready
  const selectedProfile=config.profile
  await acquire(signal)
  try{
   if(!run){const a=await available(t);if(!a.available)throw new Error(a.reason)}
   if(expectedContext&&expectedContext!==await executionContext(tool))throw new Error('账号或浏览器连接已改变，请重新确认操作')
   signal?.throwIfAborted()
   const execute=bound=>run?run(t,args,signal):new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[fileURLToPath(new URL('./opencli-worker.mjs',import.meta.url))],{env:workerEnv(),cwd:OPENCLI_ROOT,shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});children.add(child)
    let out='',err='',size=0,done=false
    const finish=(e,v)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);children.delete(child);e?reject(e):resolve(v)}
    const timeout=()=>{child.kill();finish(new Error(t.readOnly?'OpenCLI 请求超时':'操作结果未知，请到原站点核对；取消等待不能撤销操作'))}
    // A leased browser page must stay exclusive until its read has actually ended.
    // Cancelling the HTTP consumer discards the result, but must not kill that read.
    const abort=()=>{if(bound&&t.readOnly)return;child.kill();finish(new Error(t.readOnly?'OpenCLI 请求已取消':'操作结果未知，请到原站点核对；取消等待不能撤销操作'))}
    const timer=setTimeout(timeout,t.timeoutMs)
    signal?.addEventListener('abort',abort,{once:true})
    child.stdout.on('data',b=>{size+=b.length;if(size>1048576){child.kill();finish(new Error('OpenCLI output exceeds 1 MiB'))}else out+=b})
    child.stderr.on('data',b=>{err=(err+b).slice(-1000)})
    child.once('error',e=>finish(e));child.once('close',code=>{if(code!==0){let detail;try{detail=JSON.parse(err)}catch{};finish(Object.assign(new Error(detail?.message||err.replace(/(?:Bearer|token|secret)[=: ]+\S+/gi,'[redacted]').slice(-500)||`OpenCLI exit ${code}`),{code:detail?.code}))}else try{finish(null,JSON.parse(out))}catch{finish(new Error('OpenCLI returned invalid JSON'))}})
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({tool,input,bound,profile:bound?.profile||(t.browser&&expectedContext?expectedContext:selectedProfile)}))
   })
   const binding=boundBrowser.status(await bridge())
   const raw=t.browser&&binding.mode==='bound'?await boundBrowser.run(execute,signal):await execute()
   if(!t.readOnly&&raw.some?.(r=>typeof r.status==='string'&&(/[?？]|未知|failed|error/i.test(r.status))))throw new Error('外部操作结果未确认，请先在原站点核对，勿重复提交')
   return normalizeOpenCli(tool,raw,input)
  }finally{const next=queue.shift();if(next)next.resolve();else active--}
 }
 return {status,available,connect,invoke,executionContext,diagnose,bind:async()=>{await installed();const s=await bridge();if(!s.connected)throw Error(s.reason);return boundBrowser.bind(s.profile)},unbind:()=>boundBrowser.release(),configure:ids=>settings.set(ids),close(){closed=true;for(const child of children)child.kill();boundBrowser.close();daemon?.kill();while(queue.length)queue.shift().reject(new Error('OpenCLI closed'))}}
}
