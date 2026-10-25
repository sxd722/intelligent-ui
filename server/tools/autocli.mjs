import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile,access,mkdir } from 'node:fs/promises'
import path from 'node:path'
import net from 'node:net'
import { fileURLToPath } from 'node:url'
import { validateToolInput,validateJson,FEED_SCHEMA } from '../../shared/cardspec/tools.mjs'
const root=fileURLToPath(new URL('../../',import.meta.url))
export const AUTOCLI_VERSION='0.3.8'
export const AUTOCLI_ARCHIVE_SHA256='cd439179091b28a0c9e373d69e93d767e2dc1e0e61dfc6c0f45607c588e7c1d1'
const directory=path.join(root,'.tools','autocli',AUTOCLI_VERSION)
const binary=path.join(directory,'autocli.exe'),profile=path.join(directory,'profile'),port=19926
export function commandArgs(tool,input){
  validateToolInput(tool,input)
  const [,site,command]=tool.split('.')
  if(!['autocli.hackernews.top','autocli.hackernews.search','autocli.devto.top','autocli.lobsters.hot'].includes(tool))throw new Error('unsupported CLI')
  const args=[site,command,'--limit',String(input.limit??10),'--format','json']
  if(command==='search')args.push('--sort',input.sort||'relevance','--',input.query)
  return args
}
export function normalizeFeed(tool,raw){
  const source=tool.includes('hackernews')?'Hacker News':tool.includes('devto')?'DEV':'Lobsters'
  if(!Array.isArray(raw))throw new Error('CLI output must be a JSON array')
  const number=v=>v==null||v===''||!Number.isFinite(Number(v))?null:Number(v)
  const text=v=>String(v??'').slice(0,2000)
  const items=raw.slice(0,20).map(r=>{
    let url=null;try{const u=new URL(r.url);if(['http:','https:'].includes(u.protocol))url=u.href}catch{}
    const title=text(r.title),author=text(r.author)
    return {id:createHash('sha256').update(`${source}:${url||`${title}:${author}`}`).digest('hex').slice(0,20),title,author,url,rank:number(r.rank),score:number(r.reactions??r.score),scoreLabel:source==='DEV'?'回应':'积分',comments:number(r.comments),tags:(Array.isArray(r.tags)?r.tags:String(r.tags||'').split(',')).map(x=>text(x).trim()).filter(Boolean).slice(0,30)}
  })
  return validateJson({items,source,fetchedAt:new Date().toISOString()},FEED_SCHEMA)
}
export function createAutoCli(){
  let daemon=null,starting=null,active=0,closed=false
  const queue=[],children=new Set()
  const env={...process.env,HOME:profile,USERPROFILE:profile,AUTOCLI_DAEMON_PORT:String(port),RUST_LOG:'off'}
  async function verify(){
    const manifest=JSON.parse(await readFile(path.join(directory,'verified.json'),'utf8'))
    if(manifest.archiveSha256!==AUTOCLI_ARCHIVE_SHA256||createHash('sha256').update(await readFile(binary)).digest('hex')!==manifest.binarySha256)throw new Error('AutoCLI binary verification failed')
    for(const name of ['.autocli/adapters','.autocli/external-clis.yaml','.opencli-rs']){
      let exists=false;try{await access(path.join(profile,name));exists=true}catch{}
      if(exists)throw new Error('AutoCLI private profile contains unapproved adapters/config')
    }
    await mkdir(profile,{recursive:true})
  }
  async function checkPort(){
    await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',()=>reject(new Error('AutoCLI 独立端口 19926 已被占用')));s.listen(port,'127.0.0.1',()=>s.close(resolve))})
  }
  async function available(){try{await verify();if(!daemon&&!starting)await checkPort();return {available:true}}catch(e){return {available:false,reason:e.code==='ENOENT'?'尚未安装已验证的 AutoCLI':e.message}}}
  async function ensureDaemon(){
    if(closed)throw new Error('AutoCLI service closed')
    await verify()
    if(daemon&&daemon.exitCode===null)return
    if(starting)return starting
    starting=(async()=>{
      // Never let AutoCLI's own upgrade logic terminate an unrelated listener.
      await checkPort()
      daemon=spawn(binary,['--daemon'],{env,cwd:profile,windowsHide:true,shell:false,stdio:'ignore'})
      let failure;daemon.once('error',e=>{failure=e});daemon.once('exit',()=>{daemon=null})
      for(let i=0;i<50;i++){
        if(failure)throw failure
        try{const r=await fetch(`http://127.0.0.1:${port}/ping`,{signal:AbortSignal.timeout(300)});const body=await r.text();if(r.ok&&body.includes(AUTOCLI_VERSION))return}catch{}
        await new Promise(r=>setTimeout(r,100))
      }
      daemon?.kill();throw new Error('AutoCLI daemon did not become ready')
    })().finally(()=>{starting=null})
    return starting
  }
  async function acquire(signal){
    signal?.throwIfAborted()
    if(active<2){active++;return}
    await new Promise((resolve,reject)=>{const entry={resolve:()=>{signal?.removeEventListener('abort',abort);resolve()},reject};const abort=()=>{const i=queue.indexOf(entry);if(i>=0)queue.splice(i,1);reject(signal.reason)};queue.push(entry);signal?.addEventListener('abort',abort,{once:true})})
  }
  function release(){const next=queue.shift();if(next)next.resolve();else active--}
  async function invoke(tool,input,signal){
    const args=commandArgs(tool,input)
    await acquire(signal)
    try{
      await ensureDaemon();signal?.throwIfAborted()
      const raw=await new Promise((resolve,reject)=>{
        const child=spawn(binary,args,{env,cwd:profile,windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});children.add(child)
        let output='',stderr='',size=0,settled=false
        const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);children.delete(child);error?reject(error):resolve(value)}
        const cancel=()=>{child.kill();finish(new Error('CLI request cancelled'))}
        const timer=setTimeout(()=>{child.kill();finish(new Error('CLI timeout (30s)'))},30000)
        signal?.addEventListener('abort',cancel,{once:true})
        child.stdout.on('data',b=>{size+=b.length;if(size>1048576){child.kill();finish(new Error('CLI output limit exceeded'))}else output+=b})
        child.stderr.on('data',b=>{stderr=(stderr+b).slice(-2000)})
        child.on('error',e=>finish(e));child.on('close',code=>{if(code!==0)finish(new Error(`CLI exit ${code}: ${stderr.slice(0,300)}`));else try{finish(null,JSON.parse(output))}catch{finish(new Error('CLI returned invalid JSON'))}})
      })
      return normalizeFeed(tool,raw)
    }finally{release()}
  }
  return {available,invoke,close(){closed=true;for(const c of children)c.kill();daemon?.kill();while(queue.length)queue.shift().reject(new Error('service closed'))}}
}
