import {readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
import {requirementAudit} from '../server/cardspec/requirements.mjs'
import {normalizeBuildOperation} from '../server/cardspec/build-workspace.mjs'
const id=process.argv[2]
if(!/^[a-f0-9-]{36}$/.test(id||''))throw Error('pass an existing card UUID')
const trace=JSON.parse(await readFile(`artifacts/deep-build/${id}/trace.json`,'utf8')),tests=[]
for(const version of await readdir(`artifacts/generation-debug/${id}`)){
 const dir=`artifacts/generation-debug/${id}/${version}`
 for(const f of await readdir(dir))if(/^test-\d+\.json$/.test(f))tests.push({dir,file:dir+'/'+f,time:(await stat(dir+'/'+f)).mtimeMs})
}
const last=tests.sort((a,b)=>b.time-a.time)[0],test=JSON.parse(await readFile(last.file,'utf8')),source=await readFile(last.dir+'/candidate.cardspec','utf8')
const compiled=compileCard(source,{final:true,cardId:id,context:{renderMode:'hybrid',cardSize:'auto',expressionDialect:'js-v1'}});await validateRichContent(compiled)
if(!compiled.complete)throw Error(JSON.stringify(compiled.diagnostics))
const independentSteps=process.argv[3]?JSON.parse(await readFile(process.argv[3],'utf8')):null
const dir=`artifacts/deep-build-qa/${independentSteps?'independent':'replay'}-${id}`;await mkdir(dir,{recursive:true})
const steps=independentSteps||test.steps
const result=await runDebugBrowser(compiled.spec,{artifactDir:dir,size:'auto',steps})
const claims=new Map();for(const turn of trace.trace){try{const op=normalizeBuildOperation(JSON.parse(turn.raw));for(const c of op.claims||[])claims.set(c.id,c)}catch{}}
const coverage=requirementAudit(trace.plan.requirements,[...claims.values()],{actions:result.runs.filter(r=>r.scenario==='normal').flatMap(r=>r.actions)})
await writeFile(dir+'/result.json',JSON.stringify({sourceVersion:test.version,source,steps,spec:compiled.spec,result,coverage,scope:independentSteps?'Independent QA-authored steps; same model source, no automatic promotion':'Same failed candidate retested after harness fix; no new generation and no automatic promotion'},null,2))
console.log(JSON.stringify({status:result.status,coverage,checks:result.runs.map(r=>({width:r.width,scenario:r.scenario,layout:r.final.layout.pass,actions:r.actions.map(a=>({op:a.step.op,ok:a.ok,assertion:a.assertion?.passed,error:a.error})),errors:r.pageErrors}))},null,2))
