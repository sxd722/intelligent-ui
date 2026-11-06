import {canonicalInput} from '../../shared/cardspec/prefetch.mjs'

// Process-local, bounded cache. Private browser/account data never goes to disk.
export function toolCachePolicy(tool){
  if(tool?.readOnly!==true||!(tool.provider==='opencli'||tool.id?.startsWith('autocli.')))return null
  const volatile=tool.site==='12306'&&tool.command!=='stations'||tool.site==='ctrip'
  return {ttlMs:volatile?15000:tool.command==='stations'?300000:60000,
    scope:tool.browser||tool.auth&&tool.auth!=='none'?'session':'public'}
}
export function createToolResultCache({now=Date.now,maxEntries=128,maxBytes=16*1024*1024,maxEntryBytes=1024*1024}={}){
  const entries=new Map(),pending=new Map();let bytes=0,generation=0
  const remove=k=>{const e=entries.get(k);if(e){bytes-=e.bytes;entries.delete(k)}}
  const clear=()=>{generation++;entries.clear();bytes=0;for(const p of pending.values())p.controller.abort();pending.clear()}
  function subscribe(p,signal){
    signal?.throwIfAborted();p.users++
    return new Promise((resolve,reject)=>{
      let finished=false
      const finish=(fn,value)=>{if(finished)return;finished=true;signal?.removeEventListener('abort',abort);p.users--;if(!p.users&&!p.done)p.controller.abort();fn(value)}
      const abort=()=>finish(reject,signal.reason||new DOMException('Cancelled','AbortError'))
      signal?.addEventListener('abort',abort,{once:true})
      p.promise.then(v=>finish(resolve,structuredClone(v)),e=>finish(reject,e))
    })
  }
  async function get({tool,input,scope='public',policy,mode='default',signal,execute}){
    signal?.throwIfAborted()
    const key=canonicalInput({tool,input,scope}),time=now()
    for(const [k,e]of entries)if(e.expiresAt<=time)remove(k)
    const cached=entries.get(key)
    const envelope=(e,status)=>({...structuredClone(e.result),cache:{status,fetchedAt:e.fetchedAt,expiresAt:new Date(e.expiresAt).toISOString()}})
    if(mode!=='reload'&&cached){entries.delete(key);entries.set(key,cached);return envelope(cached,'hit')}
    let p=pending.get(key)
    if(p?.controller.signal.aborted){pending.delete(key);p=null}
    const joined=!!p
    if(!p){
      p={controller:new AbortController(),users:0,done:false};const current=generation
      p.promise=Promise.resolve().then(()=>execute(p.controller.signal)).then(result=>{
        p.controller.signal.throwIfAborted()
        const entry={result:structuredClone(result),fetchedAt:new Date(now()).toISOString(),expiresAt:now()+policy.ttlMs}
        entry.bytes=Buffer.byteLength(JSON.stringify(entry.result))
        if(current===generation&&entry.bytes<=maxEntryBytes){
          remove(key);entries.set(key,entry);bytes+=entry.bytes
          while(entries.size>maxEntries||bytes>maxBytes)remove(entries.keys().next().value)
        }
        return envelope(entry,'miss')
      }).finally(()=>{p.done=true;if(pending.get(key)===p)pending.delete(key)})
      pending.set(key,p)
    }
    const result=await subscribe(p,signal)
    if(joined)result.cache.status='coalesced'
    return result
  }
  return {get,clear,stats:()=>({entries:entries.size,bytes,pending:pending.size})}
}
