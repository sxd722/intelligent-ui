import {spawn} from 'node:child_process'

// Optional OS TLS transport for public, credential-free GET adapters. It does
// not touch browser sessions, model requests, or authenticated HTTP requests.
export function systemPublicFetch(nativeFetch,{proxy,spawnImpl=spawn}={}){
 return async(input,init={})=>{
  const request=new Request(input,init),url=new URL(request.url)
  if(request.method!=='GET'||url.protocol!=='https:'||url.username||url.password||request.headers.has('authorization')||request.headers.has('cookie'))return nativeFetch(input,init)
  const marker='\n__PUBLIC_HTTP_META__',args=['--silent','--show-error','--proto','=https','--proto-redir','=https','--location','--max-redirs','4','--connect-timeout','8','--max-time','18','--max-filesize','4194304']
  if(proxy)args.push('--proxy',proxy)
  for(const name of ['accept','accept-language','user-agent'])if(request.headers.has(name))args.push('--header',name+': '+request.headers.get(name))
  args.push('--write-out',marker+'%{json}','--url',url.href)
  return new Promise((resolve,reject)=>{
   const child=spawnImpl(process.platform==='win32'?'curl.exe':'curl',args,{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']})
   let chunks=[],size=0,settled=false,error=''
   const finish=(err,value)=>{if(settled)return;settled=true;clearTimeout(timer);request.signal.removeEventListener('abort',abort);err?reject(err):resolve(value)}
   const abort=()=>{child.kill();finish(request.signal.reason||new Error('Request aborted'))}
   const timer=setTimeout(()=>{child.kill();finish(new Error('Public HTTP transport timeout'))},20000)
   request.signal.addEventListener('abort',abort,{once:true});if(request.signal.aborted)return abort()
   child.stdout.on('data',b=>{size+=b.length;if(size>4205000){child.kill();finish(new Error('Public response exceeds 4 MiB'))}else chunks.push(b)})
   child.stderr.on('data',b=>{error=(error+b.toString()).slice(0,400)})
   child.on('error',e=>finish(e));child.on('close',code=>{
    if(settled)return
    if(code!==0)return finish(new Error('System public HTTP transport failed ('+code+'): '+error))
    try{
     const bytes=Buffer.concat(chunks),index=bytes.lastIndexOf(marker)
     if(index<0)throw Error('Missing public HTTP metadata')
     const meta=JSON.parse(bytes.subarray(index+marker.length).toString()),status=Number(meta.response_code||meta.http_code)
     const response=new Response([204,205,304].includes(status)?null:bytes.subarray(0,index),{status,headers:{'content-type':meta.content_type||'application/octet-stream'}})
     Object.defineProperties(response,{url:{value:meta.url_effective||url.href},redirected:{value:Number(meta.num_redirects)>0}})
     finish(null,response)
    }catch(e){finish(e)}
   })
  })
 }
}
