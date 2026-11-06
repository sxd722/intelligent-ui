import {writeFile} from 'node:fs/promises'
const base='http://127.0.0.1:8787',before=(await fetch(base+'/api/tools/connections').then(r=>r.json())).browser,results=[]
for(const [tool,input] of [['opencli.wttr.forecast',{location:'Hangzhou',days:3}],['opencli.12306.trains',{from:'杭州东',to:'上海南',date:'2026-11-06'}],['opencli.dongchedi.score',{series_id:100}]]){
 const start=Date.now(),events=[]
 try{const response=await fetch(base+'/api/tools/invoke',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({tool,input,requestId:crypto.randomUUID(),pageId:'p0p1-live',sessionId:'p0p1-live',cause:'user',target:'binding',cache:'reload'}),signal:AbortSignal.timeout(55000)}),text=await response.text();for(const l of text.split('\n'))if(l.startsWith('data:'))events.push(JSON.parse(l.slice(5)))
 const result=events.find(e=>e.type==='result')?.result,error=events.find(e=>e.type==='error');results.push({tool,input,ms:Date.now()-start,result,error,passed:!!result?.value?.items?.length,events})
 }catch(e){results.push({tool,input,ms:Date.now()-start,passed:false,error:e.message})}
 console.log(JSON.stringify({tool,passed:results.at(-1).passed,error:results.at(-1).error,ms:results.at(-1).ms}))
}
const after=(await fetch(base+'/api/tools/connections').then(r=>r.json())).browser
await writeFile('artifacts/tooling-p0p1-20261103/live-extra.json',JSON.stringify({before,after,connectionPreserved:before.binding?.session===after.binding?.session&&before.daemonPid===after.daemonPid&&after.binding?.bound,results},null,2))
