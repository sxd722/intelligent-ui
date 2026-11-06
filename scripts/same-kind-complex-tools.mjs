import {randomUUID} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
export async function callTool(tool,input,label){
 const at=Date.now(),response=await fetch('http://127.0.0.1:8787/api/tools/invoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool,input,requestId:randomUUID(),pageId:'same-kind-complex-qa',sessionId:'same-kind-complex-qa',cause:'user',target:'binding'}),signal:AbortSignal.timeout(40000)})
 const raw=await response.text(),frames=raw.split('\n').filter(x=>x.startsWith('data: ')).map(x=>JSON.parse(x.slice(6))),result=frames.find(x=>x.type==='result')?.result,error=frames.find(x=>x.type==='error')
 const record={tool,input,http:response.status,elapsedMs:Date.now()-at,result,error,frames};await mkdir('artifacts/same-kind-complex/tools',{recursive:true});await writeFile(`artifacts/same-kind-complex/tools/${label}.json`,JSON.stringify(record,null,2));console.log(label,record.elapsedMs,error?.error||JSON.stringify(result?.value).slice(0,1800));return record
}
if(process.argv[1]?.endsWith('same-kind-complex-tools.mjs')){
 await callTool('opencli.ctrip.search',{query:'杭州西湖',limit:4},'hangzhou-poi')
 await callTool('opencli.wttr.current',{location:'Hangzhou'},'hangzhou-weather')
 await callTool('opencli.bilibili.search',{query:'幼儿 亲子游戏',limit:3},'toddler-play')
}
