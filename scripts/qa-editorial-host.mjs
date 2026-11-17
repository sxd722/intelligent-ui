import {writeFile,mkdir} from 'node:fs/promises'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
import {editorialSource} from '../tests/editorial.test.mjs'
const root='artifacts/editorial-experience-qa/host';await mkdir(root,{recursive:true})
const {spec}=compileCard(editorialSource,{final:true,context:{expressionDialect:'js-v1',renderMode:'native'}})
spec.context.visualReference={version:1,palette:{base:'#080d13',ink:'#d9e5e8',muted:'#9daeb9',accent:'#91bfca'},regions:['compare','checklist'],typography:'sans',referenceId:'host-fixture'}
const steps=[{op:'click',role:'radio',name:'远行',expect:{state:{mode:'b'},changedResults:['summary']}},{op:'click',role:'checkbox',name:'饮水',expect:{state:{done:['water']},text:'已完成 1/2'}},{op:'click',name:'查看路线依据',expect:{text:'根据停留时间选择行李'}},{op:'reload',expect:{state:{mode:'b',done:['water']},text:'根据停留时间选择行李'}},{op:'click',name:'查看路线依据'},{op:'click',role:'checkbox',name:'外套',expect:{state:{done:['water','coat']},text:'已完成 2/2'}}]
const r=await runDebugBrowser(spec,{steps,viewports:[432,360,320],size:'auto',scenarios:['normal'],captureSteps:true,artifactDir:root})
await writeFile(root+'/result.json',JSON.stringify(r,null,2));await writeFile(root+'/spec.json',JSON.stringify(spec))
console.log(JSON.stringify({status:r.status,runs:r.runs.map(x=>({width:x.width,errors:x.pageErrors,actions:x.actions.map(a=>({name:a.step.name||a.step.op,ok:a.ok,assertion:a.assertion,error:a.error})),layout:x.final?.layout}))}))
