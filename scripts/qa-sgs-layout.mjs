import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
const dir='artifacts/sgs-harness-20261102/layout'
await mkdir(dir,{recursive:true})
const spec=JSON.parse(await readFile('artifacts/sgs-harness-20261102/final/spec.json','utf8'))
const results=[]
for(const size of ['square','full']){
 const evidence=await runDebugBrowser(spec,{size,viewports:[320,360,432],scenarios:['normal'],steps:[{op:'click',name:'开 始 游 戏'},{op:'reload',expect:{changed:false}}],artifactDir:dir+'/'+size,captureSteps:true})
 await writeFile(dir+'/'+size+'/evidence.json',JSON.stringify(evidence,null,2))
 for(const r of evidence.runs||[])results.push({size,width:r.width,pass:r.actions.every(a=>a.ok&&a.restored!==false&&a.assertion?.passed!==false)&&!r.final.errors.length&&!r.pageErrors.length&&r.final.layout.issues.length===0,issues:r.final.layout.issues,actions:r.actions.map(a=>({ok:a.ok,restored:a.restored,error:a.error}))})
 await writeFile(dir+'/checks.json',JSON.stringify(results,null,2));console.log(results)
}
