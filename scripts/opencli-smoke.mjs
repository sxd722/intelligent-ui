import {mkdir,writeFile} from 'node:fs/promises'
import {createOpenCli} from '../server/tools/opencli.mjs'
const directory=process.argv.find(s=>s.startsWith('--out='))?.slice(6)||'artifacts/opencli-qa'
await mkdir(directory,{recursive:true})
const provider=createOpenCli(),results=[]
async function check(tool,input){
 const start=Date.now();let result
 try{result={tool,input,status:'passed',value:await provider.invoke(tool,input,AbortSignal.timeout(35000))}}
 catch(e){result={tool,input,status:'external-unavailable',error:e.message}}
 result.elapsedMs=Date.now()-start;results.push(result);console.log(tool,result.status,result.error||'')
 await writeFile(`${directory}/real-reads.json`,JSON.stringify(results,null,2))
 return result
}
const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10)
for(const [tool,input] of [
 ['opencli.12306.stations',{keyword:'上海',limit:3}],
 ['opencli.weread.search',{query:'三体',limit:3}],
 ['opencli.wttr.current',{location:'Shanghai'}],
 ['opencli.wttr.forecast',{location:'Shanghai',days:3}],
 ['opencli.ctrip.search',{query:'杭州',limit:3}],
 ['opencli.12306.trains',{from:'上海虹桥',to:'杭州东',date:tomorrow,limit:3}]
]){
 await check(tool,input)
}
// Follow the actual selected segment, since the API may include nearby stations.
const train=results.find(r=>r.tool==='opencli.12306.trains')?.value?.items?.[0]
if(train)for(const tool of ['opencli.12306.train','opencli.12306.price'])await check(tool,{trainNo:train.train_no,from:train.from_station,to:train.to_station,date:tomorrow})
await writeFile(`${directory}/connections.json`,JSON.stringify(await provider.status(),null,2));provider.close()
