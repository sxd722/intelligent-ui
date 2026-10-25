// Explicit local maintenance handoff; does not bind, navigate, or close a tab.
import {spawn} from 'node:child_process'
import {writeFile} from 'node:fs/promises'
import {OPENCLI_ROOT,workerEnv} from '../server/tools/opencli.mjs'
import path from 'node:path'
const connection=await(await fetch('http://127.0.0.1:8787/api/tools/connections')).json(),b=connection.browser
if(!b.connected||b.binding?.mode!=='bound')throw Error('No explicit bound-mode connection to preserve')
if(!b.binding.bound){
 // Preserve the existing unbound state; never fall back to opening an owned window.
 await writeFile(path.join(OPENCLI_ROOT,'binding-handoff.json'),JSON.stringify({expiresAt:Date.now()+300000,mode:'bound',profile:b.profile}))
 console.log(JSON.stringify({preservedMode:'bound',bound:false,daemonPid:b.daemonPid}))
 process.exit(0)
}
const lease={session:b.binding.session,profile:b.profile,daemonPid:b.daemonPid}
const saved=await new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,['server/tools/opencli-bound-worker.mjs'],{env:workerEnv(),shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']})
 let out='',err='';const timer=setTimeout(()=>{child.kill();reject(Error('Checkpoint timed out'))},12000)
 child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b)
 child.once('error',reject);child.once('close',code=>{clearTimeout(timer);if(code)reject(Error(err));else try{resolve(JSON.parse(out))}catch(e){reject(e)}})
 child.stdin.end(JSON.stringify({operation:'checkpoint',lease}))
})
await writeFile(path.join(OPENCLI_ROOT,'binding-handoff.json'),JSON.stringify({expiresAt:Date.now()+300000,lease:saved}))
console.log(JSON.stringify({preservedSession:saved.session,page:saved.page,daemonPid:saved.daemonPid,expiresInSeconds:300}))
