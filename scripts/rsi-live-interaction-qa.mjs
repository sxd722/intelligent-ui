import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
const root='artifacts/shared-action-rsi-qa/live-interaction';await mkdir(root,{recursive:true})
const record=JSON.parse((await readFile('artifacts/rsi-journal/qa-live-lovecraft-1794470422608/results.jsonl','utf8')).trim().split('\n')[0]),spec=record.results[0].spec
const steps=[{op:'click',name:'海岸线',expect:{state:{theme:'coast'},text:'2 站'}},{op:'click',name:'Kingsport',expect:{state:{sel:'kingsport'},text:'《可怕的老人》《魔宴》'}},{op:'click',name:'关联存在：Brown Jenkin · 布朗·詹金',expect:{state:{view:'jenkin'}}},{op:'click',name:'回到地图站点',expect:{state:{sel:'kingsport',view:'site'}}},{op:'click',name:'内陆河谷',expect:{state:{theme:'inland'},text:'2 站'}},{op:'click',name:'Dunwich',expect:{state:{sel:'dunwich'},text:'《敦威治恐怖事件》'}},{op:'reload',expect:{state:{sel:'dunwich',theme:'inland',view:'site'}}}]
// Correct locator names from the preceding real DOM observation, never source edits.
const observed=JSON.parse(await readFile(root+'/result.json','utf8'))
await writeFile(root+'/locator-initial.json',JSON.stringify(observed,null,2))
steps[1].name=observed.runs[0].final.controls.find(c=>c.name.startsWith('K Kingsport')).name
steps[5].name=observed.runs[0].initial.controls.find(c=>c.name.startsWith('D Dunwich')).name
const result=await runDebugBrowser(spec,{steps,scenarios:['normal'],size:'full',viewports:[432,320],artifactDir:root,captureSteps:true,signal:AbortSignal.timeout(90000)})
await writeFile(root+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,runs:result.runs.map(r=>({width:r.width,actions:r.actions.map(a=>({name:a.step.name,ok:a.ok,assertion:a.assertion,error:a.error,restored:a.restored})),pageErrors:r.pageErrors}))}))
