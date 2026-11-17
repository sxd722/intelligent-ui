import fs from 'node:fs/promises'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
const root='artifacts/editorial-experience-qa'
for(const id of ['forest','routes']){
 const r=JSON.parse(await fs.readFile(`${root}/generated/${id}.json`,'utf8'))
 const steps=id==='forest'?[
 {op:'click',role:'radio',name:'鸟',expect:{state:{sel:'bird'},changedResults:['stage']}},
 {op:'click',role:'checkbox',name:'鸟',expect:{state:{found:['bird']},derived:{count:1}}},
 {op:'click',role:'radio',name:'蘑菇',expect:{state:{sel:'mushroom'},text:'只观察'}},
 {op:'click',role:'checkbox',name:'蘑菇',expect:{derived:{count:2}}},
 {op:'click',role:'radio',name:'树叶',expect:{state:{sel:'leaf'}}},
 {op:'click',role:'checkbox',name:'树叶',expect:{derived:{count:3},text:'三样都发现啦'}},
 {op:'reload',expect:{state:{sel:'leaf'},derived:{count:3}}},
 {op:'click',role:'checkbox',name:'鸟',expect:{derived:{count:2}}}
 ]:[
 {op:'click',name:'选择 Machame',expect:{state:{sel:'machame'},changedResults:['profile'],text:'7天'}},
 {op:'click',name:'选择 Marangu',expect:{state:{sel:'marangu'},changedResults:['profile'],text:'山屋'}},
 {op:'reload',expect:{state:{sel:'marangu'}}},
 {op:'click',name:'选择 Lemosho',expect:{state:{sel:'lemosho'},changedResults:['profile'],text:'8天'}}]
 for(const size of ['square','auto']){
 const dir=`${root}/browser/${id}/${size}`;await fs.mkdir(dir,{recursive:true})
 const result=await runDebugBrowser(r.spec,{steps,viewports:[432,360,320],size,scenarios:['normal'],captureSteps:true,artifactDir:dir,signal:AbortSignal.timeout(100000)})
 await fs.writeFile(dir+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({id,size,status:result.status,runs:result.runs.map(x=>({width:x.width,errors:x.pageErrors,layout:x.final?.layout?.issues,actions:x.actions.map(a=>({name:a.step.name||a.step.op,ok:a.ok,pass:a.assertion?.passed,error:a.error,failures:a.assertion?.failures}))}))}))
 }
}
