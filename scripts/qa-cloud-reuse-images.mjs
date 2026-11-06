import {readFile,writeFile} from 'node:fs/promises'
const root='artifacts/cloud-reuse-qa/images',rows=[]
for(const id of ['story','implicit']){
 const data=JSON.parse(await readFile(`${root}/${id}.json`,'utf8')),job=data.images.find(x=>/^gen:/i.test(x.query))
 for(let i=0;i<2;i++){
  const at=Date.now(),r=await fetch('http://127.0.0.1:8794/api/photo?query='+encodeURIComponent(job.query)+'&role='+job.role),image=await r.json();let imageStatus,bytes
  if(image.content){const p=await fetch('http://127.0.0.1:8794'+image.content);imageStatus=p.status;const buffer=Buffer.from(await p.arrayBuffer());bytes=buffer.length;if(i===0)await writeFile(`${root}/${id}.jpg`,buffer)}
  const row={id,iteration:i,status:r.status,query:job.query,provider:image.provider,cacheHit:image.cacheHit,imageStatus,bytes,ms:Date.now()-at};rows.push(row);console.log(row)
 }
}
await writeFile(`${root}/actual-images.json`,JSON.stringify(rows,null,2))
