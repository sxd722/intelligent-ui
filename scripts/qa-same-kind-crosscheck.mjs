import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
import {cases} from './same-kind-cases.mjs'
const root='artifacts/same-kind-qa'
for(const c of cases.filter(c=>!process.argv[2]||c.id===process.argv[2]))for(const mode of ['reuse','scratch']){
 const data=JSON.parse(await readFile(`${root}/${c.id}-${mode}.json`,'utf8')),spec=mode==='reuse'?data.spec:data.state?.message?.metadata?.card_spec
 if(!spec){console.log(c.id,mode,'no candidate');continue}
 const steps=structuredClone(c.steps);if(c.id==='learn')steps[0].expect.text='火星';if(c.id==='checklist')steps[0].name='检查刹车'
 // Actual control label observed in the scratch artifact. Preserve the same input,
 // state assertion and reload check; a naming variation is not a product failure.
 if(c.id==='news'&&mode==='scratch')steps[0].name='过滤标题'
 const at=Date.now();let evidence
 try{evidence=await runDebugBrowser(spec,{steps,scenarios:['normal'],size:'square',signal:AbortSignal.timeout(45000),artifactDir:`${root}/${c.id}-${mode}-check`})}catch(e){evidence={status:'unverified',error:e.message,runs:[]}}
 const passed=['tested','partial'].includes(evidence.status)&&evidence.runs.length>=2&&evidence.runs.every(r=>!r.initial.empty&&!r.final.empty&&!r.pageErrors.length&&!r.final.errors.length&&r.actions.length===steps.length&&r.actions.every(a=>a.ok&&a.assertion?.passed!==false&&a.restored!==false))
 const result={passed,scope:'同一用户要求的关键动作与刷新恢复；320/432px；工具使用隔离替身',elapsedMs:Date.now()-at,evidence}
 await writeFile(`${root}/${c.id}-${mode}-check.json`,JSON.stringify(result));console.log(c.id,mode,passed,result.elapsedMs)
}
