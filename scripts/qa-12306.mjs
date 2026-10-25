import {mkdir,writeFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
const fixed=process.argv.includes('--fixed')
const root=fixed?'artifacts/12306-qa-fixed':'artifacts/12306-qa';await mkdir(root,{recursive:true})
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const before=await(await fetch('http://127.0.0.1:8787/api/tools/connections')).json()
const results=[]
async function invoke(tool,input){
 let result;const started=Date.now()
 try{
 const r=await fetch('http://127.0.0.1:8787/api/tools/invoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool,input,requestId:randomUUID(),pageId:'qa-12306',sessionId:'qa-12306',cause:'user',target:'binding'}),signal:AbortSignal.timeout(40000)})
 const frames=(await r.text()).split('\n').filter(x=>x.startsWith('data: ')).map(x=>JSON.parse(x.slice(6)))
 const error=frames.find(f=>f.type==='error');if(error)throw Error(error.error)
 const value=frames.find(f=>f.type==='result')?.result?.value;if(!value)throw Error('Missing result')
 result={tool,input,status:'passed',value}
 }catch(e){result={tool,input,status:'failed',error:e.message}}
 results.push({...result,elapsedMs:Date.now()-started});await save()
 console.log(JSON.stringify({tool,status:result.status,count:result.value?.items.length,error:result.error}))
 return result.value?.items
}
async function save(){await writeFile(`${root}/real-results.json`,JSON.stringify({date,at:new Date().toISOString(),results},null,2))}
await Promise.all([invoke('opencli.12306.stations',{keyword:'杭州东',limit:3}),invoke('opencli.12306.stations',{keyword:'上海南',limit:3})])
const [rows]=await Promise.all([invoke('opencli.12306.trains',{from:'杭州东',to:'上海南',date,limit:fixed?100:20,...(fixed?{departureAfter:'12:00',departureBefore:'18:00'}:{})}),invoke('opencli.wttr.current',{location:'Hangzhou'})])
if(rows?.length){
 console.log(JSON.stringify({summary:rows.map(r=>({code:r.code,from:r.from_station,to:r.to_station,time:r.start_time,key:r.rowKey})),exactAfternoon:rows.filter(r=>r.from_station==='杭州东'&&r.to_station==='上海南'&&r.start_time>='12:00'&&r.start_time<'18:00').length}))
 const row=rows.find(r=>r.from_station==='杭州东'&&r.to_station==='上海南')||rows[0]
 const input={trainNo:row.train_no,from:row.from_station,to:row.to_station,date}
 await invoke('opencli.12306.train',input);await invoke('opencli.12306.price',input)
}
const after=await(await fetch('http://127.0.0.1:8787/api/tools/connections')).json()
const connection={before:before.browser,after:after.browser,sameSession:before.browser.binding?.session===after.browser.binding?.session}
await writeFile(`${root}/connection.json`,JSON.stringify(connection,null,2))
console.log(JSON.stringify({connectionPreserved:connection.sameSession,bound:after.browser.binding?.bound,connected:after.browser.connected}))
