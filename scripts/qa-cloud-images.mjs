import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import fs from 'node:fs/promises'
const exec=promisify(execFile),root='artifacts/image-service-qa',base='https://your-site.example.invalid'
async function get(url,file){const r=await exec('curl.exe',['-sS','--http1.1','--max-time','150','-o',file,'-w','%{http_code}',url],{windowsHide:true});return Number(r.stdout)}
await get(base+'/api/health',root+'/cloud-health.json');const health=JSON.parse(await fs.readFile(root+'/cloud-health.json','utf8'));console.log({ok:health.ok,images:health.imageGenerationEnabled,cache:health.imageCache});const results=[]
for(const [name,query]of [['generated','gen: watercolor family picnic by a lake, warm sage and cream'],['pexels','family picnic lake']]){
 for(let i=0;i<2;i++){
  const at=Date.now(),file=`${root}/cloud-${name}-${i}.json`,status=await get(base+'/api/photo?query='+encodeURIComponent(query),file),p=JSON.parse(await fs.readFile(file,'utf8'));let mediaStatus,bytes
  if(p.content){const media=`${root}/cloud-${name}.jpg`;mediaStatus=await get(base+p.content,media);bytes=(await fs.stat(media)).size}
  const row={query,iteration:i,status,provider:p.provider,cacheHit:p.cacheHit,mediaStatus,bytes,ms:Date.now()-at};results.push(row);console.log(row)
 }
}
await fs.writeFile(root+'/cloud-live.json',JSON.stringify({health,results},null,2))
if(results.some(r=>r.status!==200||r.mediaStatus!==200)||results.find(r=>r.provider==='OpenAI'&&r.iteration===1)?.cacheHit!==true)process.exitCode=1
