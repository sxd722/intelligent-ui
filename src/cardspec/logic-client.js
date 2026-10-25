export function runLogic(payload,signal){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted)return reject(Error('已取消'))
  const worker=new Worker(new URL('./logic-worker.js',import.meta.url),{type:'module'})
  const finish=(error,result)=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);worker.terminate();error?reject(error):resolve(result)}
  const abort=()=>finish(Error('已取消'))
  const timer=setTimeout(()=>finish(Error('逻辑执行超时，已停止本次计算')),5000)
  signal?.addEventListener('abort',abort,{once:true})
  worker.onmessage=({data})=>{if(data.id===1)finish(data.error?Error(data.error):null,data.result)}
  worker.onerror=e=>finish(Error(e.message||'逻辑运行环境不可用'))
  worker.postMessage({id:1,payload})
 })
}
