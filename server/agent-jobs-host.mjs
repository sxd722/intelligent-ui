import {spawn} from 'node:child_process'
import {openSync,closeSync,mkdirSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
// Separate process: keeping or restarting this helper never replaces the tool host.
export async function ensureAgentJobs(){
 const url='http://127.0.0.1:8791/api/agent-jobs?case=reg-01-counter&track=trae-cardspec'
 try{const r=await fetch(url,{signal:AbortSignal.timeout(1500)});if(r.ok)return;throw Error('Port 8791 is occupied by another service')}catch(e){if(e.message.includes('occupied'))throw e}
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'artifacts/rsi-agent');mkdirSync(dir,{recursive:true})
 const stdout=openSync(path.join(dir,'jobs-service.log'),'a'),stderr=openSync(path.join(dir,'jobs-service-error.log'),'a')
 try{const child=spawn(process.execPath,[path.join(root,'server/agent-jobs.mjs')],{cwd:root,windowsHide:true,detached:true,stdio:['ignore',stdout,stderr],shell:false});child.on('error',e=>console.warn('[agent-jobs]',e.message));child.unref()}finally{closeSync(stdout);closeSync(stderr)}
}
