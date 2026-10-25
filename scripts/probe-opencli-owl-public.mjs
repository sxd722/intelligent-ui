// Explicit local research: bind only a dedicated probe tab, run upstream read adapters.
import {mkdir, writeFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {OPENCLI_PACKAGE, OPENCLI_VERSION} from '../server/tools/opencli.mjs'
const load = p => import(pathToFileURL(path.join(OPENCLI_PACKAGE,p)).href)
const {daemonLifecycleHooks} = await load('dist/src/browser/daemon-lifecycle.js')
for (const key of ['requestDaemonShutdown','spawnDaemonProcess','waitForDaemonStop']) daemonLifecycleHooks[key] = async()=>{throw Error('Research must not modify daemon')}
const {fetchDaemonStatus} = await load('dist/src/browser/daemon-transport.js')
const bridge = await fetchDaemonStatus()
if (bridge?.daemonVersion !== OPENCLI_VERSION || !bridge.extensionConnected) throw Error('Matching connected daemon required')
const {bindTab, sendCommand, setDaemonCommandTimeoutSeconds} = await load('dist/src/browser/daemon-client.js')
const {Page} = await load('dist/src/browser/page.js')
setDaemonCommandTimeoutSeconds(20)
const session = 'cardspec-owl-public-'+randomUUID()
const routing = {session,surface:'browser',contextId:bridge.contextId}
const page = new Page(session,undefined,bridge.contextId,undefined,'browser')
const results = []
const inspect = () => page.evaluate('({url:location.href,title:document.title,text:document.body.innerText.slice(0,5000)})')
async function probe(name, fn) {
  try { results.push({name,ok:true,...await fn()}) }
  catch(e) { results.push({name,ok:false,code:e.code,error:e.message}); try {results.at(-1).page=await inspect()}catch{} }
  console.log(JSON.stringify(results.at(-1)))
}
let bound = false
try {
  await bindTab(session,{contextId:bridge.contextId}); bound=true
  const initial = await inspect()
  if(initial.url !== 'http://127.0.0.1:8787/opencli-probe.html') {
    results.push({name:'bound target guard',ok:false,actualUrl:initial.url,expectedUrl:'http://127.0.0.1:8787/opencli-probe.html',error:'OpenCLI bound a different tab; no navigation performed'})
    throw Error('Refusing to navigate unexpected tab: '+initial.url)
  }
  results.push({name:'bound dedicated Codex tab',ok:true,page:initial})
  await load('clis/douban/movie-hot.js')
  const {getRegistry} = await load('dist/src/registry.js')
  await probe('upstream douban/movie-hot adapter via bound Page',async()=>{
    const items = await getRegistry().get('douban/movie-hot').func(page,{limit:5})
    if(!Array.isArray(items)||items.length===0) throw Error('Empty adapter result')
    return {items,page:await inspect()}
  })
  await probe('Douban Top 250 page via OpenCLI browser',async()=>{
    await page.goto('https://movie.douban.com/top250')
    return {page:await inspect()}
  })
} catch(e) {
  console.error(e.message)
  process.exitCode=1
} finally {
  if(bound) await probe('unbind without closing tab',async()=>{await sendCommand('close-window',routing);return {}})
  await mkdir('artifacts/opencli-owl-public',{recursive:true})
  await writeFile('artifacts/opencli-owl-public/results.json',JSON.stringify({at:new Date().toISOString(),version:OPENCLI_VERSION,extensionVersion:bridge.extensionVersion,profile:bridge.contextId,results},null,2))
}
