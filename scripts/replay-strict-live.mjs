import fs from 'node:fs/promises'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
const root='artifacts/strict-stack-qa',live=JSON.parse(await fs.readFile(root+'/live.json','utf8'))
// Correct only the test: React-local record counts are visible text, not the
// unused native recA/recB declarations in the model's draft.
const steps=[{op:'click',name:'记录A',expect:{text:'记录A：1'}},{op:'click',name:'记录B',expect:{text:'记录B：1'}},{op:'click',name:'记录A',expect:{text:'记录A：2'}},{op:'click',name:'放大',expect:{state:{radius:36}}},{op:'reload',expect:{text:['记录A：2','记录B：1'],state:{radius:36}}}]
const result={status:'tested',runs:[]}
for(const width of [320,432]){
 const observed=await runDebugBrowser(live.spec,{steps:[{op:'check'}],scenarios:['normal'],viewports:[width],signal:AbortSignal.timeout(30000)})
 const next=observed.runs[0]?.initial.controls.find(c=>c.name.startsWith('卡片页面：第 2 屏'))
 const replay=await runDebugBrowser(live.spec,{steps:next?[{op:'click',handle:next.handle},...steps]:steps,scenarios:['normal'],viewports:[width],artifactDir:root+'/live-replay',signal:AbortSignal.timeout(60000)})
 if(replay.status!=='tested')result.status=replay.status
 result.runs.push(...replay.runs)
}
await fs.writeFile(root+'/live-replay.json',JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,runs:result.runs.map(r=>({width:r.width,errors:r.final.errors,failed:r.actions.filter(a=>!a.ok||a.assertion?.passed===false||a.restored===false).map(a=>({step:a.step,error:a.error,assertion:a.assertion})),layout:r.final.layout.issues}))}))
