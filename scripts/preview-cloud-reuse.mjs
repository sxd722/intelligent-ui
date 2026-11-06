// Isolated cloud preview: no OpenCLI process, lease or browser connection code.
import http from 'node:http'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import path from 'node:path'
import {handleApi} from '../sites/intelligent-ui/server/web-adapter.mjs'
import {loadApiKey,loadPexelsKey,loadOpenAIImageKey} from '../server/env.mjs'
const records=new Map(),bucket={async get(k){const r=records.get(k);return r?{body:r.bytes,httpMetadata:r.opts?.httpMetadata,customMetadata:r.opts?.customMetadata,json:async()=>JSON.parse(new TextDecoder().decode(r.bytes)),arrayBuffer:async()=>r.bytes.buffer}:null},async put(k,v,opts){records.set(k,{bytes:typeof v==='string'?new TextEncoder().encode(v):new Uint8Array(v),opts})}}
const env={BUCKET:bucket,MODEL_API_KEY:loadApiKey().value,MODEL_NAME:'glm-5.3-flash',PEXELS_API_KEY:loadPexelsKey().value,OPENAI_IMAGE_API_KEY:loadOpenAIImageKey().value}
const root=path.resolve('sites/intelligent-ui/ui/dist'),art=path.resolve('artifacts/cloud-reuse-qa');await mkdir(art,{recursive:true})
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml'}
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1:8794');let chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks)
 if(url.pathname.startsWith('/qa/result/')&&req.method==='POST'){const id=url.pathname.split('/').at(-1);if(!/^[a-z-]+$/.test(id))throw Error();await writeFile(path.join(art,id+'-browser.json'),body);res.end('saved');return}
 if(url.pathname.startsWith('/api/')){const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort()});const r=await handleApi(new Request(url,{method:req.method,headers:req.headers,signal:controller.signal,...(!['GET','HEAD'].includes(req.method)?{body}: {})}),env);res.writeHead(r.status,Object.fromEntries(r.headers));if(r.body)for await(const c of r.body)res.write(c);res.end();return}
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await readFile(file))
 }catch(e){res.statusCode=500;res.end('Preview error: '+e.message)}}).listen(8794,'127.0.0.1',()=>console.log('Cloud preview http://127.0.0.1:8794/reuse-review.html'))
