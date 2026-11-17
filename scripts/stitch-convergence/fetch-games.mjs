import {mkdir,writeFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
const root='artifacts/stitch-convergence-20261110/live';await mkdir(root,{recursive:true});
for(const query of ['Lethal Company','ASTRONEER','Portal 2']){
 const body={tool:'opencli.steam.search',input:{query,limit:3},requestId:randomUUID(),pageId:'convergence-qa',sessionId:'convergence-qa',target:'binding',cause:'user'};
 const r=await fetch('http://127.0.0.1:8787/api/tools/invoke',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:8787'},body:JSON.stringify(body)});const text=await r.text();await writeFile(root+'/'+query.replaceAll(' ','-')+'.sse',text);const events=text.split('\n').filter(x=>x.startsWith('data:')).flatMap(x=>{try{return [JSON.parse(x.slice(5))]}catch{return []}});const result=events.find(x=>x.type==='result')?.result;console.log(query,JSON.stringify(result||events.find(x=>x.type==='error')).slice(0,350));if(result)await writeFile(root+'/'+query.replaceAll(' ','-')+'.json',JSON.stringify({tool:body.tool,input:body.input,...result},null,2));
}
