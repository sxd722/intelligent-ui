// Tailscale Serve terminates HTTPS. Keep the existing application's local-only
// boundary intact; only this loopback ingress translates the exact public origin.
import http from 'node:http'
const origin=new URL(process.env.TAILNET_ORIGIN||'https://device.tailnet.ts.net')
if(origin.protocol!=='https:'||!origin.hostname.endsWith('.ts.net'))throw Error('Expected a private Tailscale HTTPS origin')
const writable=new Set(['/api/chat','/api/tools/invoke','/api/workbench/feedback','/api/workbench/events','/api/agent-jobs/start','/api/agent-jobs/release'])
const server=http.createServer((req,res)=>{
 const reject=(code,message)=>res.writeHead(code,{'Content-Type':'text/plain; charset=utf-8'}).end(message)
 if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||req.headers.host!==origin.host)return reject(403,'Tailnet ingress only')
 if(req.headers.origin&&req.headers.origin!==origin.origin&&req.headers.origin!=='null')return reject(403,'Origin not allowed')
 // Opaque iframe origins do not get host APIs.
 if(req.headers.origin==='null')return reject(403,'Opaque origin not allowed')
 const route=new URL(req.url,origin).pathname
 if(!['GET','HEAD'].includes(req.method)&&!(req.method==='POST'&&writable.has(route)))return reject(403,'This management operation is local-only')
 const port=route.startsWith('/api/agent-jobs')?8791:8787
 const headers={...req.headers,host:'127.0.0.1:'+port}
 delete headers['forwarded'];delete headers['x-forwarded-host'];delete headers['x-forwarded-for']
 if(headers.origin)headers.origin='http://127.0.0.1:8787'
 const upstream=http.request({host:'127.0.0.1',port,path:req.url,method:req.method,headers},response=>{
  const out={...response.headers};if(out['access-control-allow-origin'])out['access-control-allow-origin']=origin.origin
  res.writeHead(response.statusCode,out);response.pipe(res)
 });upstream.on('error',()=>{if(!res.headersSent)reject(502,'Local application unavailable');else res.destroy()});req.pipe(upstream);res.on('close',()=>upstream.destroy())
})
server.requestTimeout=0
server.listen(8790,'127.0.0.1',()=>console.log(`Tailnet ingress ${origin.origin} -> 127.0.0.1:8787`))
