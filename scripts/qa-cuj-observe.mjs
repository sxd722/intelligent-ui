import fs from 'node:fs/promises'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
const base='artifacts/cuj-continuity-qa/final',name=process.argv[2]
if(!['bamboo','cs343','care'].includes(name))throw Error('case required')
const r=JSON.parse(await fs.readFile(`${base}/${name}/result.json`,'utf8'))
for(const [i,card]of r.deck.entries()){
 const dir=`${base}/${name}/initial-${i+1}`
 // A read-only check intentionally suppresses the default click probes.
 const observation=await runDebugBrowser(card.spec,{steps:[{op:'check'}],scenarios:['normal'],viewports:[320,432],size:'auto',artifactDir:dir,signal:AbortSignal.timeout(60000)})
 await fs.writeFile(dir+'/result.json',JSON.stringify(observation,null,2))
 console.log(name,i+1,JSON.stringify(observation.runs?.map(x=>({width:x.width,text:x.initial.text?.slice(0,1800),controls:x.initial.controls.map(c=>({name:c.name,role:c.role})),errors:x.initial.errors,layout:x.initial.layout?.issues}))))
}
