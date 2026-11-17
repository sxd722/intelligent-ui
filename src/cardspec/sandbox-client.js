export function createSandboxClient(){
 const worker=new Worker(new URL('./sandbox-worker.js',import.meta.url),{type:'module'})
 let sequence=0,disposed=false,closeReason='Sandbox stopped';const pending=new Map()
 function close(message='Sandbox stopped'){if(disposed)return;disposed=true;closeReason=message;worker.terminate();for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error(closeReason))}pending.clear()}
 worker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;clearTimeout(p.timer);pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.result)}
 worker.onerror=e=>close(e.message||'Sandbox worker failed')
 return {close,request(type,payload,handler){return new Promise((resolve,reject)=>{
  if(disposed)return reject(Error(closeReason))
  if(pending.size>=8)return reject(Error('Too many pending interactions'))
  const id=++sequence,timer=setTimeout(()=>close('Sandbox execution timed out'),type==='init'?8000:1500)
  pending.set(id,{resolve,reject,timer});worker.postMessage({id,type,payload,handler})
 })}}
}
