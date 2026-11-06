import {createHash} from 'node:crypto'
import {Buffer} from 'node:buffer'
export const IMAGE_MODEL='gpt-image-2.5-flare'
export const isGeneratedQuery=query=>/^gen:\s*\S/i.test(String(query||''))
const hash=value=>createHash('sha256').update(value).digest('hex')
const roles=['hero','thumbnail','gallery','background']
// One request per prompt/model/size, regardless of subscribers. Persistent bytes
// outlive cards; no model call is required when a card is opened again.
export function createImageService({key,model=IMAGE_MODEL,storage,pexels,fetchImpl=fetch,timeoutMs=120000}){
 const inflight=new Map(),waiting=[];let active=0
 async function slot(signal){
  while(active>=2){signal.throwIfAborted();await new Promise((resolve,reject)=>{const wake=()=>{signal.removeEventListener('abort',abort);resolve()},abort=()=>{const i=waiting.indexOf(wake);if(i>=0)waiting.splice(i,1);reject(signal.reason)};waiting.push(wake);signal.addEventListener('abort',abort,{once:true})})}
  signal.throwIfAborted();active++;return()=>{active--;waiting.shift()?.()}
 }
 async function resolve(query,role,signal){
  const description=query.replace(/^gen:\s*/i,'').trim(),size=role==='thumbnail'?'1024x1024':'1536x1024'
  const id=hash(JSON.stringify(['card-image-v1',model,description.toLowerCase(),size])),metaKey=`generated/${id}.json`,imageKey=`generated/${id}.jpg`
  try{const raw=await storage.read(metaKey);if(raw){const meta=JSON.parse(Buffer.from(raw).toString());if(await storage.read(imageKey))return {...meta,cacheHit:true}}}catch{/* broken cache is a miss */}
  if(!key)return null
  const release=await slot(signal)
  try{
   const response=await fetchImpl('https://api.openai.com/v1/images/generations',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},redirect:'manual',signal,body:JSON.stringify({model,prompt:`Create a polished editorial illustration for a compact interactive card: ${description}. Single coherent scene, clear focal point, subtle material and light, useful at small sizes. No text, no UI controls, no watermark. Illustrative content, not documentary evidence.`,size,quality:'low',n:1,output_format:'jpeg',output_compression:85,background:'opaque'})})
   if(!response.ok){console.warn('[images] OpenAI HTTP',response.status);return null}
   let length=0;const chunks=[];for await(const c of response.body){length+=c.length;if(length>12*1024*1024)throw Error('image response too large');chunks.push(c)}
   const body=JSON.parse(Buffer.concat(chunks).toString()),encoded=body.data?.[0]?.b64_json
   if(typeof encoded!=='string'||encoded.length>12*1024*1024)return null
   const bytes=Buffer.from(encoded,'base64');if(bytes.length<3||bytes.length>8*1024*1024||bytes[0]!==255||bytes[1]!==216)return null
   const result={id,provider:'OpenAI',kind:'generated',model,alt:description,title:description,content:`/api/media/${id}.jpg`,thumb:`/api/media/${id}.jpg`,width:role==='thumbnail'?1024:1536,height:1024,generatedAt:new Date().toISOString()}
   // Persist before returning a URL; otherwise a later isolate cannot serve it.
   await storage.write(imageKey,bytes);await storage.write(metaKey,Buffer.from(JSON.stringify(result)))
   return {...result,cacheHit:false}
  }finally{release()}
 }
 async function photo(query,signal,role='hero'){
  query=String(query||'').trim();if(!isGeneratedQuery(query))return pexels?.(query,signal,role)||null
  if(query.length>100||!roles.includes(role)||!storage||/[\u0000-\u001f]/.test(query))return null
  signal?.throwIfAborted();const k=JSON.stringify([query.toLowerCase(),role==='thumbnail'?'square':'landscape']);let task=inflight.get(k)
  if(!task){if(inflight.size>=8)return null;const controller=new AbortController();task={controller,users:0,done:false};task.promise=resolve(query,role,AbortSignal.any([controller.signal,AbortSignal.timeout(timeoutMs)])).catch(e=>{console.warn('[images] resolution failed',e?.name||'Error');return null}).finally(()=>{task.done=true;inflight.delete(k)});inflight.set(k,task)}
  task.users++
  return new Promise((resolve,reject)=>{let settled=false;const finish=(error,value)=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);task.users--;if(!task.users&&!task.done)task.controller.abort();error?reject(error):resolve(value)},abort=()=>finish(signal.reason||Error('cancelled'));signal?.addEventListener('abort',abort,{once:true});task.promise.then(v=>finish(null,v),e=>finish(e))})
 }
 async function media(filename){if(!/^[a-f0-9]{64}\.jpg$/.test(filename)||!storage)return null;try{const bytes=await storage.read(`generated/${filename}`);return bytes?{bytes,contentType:'image/jpeg'}:null}catch{return null}}
 return {photo,media}
}
