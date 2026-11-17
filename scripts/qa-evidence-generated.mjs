import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {newPage} from '../src/cardspec/tool-session.mjs'
import {makeScope} from '../shared/cardspec/store.mjs'
import {evaluate} from '../shared/cardspec/expression.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
const root='artifacts/evidence-linkage/model-generated';await mkdir(root,{recursive:true})
const r=JSON.parse(await readFile('artifacts/task-cli-design/evidence-guarded/iphone.json','utf8')),p=newPage(r.spec),scope=makeScope(r.spec,p.store,{bindings:p.bindings})
const walk=a=>a.flatMap(n=>[n,...walk(n.children||[])])
const n=walk(r.spec.children).find(n=>n.type==='task-board'),v=evaluate(n.props.view,scope)
const target=v.items.filter(i=>i.classification?.label==='negative').sort((a,b)=>(Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0))[0]
const report=await runDebugBrowser(r.spec,{snapshots:r.spec.prefetched,steps:[
 {op:'click',name:'分类 negative',expect:{changed:true}},
 {op:'click',name:'查看 '+target.title,expect:{text:target.classification.quote,changed:true}},
 {op:'click',name:'打开原始来源 ↗',expect:{navigation:target.url}},
 {op:'click',name:'← 返回候选',expect:{text:target.title}},
 {op:'reload',expect:{text:target.title}},
],scenarios:['normal'],viewports:[432],size:'full',artifactDir:root,captureSteps:true})
await writeFile(root+'/spec.json',JSON.stringify(r.spec));await writeFile(root+'/candidate.cardspec',r.source);await writeFile(root+'/trace.json',JSON.stringify(r));await writeFile(root+'/browser.json',JSON.stringify(report,null,2))
console.log(JSON.stringify({status:report.status,runs:report.runs.map(r=>({errors:r.pageErrors,actions:r.actions.map(a=>({step:a.step,ok:a.ok,assertion:a.assertion,error:a.error,restored:a.restored})),layout:r.final.layout?.issues}))},null,2))
