import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
const root='artifacts/shared-action-rsi-qa/lovecraft-interaction';await mkdir(root,{recursive:true})
const source=await readFile('artifacts/shared-action-rsi-qa/lovecraft-joint/candidate.cardspec','utf8'),compiled=compileCard(source,{final:true,context:{expressionDialect:'js-v1'}})
if(!compiled.complete)throw Error('Fixture unexpectedly invalid')
compiled.spec.context={...compiled.spec.context,expressionDialect:'js-v1',renderMode:'native'}
const steps=[{op:'click',role:'button',name:'跳到 Innsmouth',expect:{state:{stop:'innsmouth'},derived:{cur:{}}}},{op:'click',role:'checkbox',name:'1 · Arkham',expect:{state:{stop:'arkham'}}},{op:'click',role:'button',name:'跳到 Miskatonic',expect:{state:{stop:'miskatonic'}}},{op:'reload',expect:{state:{stop:'miskatonic'}}}]
delete steps[0].expect.derived
const result=await runDebugBrowser(compiled.spec,{steps,scenarios:['normal'],size:'full',viewports:[432,320],artifactDir:root,captureSteps:true,signal:AbortSignal.timeout(90000)})
await writeFile(root+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,runs:result.runs.map(r=>({width:r.width,actions:r.actions.map(a=>({name:a.step.name,ok:a.ok,assertion:a.assertion,error:a.error,restored:a.restored})),pageErrors:r.pageErrors}))}))
