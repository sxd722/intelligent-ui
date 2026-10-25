// Explicit research diagnostic: no navigation of existing user tabs, no site data.
import {writeFile,mkdir} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {OPENCLI_PACKAGE,OPENCLI_VERSION,createOpenCli} from '../server/tools/opencli.mjs'
const load=p=>import(pathToFileURL(path.join(OPENCLI_PACKAGE,p)).href)
const {daemonLifecycleHooks}=await load('dist/src/browser/daemon-lifecycle.js')
for(const key of ['requestDaemonShutdown','spawnDaemonProcess','waitForDaemonStop'])daemonLifecycleHooks[key]=async()=>{throw Error('Diagnostic does not modify daemons')}
const {fetchDaemonStatus}=await load('dist/src/browser/daemon-transport.js'),bridge=await fetchDaemonStatus()
if(bridge?.daemonVersion!==OPENCLI_VERSION||!bridge.extensionConnected)throw Error('Matching connected daemon required')
const {sendCommand,bindTab,setDaemonCommandTimeoutSeconds}=await load('dist/src/browser/daemon-client.js');setDaemonCommandTimeoutSeconds(5)
const session='cardspec-owl-research-'+randomUUID(),routing={session,surface:'browser',contextId:bridge.contextId},results=[]
async function probe(name,fn){try{const value=await fn();results.push({name,ok:true,...value})}catch(e){results.push({name,ok:false,error:e.message})}console.log(JSON.stringify(results.at(-1)))}
await probe('1.8.6 doctor',async()=>{const {checkConnectivity}=await load('dist/src/doctor.js');const r=await checkConnectivity({timeout:5});if(!r.ok)throw Error(r.error);return {}})
await probe('windowless transport',async()=>{await sendCommand('cookies',{...routing,domain:'opencli-probe.invalid'});return {}})
let bound=false
await probe('bind existing tab and evaluate constant',async()=>{await bindTab(session,{contextId:bridge.contextId});bound=true;const value=await sendCommand('exec',{...routing,code:'6 * 7'});if(value!==42)throw Error('unexpected result');return {result:value}})
if(bound)await probe('unbind without closing user tab',async()=>{await sendCommand('close-window',routing);return {}})
const cli=createOpenCli()
try{await probe('owned window',async()=>{const r=await cli.diagnose();if(!r.ok)throw Error(r.error||r.message);return {}})}finally{cli.close()}
await mkdir('artifacts/opencli-186',{recursive:true})
await writeFile('artifacts/opencli-186/owl-probes.json',JSON.stringify({version:OPENCLI_VERSION,at:new Date().toISOString(),extensionVersion:bridge.extensionVersion,daemonPid:bridge.pid,results},null,2))
