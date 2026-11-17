import fs from 'node:fs/promises'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
const root='artifacts/editorial-experience-qa',r=JSON.parse(await fs.readFile(root+'/v2/generated/mountains.json','utf8'))
const steps=[
 {op:'click',name:'02 德雷克海峡',expect:{state:{stage:'drake'},text:'西风带'}},
 {op:'click',name:'补充详情',expect:{text:'固定行李'}},
 {op:'click',name:'补充详情'},
 {op:'click',name:'打包清单',expect:{text:'出发前勾选'}},
 {op:'click',role:'checkbox',name:'晕船药',expect:{derived:{packed:3}}},
 {op:'click',name:'打包清单'},
 {op:'click',name:'03 南极半岛',expect:{state:{stage:'peninsula'},text:'企鹅与冰'}},
 {op:'reload',expect:{state:{stage:'peninsula'},derived:{packed:3}}},
 {op:'click',name:'01 出发港',expect:{state:{stage:'port'},derived:{packed:3}}}
]
for(const size of ['auto','square']){
 const dir=root+'/browser/mountains/'+size;await fs.mkdir(dir,{recursive:true})
 const result=await runDebugBrowser(r.spec,{steps,viewports:[432,360,320],size,scenarios:['normal'],captureSteps:true,artifactDir:dir,signal:AbortSignal.timeout(120000)})
 await fs.writeFile(dir+'/result.json',JSON.stringify(result,null,2))
 console.log(JSON.stringify({size,status:result.status,runs:result.runs.map(x=>({width:x.width,errors:x.pageErrors,issues:x.final?.layout?.issues,actions:x.actions.map(a=>({name:a.step.name||a.step.op,ok:a.ok,pass:a.assertion?.passed,error:a.error,failures:a.assertion?.failures}))}))}))
}
