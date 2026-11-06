import fs from 'node:fs/promises';
import {createToolDiscovery} from '../../server/tools/semantic-discovery.mjs';
const dir='artifacts/election-stitch';await fs.mkdir(dir,{recursive:true});
const catalog=JSON.parse(await fs.readFile(dir+'/catalog.json')).tools;
const discovery=createToolDiscovery();const prompts=['美国中期选举各州实时票数、参众议院席位与最新新闻，每五分钟刷新','美国政治新闻与选举报道','最新新闻'];
const results=[];try{await discovery.warm(catalog);for(const query of prompts){const r=await discovery.discover(catalog,query,{timeoutMs:15000});results.push({query,...r});console.log(query,r.tools.map(t=>t.id));}}finally{discovery.close()}
await fs.writeFile(dir+'/discovery.json',JSON.stringify(results,null,2));
for(const [tool,input] of [['opencli.google.news',{keyword:'US midterm elections 2026 results',lang:'en',region:'US',limit:6}],['opencli.bbc.topic',{topic:'world',limit:8}]]){
 const payload={tool,input,cache:'reload',requestId:crypto.randomUUID(),sessionId:'election-design-qa',pageId:'election-evidence',cause:'user',target:'binding'};const start=Date.now();
 try{const r=await fetch('http://127.0.0.1:8787/api/tools/invoke',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:8787'},body:JSON.stringify(payload),signal:AbortSignal.timeout(45000)});const frames=(await r.text()).split('\n').filter(l=>l.startsWith('data:')).map(l=>JSON.parse(l.slice(5)));await fs.writeFile(dir+'/'+tool+'.json',JSON.stringify({payload,elapsedMs:Date.now()-start,frames},null,2));console.log(tool,JSON.stringify(frames.find(x=>x.type==='result')?.result?.value||frames.find(x=>x.type==='error')).slice(0,850));}catch(e){await fs.writeFile(dir+'/'+tool+'.json',JSON.stringify({payload,error:e.message}));console.log(tool,e.message)}
}
