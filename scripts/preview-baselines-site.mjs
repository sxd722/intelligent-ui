// Static-only QA server: deliberately has no API, model keys or desktop bridge.
import {createServer} from 'node:http'
import {readFile,stat} from 'node:fs/promises'
import {resolve,extname,sep} from 'node:path'
const root=resolve('sites/intelligent-ui/public')
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.json':'application/json'}
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:8792')
  let file=resolve(root,'.'+decodeURIComponent(url.pathname))
  if(!file.startsWith(root+sep)){res.writeHead(403).end();return}
  if((await stat(file)).isDirectory())file=resolve(file,'index.html')
  res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'})
  res.end(await readFile(file))
 }catch{res.writeHead(404).end('Not found')}
})
server.listen(8792,'127.0.0.1',()=>console.log('Static showcase preview http://127.0.0.1:8792/cardspec-showcase/index.html'))
