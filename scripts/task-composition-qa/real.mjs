import {writeFile} from 'node:fs/promises'
import {composeTask} from '../../shared/cardspec/task-composition.mjs'
import {ROOT} from './cases.mjs'
const base='http://127.0.0.1:8787',results=[]
const before=(await(await fetch(base+'/api/tools/connections')).json()).browser
for(const [tool,input] of [['opencli.ctrip.search',{query:'杭州湘湖',limit:3}],['opencli.wttr.forecast',{location:'Hangzhou',days:2}],['opencli.bilibili.search',{query:'湘湖亲子',limit:3}]]){
 const start=Date.now(),requestId=crypto.randomUUID(),events=[]
 try{
  const response=await fetch(base+'/api/tools/invoke',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({tool,input,requestId,pageId:'composition-real-qa',sessionId:'composition-real-qa',cause:'user',target:'binding',cache:'reload'}),signal:AbortSignal.timeout(55000)})
  const body=await response.text();for(const line of body.split('\n'))if(line.startsWith('data:'))events.push(JSON.parse(line.slice(5)))
  const result=events.find(e=>e.type==='result')?.result,error=events.find(e=>e.type==='error')
  const view=result?.value?composeTask({main:{tool,input,status:'success',value:result.value}}):null
  results.push({tool,input,http:response.status,ms:Date.now()-start,passed:!!view?.items?.length||!!view?.observations?.length,error:error?.error||(!result?body.slice(0,400):null),events,view})
 }catch(e){results.push({tool,input,ms:Date.now()-start,passed:false,error:e.message})}
 console.log(JSON.stringify({tool,...Object.fromEntries(Object.entries(results.at(-1)).filter(([k])=>['passed','ms','error'].includes(k)))}))
}
const after=(await(await fetch(base+'/api/tools/connections')).json()).browser
await writeFile(ROOT+'/real.json',JSON.stringify({before,after,connectionPreserved:before.binding?.session===after.binding?.session&&before.daemonPid===after.daemonPid&&after.binding?.bound,results},null,2))
