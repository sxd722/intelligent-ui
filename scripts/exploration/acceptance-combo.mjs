// Independent P2 evaluator. No model/CLI/source repair; plans are evaluator-only.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {sha256,layoutChecks} from './acceptance.mjs'
import {classifyIndependentFindings} from './evaluate-run.mjs'
import {runDebugBrowser} from '../../server/cardspec/debug-browser.mjs'
const root=resolve('experiments/round1-20261117'),read=async p=>JSON.parse(await readFile(p,'utf8'))
const norm=x=>String(x??'').replace(/\s+/g,' ').trim()
const unsafe=new Set(['__proto__','constructor','prototype'])
export function observedPath(object,path){
 if(typeof path!=='string'||path.split('.').some(x=>unsafe.has(x)))return {found:false}
 let value=object;for(const key of path.split('.')){if(value==null||!Object.hasOwn(Object(value),key))return {found:false};value=value[key]}
 return {found:true,value}
}
function completedIds(snapshot,definition){
 const r=observedPath(snapshot,definition?.path);if(!r.found)return r
 if(definition.kind==='array'&&Array.isArray(r.value))return {found:true,value:r.value.map(x=>definition.idField?x?.[definition.idField]:x)}
 if(definition.kind==='record'&&r.value&&typeof r.value==='object'&&!Array.isArray(r.value))return {found:true,value:Object.entries(r.value).filter(([,v])=>(definition.doneValues||[true]).includes(v)).map(([k])=>k)}
 return {found:false}
}
function normalizeQuestions(snapshot,definition){
 const r=observedPath(snapshot,definition?.path);if(!r.found)return r
 if(definition.kind==='array'&&Array.isArray(r.value)){
  const values=r.value.map(row=>Object.fromEntries(Object.entries(definition.fields||{}).map(([k,path])=>[k,observedPath(row,path).value])))
  return {found:true,value:values.filter(x=>norm(x.text))}
 }
 if(definition.kind==='keyed'&&r.value&&typeof r.value==='object'&&!Array.isArray(r.value)){
  if(typeof definition.separator!=='string'||!definition.separator)return {found:false}
  return {found:true,value:Object.entries(r.value).map(([key,value])=>({ ...Object.fromEntries((definition.order||[]).map((name,i)=>[name,key.split(definition.separator)[i]])),text:definition.textField?observedPath(value,definition.textField).value:value})).filter(x=>norm(x.text))}
 }
 return {found:false}
}
export function expectedQuestionRecords(task,path){
 let current={...task.data.initialSelection};const positions={},questions=new Map()
 for(const op of path.operations){
  if(op.intent==='selectRecording'){positions[current.recordingId]={...current};current=positions[op.recordingId]||{recordingId:op.recordingId,sourceId:null,segmentId:null}}
  if(op.intent==='selectSource')current.sourceId=op.sourceId
  if(op.intent==='selectSegment')current.segmentId=op.segmentId
  if(op.intent==='saveQuestion'){if(!task.data.segments.some(s=>['recordingId','sourceId','segmentId'].every(k=>s[k]===current[k])))throw Error('Oracle path does not determine a unique question anchor');questions.set(JSON.stringify(current),{...current,text:op.text})}
  if(op.intent==='findSavedQuestion'){const hit=[...questions.values()].find(q=>q.text===op.text);if(!hit)throw Error('Oracle refers to an unsaved question');current={recordingId:hit.recordingId,sourceId:hit.sourceId,segmentId:hit.segmentId}}
 }
 return [...questions.values()]
}
const sameSet=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===new Set(a).size&&JSON.stringify([...a].sort())===JSON.stringify([...b].sort())
const check=(id,found,passed,expected,actual,evidence)=>({id,status:!found?'unverified':passed?'passed':'failed',expected,actual,evidence:[evidence]})

export function checkComboCheckpoint(task,snapshot,expected,mapping,evidence){
 const checks=[]
 if(task.id==='combo-01-release-rehearsal'){
  const c=completedIds(snapshot,mapping.completed),known=new Set(task.data.steps.map(s=>s.id))
  checks.push(check('completed-set',c.found,c.found&&sameSet(c.value,expected.completed),expected.completed,c.value,evidence))
  if(c.found)checks.push(check('dependency-invariant',true,c.value.every(id=>known.has(id)&&task.data.steps.find(s=>s.id===id).requires.every(k=>c.value.includes(k))),true,c.value,evidence))
  for(const [key,path]of [['count',mapping.count],['effortMinutes',mapping.effortMinutes],['delivered',mapping.delivered]])if(Object.hasOwn(expected,key)){
   const got=observedPath(snapshot,path);checks.push(check(key,got.found,got.value===expected[key],expected[key],got.value,evidence))
  }
  if(expected.missingPrerequisite){const label=task.data.steps.find(s=>s.id===expected.missingPrerequisite)?.name;checks.push(check('missing-prerequisite-visible',typeof snapshot.text==='string',norm(snapshot.text).includes(label),label,snapshot.text,evidence))}
 }else{
  const selection=Object.fromEntries(['recordingId','sourceId','segmentId'].map(k=>[k,observedPath(snapshot,mapping.selection?.[k])]))
  checks.push(check('composite-selection',Object.values(selection).every(x=>x.found),Object.entries(expected.selection).every(([k,v])=>selection[k]?.value===v),expected.selection,Object.fromEntries(Object.entries(selection).map(([k,v])=>[k,v.value])),evidence))
  const record=task.data.segments.find(s=>Object.entries(expected.selection).every(([k,v])=>s[k]===v))
  checks.push(check('current-full-source-text',typeof snapshot.text==='string',norm(snapshot.text).includes(norm(record.text)),record.text,snapshot.text,evidence))
  for(const [key,value]of [['startSeconds',record.startSeconds],['endSeconds',record.endSeconds]]){const got=observedPath(snapshot,mapping[key]);checks.push(check(key,got.found,got.value===value,value,got.value,evidence))}
  const q=normalizeQuestions(snapshot,mapping.questions),anchored=q.found?q.value.filter(x=>Object.entries(expected.selection).every(([k,v])=>x[k]===v)):[]
  if(Object.hasOwn(expected,'question'))checks.push(check('anchored-question',q.found,expected.question===null?anchored.length===0:anchored.length===1&&anchored[0].text===expected.question,expected.question,anchored,evidence))
  if(expected.savedQuestionCount!==undefined)checks.push(check('saved-question-count',q.found,q.value?.length===expected.savedQuestionCount,expected.savedQuestionCount,q.value?.length,evidence))
  if(q.found)checks.push(check('all-question-anchors-valid',true,q.value.every(x=>task.data.segments.some(s=>['recordingId','sourceId','segmentId'].every(k=>s[k]===x[k]))),true,q.value,evidence))
 }
 return checks
}

export async function evaluateComboRun(directory,{execute=false,inventory=false,revision='combo-independent-r1',planFile}={}){
 directory=resolve(directory);const result=await read(join(directory,'result.json')),request=await read(join(directory,'request.json'))
 const tasks=await read(join(root,'tasks/combo.json')),oracles=await read(join(root,'tasks/oracles-combo.json')),freeze=await read(join(root,'tasks/combo-frozen-hashes.json'))
 if(sha256(await readFile(join(root,'tasks/combo.json'),'utf8'))!==freeze.taskFile.sha256||sha256(await readFile(join(root,'tasks/oracles-combo.json'),'utf8'))!==freeze.evaluatorOnlyFile.sha256)throw Error('Frozen combo task/oracle bytes changed')
 const taskId=request.taskId||request.task?.id,resultTask=result.taskId||result.task?.id,task=tasks.tasks.find(t=>t.id===(taskId||resultTask));if(!task)throw Error('Unknown combo task')
 const oracle=oracles.tasks[task.id],out=join(directory,'evaluation',revision),plan=planFile?await read(resolve(planFile)):await read(join(directory,'evaluation/combo-plan.json')).catch(()=>null)
 if(!execute)return {dryRun:true,run:directory,task:task.id,hasSpec:!!result.spec,planReady:!!plan,mode:inventory?'inventory':'frozen-paths',out}
 await mkdir(out,{recursive:true});if(await read(join(out,'acceptance.json')).catch(()=>null))throw Error('Evaluation already exists; preserve prior attempt and use new revision')
 const runRecord=await read(join(directory,'run.json')),generationDelivery={status:runRecord.result?.generationStatus||'unknown',error:runRecord.result?.error||null,retainedArtifact:!!result.spec&&runRecord.result?.generationStatus==='failed',unverifiedPreview:result.unverifiedPreview??null};
 const sourceHash=result.source?sha256(result.source):null,contextHash=sha256(result.spec?.context||{}),identity={generationDelivery,deliveryStatus:generationDelivery.status==='failed'?'failed':'delivered',taskId:task.id,sourceHash,artifactHash:sourceHash,contextHash,oracleHash:sha256(oracle),taskHash:task.promptHash,modelCalls:0,liveToolCalls:0,sourceUnmodified:true,oracleUnchanged:true,manualIntervention:null}
 if(!result.spec){const a={...identity,status:'failed',businessStatus:'unverified',layoutStatus:'unverified',artifactDelivered:false,checks:[{id:'delivery',status:'failed',reason:'No committed compiled artifact; no hand repair or replacement.'}]};await writeFile(join(out,'acceptance.json'),JSON.stringify(a,null,2));await writeFile(join(directory,'acceptance.json'),JSON.stringify({...a,evaluationPath:out},null,2));return a}
 if(plan&&plan.sourceHash!==sourceHash)throw Error('Plan targets a different exact source')
 const snapshots=await read(join(directory,'snapshots.json')).catch(()=>[]),replayMode=request.replayMode
 if(inventory){const browser=await runDebugBrowser(result.spec,{steps:[{op:'check'}],scenarios:['normal'],viewports:[432],size:'square',snapshots,replayMode,captureSteps:true,artifactDir:join(out,'inventory'),signal:AbortSignal.timeout(60000)});await writeFile(join(out,'inventory.json'),JSON.stringify({identity,browser},null,2));return {inventory:true,out,controls:browser.runs?.[0]?.final?.controls}}
 if(!plan)throw Error('No independently authored source-bound interaction plan; inventory first')
 const paths=oracle.paths,steps=paths.flatMap(p=>(plan.paths?.[p.id]?.steps||[]).map(s=>{const {oracleAfter,blockedControl,...step}=s;return {...step,path:p.id}}))
 await writeFile(join(out,'manifest.json'),JSON.stringify({...identity,plan,createdAt:new Date().toISOString(),locatorBasis:'Observed UI and source label/entity scope; not generated expected outputs.'},null,2))
 const browser=await runDebugBrowser(result.spec,{steps:steps.length?steps:[{op:'check'}],scenarios:['normal'],viewports:[432],size:'square',snapshots,replayMode,captureSteps:true,artifactDir:join(out,'paths'),signal:AbortSignal.timeout(180000)})
 await writeFile(join(out,'browser.json'),JSON.stringify(browser,null,2))
 const checks=[],unresolved=[]
 for(const p of paths){const r=browser.runs?.find(x=>x.path===p.id),configured=plan.paths?.[p.id]?.steps||[]
  const marked=new Set(configured.map(s=>s.oracleAfter).filter(Number.isInteger)),missing=p.operations.map((_,i)=>i+1).filter(i=>!marked.has(i))
  checks.push(check(p.id+'-operation-coverage',!!r,!!r&&!missing.length&&r.actions.every(a=>a.ok&&!a.skipped),p.operations.map((op,i)=>({after:i+1,intent:op.intent})),{marked:[...marked],missing,failed:r?.actions.filter(a=>!a.ok).map(a=>({step:a.step,error:a.error}))},'browser.json'))
  if(!r){unresolved.push({path:p.id,reason:'No executable source-bound semantic plan'});continue}
  for(const [operationIndex,operation]of p.operations.entries())if(operation.intent==='attemptComplete'){
   const index=configured.findLastIndex(s=>s.oracleAfter===operationIndex+1),step=configured[index],action=r.actions[index],blocked=step?.blockedControl
   const control=blocked&&(action?.observed?.controls||[]).find(c=>c.name===blocked.name&&(!blocked.role||c.role===blocked.role))
   const proven=action?.ok&&!action.skipped&&(action.step.op==='click'||control?.disabled===true)
   checks.push(check(`${p.id}/blocked-attempt-${operationIndex+1}`,index>=0,!!proven,'Executed attempt or observed disabled target', {step:action?.step,control},'browser.json'))
  }
  for(const point of p.checkpoints){const index=configured.findLastIndex(s=>s.oracleAfter===point.after),a=r.actions[index],observed=a?.observed
   if(index<0||!a?.ok||a.skipped||!observed){checks.push(check(`${p.id}/after-${point.after}`,false,false,point,null,'browser.json'));continue}
   checks.push(...checkComboCheckpoint(task,observed,point,plan.mapping,`browser.json/${p.id}/actions/${index}`).map(c=>({...c,id:`${p.id}/after-${point.after}/${c.id}`})))
  }
  const lastStep=r.actions.at(-1),valid=lastStep?.ok&&!lastStep.skipped
  if(valid)checks.push(...checkComboCheckpoint(task,r.final,p.expected,plan.mapping,`browser.json/${p.id}/final`).map(c=>({...c,id:`${p.id}/final/${c.id}`})))
  else checks.push(check(p.id+'-final',false,false,p.expected,null,'browser.json'))
  if(valid&&task.id==='combo-02-transcript-review'){
   const expected=expectedQuestionRecords(task,p),actual=normalizeQuestions(r.final,plan.mapping.questions)
   checks.push(check(p.id+'-all-saved-questions-preserved',actual.found,actual.found&&expected.every(q=>actual.value.some(x=>['recordingId','sourceId','segmentId','text'].every(k=>x[k]===q[k]))),expected,actual.value,'browser.json'))
  }
  const reloads=r.actions.filter(a=>a.step.op==='reload');checks.push(check(p.id+'-restore',reloads.length>0,reloads.length>0&&reloads.every(a=>a.ok&&a.restored===true),true,reloads.map(a=>({ok:a.ok,restored:a.restored,comparison:a.restoreComparison})),'browser.json'))
 }
 const errors=(browser.runs||[]).flatMap(r=>[...(r.pageErrors||[]),...(r.initial?.errors||[]),...(r.final?.errors||[]),...r.actions.flatMap(a=>a.errors||[])])
 checks.push(check('runtime-errors',browser.status==='tested',!errors.length,[],errors,'browser.json'))
 const layouts=await layoutChecks(result.spec,{snapshots,replayMode,artifactDir:join(out,'layouts'),signal:AbortSignal.timeout(100000)});await writeFile(join(out,'layouts.json'),JSON.stringify(layouts,null,2))
 for(const group of [{size:'square-operated',...browser},...layouts])for(const r of group.runs||[]){const issues=[...(r.initial?.layout?.issues||[]),...(r.final?.layout?.issues||[]),...(r.actions||[]).flatMap(a=>a.layoutIssues||[])].filter(i=>!i.allowed&&!i.decorativeOnly);checks.push(check(`layout-${group.size}-${r.width}-${r.path}`,!!r.initial?.layout&&!!r.final?.layout,!issues.length,[],issues,[r.screenshot,'layouts.json'].filter(Boolean).join(';')))}
 const status=items=>items.some(c=>c.status==='failed')?'failed':items.every(c=>c.status==='passed')?'passed':items.some(c=>c.status==='passed')?'partial':'unverified'
 const businessStatus=status(checks.filter(c=>!c.id.startsWith('layout-'))),layoutStatus=status(checks.filter(c=>c.id.startsWith('layout-'))),acceptance={...identity,status:status([{status:businessStatus},{status:layoutStatus},...(generationDelivery.status==='failed'?[{status:'failed'}]:[])]),artifactBehaviorStatus:businessStatus,businessStatus,layoutStatus,checks,classification:classifyIndependentFindings({checks},unresolved),humanPreference:null,evaluationPath:out,limitations:['Six-size initial DOM/layout checks plus operated432-square paths; any layout-sensitive behavior needs extra replay.','A missing/ambiguous mapping remains unverified; no generated expectation is accepted as oracle.','Synthetic task data only; no live tool capability conclusion.']}
 await writeFile(join(out,'acceptance.json'),JSON.stringify(acceptance,null,2));await writeFile(join(directory,'acceptance.json'),JSON.stringify(acceptance,null,2));return acceptance
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split('='))),dirs=args.run?[resolve(args.run)]:(await readdir(join(root,'runs'))).filter(n=>n.startsWith('combo-')).map(n=>join(root,'runs',n))
 const outcomes=[];for(const d of dirs){try{const r=await evaluateComboRun(d,{execute:args.execute==='true',inventory:args.inventory==='true',revision:args.revision||'combo-independent-r1',planFile:args.plan});outcomes.push({run:d,...(r.dryRun?r:{status:r.status,out:r.evaluationPath||r.out,inventory:r.inventory,controls:r.controls})})}catch(e){outcomes.push({run:d,error:e.message})}}
 console.log(JSON.stringify(outcomes,null,2))
}
