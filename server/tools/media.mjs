import https from 'node:https'
import dns from 'node:dns'
import {BlockList,isIP} from 'node:net'
import {toolMediaPolicy} from '../../shared/cardspec/tool-media.mjs'

const privateIPs=new BlockList()
const tunProxyIPs=new BlockList();tunProxyIPs.addSubnet('198.18.0.0',15)
for(const [ip,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.1',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.168.0.0',16],['198.18.0.0',15],['224.0.0.0',4],['240.0.0.0',4]])privateIPs.addSubnet(ip,prefix)
export function publicMediaIP(ip){
  if(isIP(ip)===4)return !privateIPs.check(ip)
  return isIP(ip)===6&&/^[23][0-9a-f]{3}:/i.test(ip)&&!/^2001:db8:/i.test(ip)
}
function lookup(host,options,callback){dns.lookup(host,{all:true},(error,addresses)=>{
  if(error)return callback(error)
  // System TUN proxies use the benchmark range as virtual destinations. This
  // lookup is only used for the exact CDN allowlist, with normal TLS hostname
  // verification; local/private hosts and caller-controlled redirects stay denied.
  if(!addresses.length||addresses.some(a=>!publicMediaIP(a.address)&&!(a.family===4&&tunProxyIPs.check(a.address))))return callback(Error('Media DNS address rejected'))
  if(options.all)callback(null,addresses)
  else {const a=addresses.find(a=>!options.family||a.family===options.family)||addresses[0];callback(null,a.address,a.family)}
})}
const failure=(message,statusCode=502)=>Object.assign(Error(message),{statusCode})
function contentType(body){
  if(body.subarray(0,3).equals(Buffer.from([255,216,255])))return 'image/jpeg'
  if(body.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png'
  if(body.toString('ascii',0,4)==='RIFF'&&body.toString('ascii',8,12)==='WEBP')return 'image/webp'
  return null
}
function requestImage(policy,{maxBytes,timeoutMs}){
  return new Promise((resolve,reject)=>{
    const req=https.get(policy.url,{lookup,headers:{Referer:policy.referer,Accept:'image/webp,image/png,image/jpeg'},agent:false},res=>{
      // No redirects, cookies, caller-supplied headers, SVG or HTML are forwarded.
      if(res.statusCode!==200){res.resume();reject(failure(`Image source HTTP ${res.statusCode}`));return}
      if(Number(res.headers['content-length'])>maxBytes){res.destroy();reject(failure('Image exceeds size limit'));return}
      let size=0;const chunks=[]
      res.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){res.destroy();reject(failure('Image exceeds size limit'))}else chunks.push(chunk)})
      res.once('error',reject);res.once('aborted',()=>reject(failure('Image response interrupted')))
      res.once('end',()=>{const body=Buffer.concat(chunks),type=contentType(body);if(!type)reject(failure('Unsupported image bytes'));else resolve({body,type})})
    })
    const timer=setTimeout(()=>req.destroy(failure('Image request timed out')),timeoutMs)
    req.once('close',()=>clearTimeout(timer));req.once('error',reject)
  })
}
export function createToolMediaService({load=requestImage,now=Date.now,maxBytes=2*1024*1024,maxCacheBytes=16*1024*1024,maxEntries=64,timeoutMs=10000}={}){
  const cache=new Map(),pending=new Map();let bytes=0,active=0
  const remove=key=>{bytes-=cache.get(key)?.value?.body.length||0;cache.delete(key)}
  async function get(value){
    const policy=toolMediaPolicy(value);if(!policy)throw failure('Unsupported media URL',400)
    const key=policy.url,old=cache.get(key)
    if(old&&old.expires>now()){if(old.error)throw old.error;return old.value}
    if(old)remove(key)
    if(pending.has(key))return pending.get(key)
    if(active>=4)throw failure('Media busy; retry later',503)
    active++
    const work=(async()=>{
      let entry
      try{const value=await load(policy,{maxBytes,timeoutMs});entry={value,expires:now()+900000};return value}
      catch(e){entry={error:failure(e.message),expires:now()+30000};throw entry.error}
      finally{
        while(cache.size&&(cache.size>=maxEntries||bytes+(entry.value?.body.length||0)>maxCacheBytes))remove(cache.keys().next().value)
        if((entry.value?.body.length||0)<=maxCacheBytes){cache.set(key,entry);bytes+=entry.value?.body.length||0}
      }
    })().finally(()=>{active--;pending.delete(key)})
    pending.set(key,work);return work
  }
  return {get,async handle(req,res){
    if(req.headers['sec-fetch-site']==='cross-site'){res.writeHead(403).end();return}
    try{const {body,type}=await get(new URL(req.url,'http://localhost').searchParams.get('url'));res.writeHead(200,{'Content-Type':type,'Content-Length':body.length,'Cache-Control':'private, max-age=900','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'}).end(body)}
    catch(e){res.writeHead(e.statusCode||502,{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'}).end(e.message)}
  }}
}
