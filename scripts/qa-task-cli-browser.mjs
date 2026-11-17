import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
const root='artifacts/task-cli-design/weather-browser'
await mkdir(root,{recursive:true})
const result=JSON.parse(await readFile('artifacts/task-cli-design/weather.json','utf8'))
const sh=result.spec.prefetched.find(r=>r.input.location==='Shanghai').value.items[1]
const report=await runDebugBrowser(result.spec,{snapshots:result.spec.prefetched,scenarios:['normal'],viewports:[320,432],size:'full',artifactDir:root,captureSteps:true,steps:[
 {op:'click',name:'上海',expect:{state:{city:'sh',day:''},text:'上海'}},
 {op:'click',name:sh.date.slice(5)+' '+sh.minTempC+'~'+sh.maxTempC+'°C '+sh.description,expect:{state:{day:sh.date},text:sh.date}},
 {op:'reload',expect:{state:{city:'sh',day:sh.date},text:sh.date}},
]})
report.evidence='Replay of the exact real CLI snapshots collected during generation; browser steps do not call live tools.'
await writeFile(root+'/report.json',JSON.stringify(report,null,2))
console.log(JSON.stringify({status:report.status,runs:report.runs.map(r=>({width:r.width,errors:r.pageErrors,actions:r.actions.map(a=>({step:a.step,ok:a.ok,assertion:a.assertion,error:a.error})),screenshot:r.screenshot}))},null,2))
