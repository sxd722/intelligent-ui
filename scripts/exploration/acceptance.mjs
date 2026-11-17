// Frozen independent task oracles. This file never edits a generated artifact,
// changes its expected outcomes, calls a model, or invokes a live CLI.
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {join} from 'node:path'
const taskRoot=new URL('../../experiments/round1-20261117/tasks/',import.meta.url)
export const sha256=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex')
export async function frozenTasks(){return JSON.parse(await readFile(new URL('screen.json',taskRoot),'utf8')).tasks}
export async function frozenOracle(taskId){return JSON.parse(await readFile(new URL('oracles.json',taskRoot),'utf8')).tasks[taskId]}
export function recordingEligibility(kits,needs){
 const result={eligible:[],unknown:[],ineligible:[]}
 for(const k of kits){const other=k.weightG<=needs.maxWeightG&&k.dailyYuan<=needs.maxDailyYuan;result[!other?'ineligible':k.batteryHours==null?'unknown':k.batteryHours>=needs.minBatteryHours?'eligible':'ineligible'].push(k.id)}
 return result
}
export function allocationTotals(machines,jobs,assignment){
 const loads=Object.fromEntries(machines.map(m=>[m.id,0])),remaining={},overrun={}
 for(const j of jobs){if(!Object.hasOwn(loads,assignment[j.id]))throw Error('Unknown or missing machine for '+j.id);loads[assignment[j.id]]+=j.minutes}
 for(const m of machines){remaining[m.id]=Math.max(0,m.availableMinutes-loads[m.id]);overrun[m.id]=Math.max(0,loads[m.id]-m.availableMinutes)}
 return {loads,remaining,overrun}
}
export function transferSteps(initial,rate,steps,receiverCapacity=80){
 let {sourceL,receiverL}=initial
 for(let i=0;i<steps;i++){const d=Math.min(rate,sourceL,receiverCapacity-receiverL);sourceL-=d;receiverL+=d}
 return {sourceL,receiverL,totalL:sourceL+receiverL}
}
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b))
const unsafe=new Set(['__proto__','constructor','prototype'])
function at(value,path){
 if(typeof path!=='string'||path.split('.').some(k=>unsafe.has(k)))return {found:false}
 let v=value
 for(const part of path.split('.')){if(v==null||!Object.hasOwn(Object(v),part))return {found:false};v=v[part]}
 return {found:true,value:v,path}
}
function flatten(value,prefix='',out=[]){
 if(value&&typeof value==='object'&&!Array.isArray(value)){for(const [k,v]of Object.entries(value))if(!unsafe.has(k))flatten(v,prefix?prefix+'.'+k:k,out)}
 else out.push({path:prefix,value})
 return out
}
const ALIASES={
 sourceL:['sourceL','sourceVolume','sourceWater','sourceAmount'],receiverL:['receiverL','receiverVolume','receiverWater','receiverAmount'],
 elapsedSeconds:['elapsedSeconds','elapsed','seconds','timeSeconds'],running:['running','playing','isPlaying','isRunning'],rateLPerSecond:['rateLPerSecond','flowRate','rate'],
 eligibleIds:['eligibleIds','qualifiedIds','eligible','qualified','matchingKits'],unknownIds:['unknownIds','uncertainIds','unknownKits'],
 selectedIds:['selectedIds','compareIds','selectedKitIds','comparisonIds'],savedEntity:['savedEntity','chosenId','savedChoice','decisionId','savedKitId'],savedReason:['savedReason','decisionReason','reason'],minBatteryHours:['minBatteryHours','minBattery','requiredHours'],
 assignment:['assignment','assignments','allocation'],pinnedQuote:['pinnedQuote','savedQuote','quotation'],pinnedTitle:['pinnedTitle','savedTitle'],pinnedUrl:['pinnedUrl','savedUrl'],selectedTitle:['selectedTitle','currentTitle'],query:['query','searchQuery','searchTerm']
}
export function resolveSemantic(snapshot,key,mapping={}){
 const explicit=mapping[key]
 if(typeof explicit==='string')return at(snapshot,explicit)
 if(explicit?.path)return at(snapshot,explicit.path)
 const names=ALIASES[key]||[key]
 const matches=flatten({state:snapshot?.state,derived:snapshot?.derived,results:snapshot?.results,componentState:snapshot?.componentState,persisted:snapshot?.persisted}).filter(p=>names.includes(p.path.split('.').at(-1)))
 // Equal copies are acceptable evidence of the value, but preserve every path.
 const values=[...new Map(matches.map(m=>[JSON.stringify(m.value),m])).values()]
 return values.length===1?{found:true,...values[0],paths:matches.map(m=>m.path)}:{found:false,reason:matches.length?'ambiguous semantic state':'semantic result not observable',candidatePaths:matches.map(m=>m.path)}
}
function ids(value){return Array.isArray(value)?value.map(x=>typeof x==='object'?x.id??x.entityId??x.key:x).sort():value}
function check(id,status,expected,actual,evidence=[],reason){return {id,status,expected,actual,evidence,...(reason?{reason}:{})}}
function checkValue(id,snapshot,key,expected,mapping,evidence,{set=false}={}){
 const got=resolveSemantic(snapshot,key,mapping)
 if(!got.found)return check(id,'unverified',expected,null,evidence,got.reason||'Semantic mapping missing')
 const actual=set?ids(got.value):got.value,exp=set?ids(expected):expected
 return check(id,equal(actual,exp)?'passed':'failed',exp,actual,[...evidence,got.path])
}
function runFor(browser,path){return browser?.runs?.find(r=>r.scenario==='normal'&&r.path===path&&r.width===432)||browser?.runs?.find(r=>r.scenario==='normal'&&r.path===path)}
function restoreCheck(run,id){
 const restores=(run?.actions||[]).filter(a=>a.step?.op==='reload'&&!a.skipped)
 return !restores.length?check(id,'unverified','Reload preserves current state',null,[],'No reload action observed'):check(id,restores.every(a=>a.ok&&a.restored===true)?'passed':'failed',true,restores.map(a=>({ok:a.ok,restored:a.restored,comparison:a.restoreComparison})),[`${run.path}/reload`])
}
function numericPair(snapshot,key,entity,mapping){
 if(mapping[`${key}.${entity}`])return resolveSemantic(snapshot,`${key}.${entity}`,mapping)
 const candidates=[`derived.${key}.${entity}`,`state.${key}.${entity}`,`results.${key}.${entity}`]
 const hits=candidates.map(p=>at(snapshot,p)).filter(x=>x.found)
 return hits.length===1?hits[0]:{found:false}
}
function normalize(s){return String(s??'').replace(/\s+/g,' ').trim()}
export async function evaluateFrozenTask({taskId,source,spec,browser,snapshots=[],semanticMapping={},run={}}){
 const oracle=await frozenOracle(taskId);if(!oracle)throw Error('Unknown frozen task '+taskId)
 const checks=[],limitations=[]
 const evidence=(path)=>[`browser:${path}`]
 const baseline=browser?.runs?.find(r=>r.scenario==='normal'&&r.width===432)||browser?.runs?.find(r=>r.scenario==='normal')
 for(const p of oracle.paths){
  const observed=run.operationLog?.filter(o=>o.path===p.id&&o.executed===true&&o.evidenceRef)||[]
  const required=[...new Set(p.operations.map(o=>o.intent))]
  const missing=required.filter(intent=>!observed.some(o=>o.intent===intent))
  checks.push(check(p.id+'-business-path',missing.length?'unverified':'passed',required,observed.map(o=>o.intent),observed.map(o=>o.evidenceRef),missing.length?'Semantic operation-to-browser-action mapping missing: '+missing.join(', '):undefined))
 }
 if(browser?.status!=='tested')checks.push(check('browser','unverified','A real browser test',browser?.status||null,[],browser?.reason||'No browser evidence'))
 const faulty=(browser?.runs||[]).flatMap(r=>[...(r.pageErrors||[]),...(r.initial?.errors||[]),...(r.final?.errors||[])])
 checks.push(check('runtime-errors',browser?.status==='tested'?(faulty.length?'failed':'passed'):'unverified',[],faulty))
 for(const r of browser?.runs||[]){
  const measured=!!r.initial?.layout&&!!r.final?.layout
  const issues=[...(r.initial?.layout?.issues||[]),...(r.final?.layout?.issues||[]),...(r.actions||[]).flatMap(a=>a.layoutIssues||[])].filter(i=>['control-occluded','control-not-fully-visible','clipped-content'].includes(i.code)||(i.code==='internal-overflow'&&!i.allowed&&!i.decorativeOnly))
  checks.push(check(`layout-${r.width}-${r.size||'recorded-size'}-${r.path}`,issues.length?'failed':measured?'passed':'unverified','No clipped/occluded critical content',issues,[r.screenshot].filter(Boolean),measured?undefined:'Initial and final DOM layout evidence required'))
 }
 if(taskId==='screen-01-recording-kit'){
  const p1=runFor(browser,'initial-compare'),p2=runFor(browser,'relax-and-decide')
  checks.push(checkValue('initial-eligible',baseline?.initial,'eligibleIds',['reed'],semanticMapping,evidence('initial'),{set:true}))
  checks.push(checkValue('initial-unknown',baseline?.initial,'unknownIds',['moss'],semanticMapping,evidence('initial'),{set:true}))
  checks.push(checkValue('compare-return-selection',p1?.final,'selectedIds',['reed','moss'],semanticMapping,evidence('initial-compare'),{set:true}))
  // The existence of both names somewhere in a list cannot prove a comparison.
  const comparison=resolveSemantic(p1?.final,'comparisonFields',semanticMapping)
  checks.push(comparison.found?check('comparison-fields',equal(comparison.value,oracle.paths[0].expected.comparison)?'passed':'failed',oracle.paths[0].expected.comparison,comparison.value,[comparison.path]):check('comparison-fields','unverified',oracle.paths[0].expected.comparison,null,[],'No independently identified comparison result surface'))
  for(const [k,v]of Object.entries({eligibleIds:['reed','stone'],unknownIds:['moss'],savedEntity:'stone',savedReason:'六小时足够且费用较低',minBatteryHours:6}))checks.push(checkValue('decision-'+k,p2?.final,k,v,semanticMapping,evidence('relax-and-decide'),{set:Array.isArray(v)}))
  checks.push(restoreCheck(p2,'decision-restore'))
 }else if(taskId==='screen-02-print-room'){
  for(const p of oracle.paths){const r=runFor(browser,p.id)
   checks.push(checkValue(p.id+'-assignment',r?.final,'assignment',p.expected.assignment,semanticMapping,evidence(p.id)))
   for(const field of ['loads','remaining','overrun'])for(const [entity,value]of Object.entries(p.expected[field])){
    const actual=numericPair(r?.final,field,entity,semanticMapping)
    checks.push(check(`${p.id}-${field}-${entity}`,actual.found?(actual.value===value?'passed':'failed'):'unverified',value,actual.found?actual.value:null,[...evidence(p.id),actual.path].filter(Boolean),actual.found?undefined:'Output mapping not uniquely identifiable'))
   }
  }
  checks.push(restoreCheck(runFor(browser,'resolve-overrun'),'allocation-restore'))
 }else if(taskId==='screen-03-water-transfer'){
  for(const p of oracle.paths){const r=runFor(browser,p.id)
   for(const [k,v]of Object.entries(p.expected))if(!['totalL','extraStepChangesWater'].includes(k))checks.push(checkValue(p.id+'-'+k,r?.final,k,v,semanticMapping,evidence(p.id)))
   const a=resolveSemantic(r?.final,'sourceL',semanticMapping),b=resolveSemantic(r?.final,'receiverL',semanticMapping)
   checks.push(check(p.id+'-conservation',a.found&&b.found?(Number(a.value)+Number(b.value)===80?'passed':'failed'):'unverified',80,a.found&&b.found?Number(a.value)+Number(b.value):null,evidence(p.id)))
   const graphic=run.graphicObservations?.find(g=>g.path===p.id&&g.artifactHash===sha256(source||'')&&g.evidenceRef&&['svg-dom','canvas-pixel-read','trusted-graphic-observer'].includes(g.method))
   checks.push(graphic?check(p.id+'-graphic-business-link',equal(graphic.volumes,[p.expected.sourceL,p.expected.receiverL])?'passed':'failed',[p.expected.sourceL,p.expected.receiverL],graphic.volumes,[graphic.evidenceRef]):check(p.id+'-graphic-business-link','unverified','Graphic visibly represents current source and receiver volumes',null,evidence(p.id),'Root/logic state, nonzero SVG/canvas or a changed hash cannot prove correct graphics; require independent surface observation bound to artifact hash'))
  }
  const pause=runFor(browser,'step-pause-restore'),wait=pause?.actions?.find(a=>a.step?.op==='check'&&a.step?.waitMs>=2000)
  checks.push(wait?checkValue('paused-stability',wait.observed,'sourceL',40,semanticMapping,evidence('step-pause-restore/wait')):check('paused-stability','unverified',40,null,[],'No >=2s paused observation'))
  checks.push(restoreCheck(pause,'water-restore'))
 }else{
  const allRuns=browser?.runs||[],calls=allRuns.flatMap(r=>r.final?.calls||[])
  for(const q of ['bioluminescence','biofluorescence']){
   const matching=calls.filter(c=>c.tool==='opencli.wikipedia.search'&&c.input?.query===q&&c.input?.lang==='en')
   const saved=snapshots.filter(s=>s.tool==='opencli.wikipedia.search'&&s.input?.query===q&&s.input?.lang==='en')
   checks.push(check('query-'+q,matching.length||q==='bioluminescence'&&saved.length?'passed':'unverified',{query:q,lang:'en'},matching.map(c=>c.input),[],matching.length?'Actual browser binding invocation (replayed unless separate live evidence)':saved.length?'Initial exact snapshot available; initial network invocation not required':'No matching invocation/evidence'))
  }
  const details=calls.filter(c=>['opencli.wikipedia.page','opencli.wikipedia.summary'].includes(c.tool))
  const searchRows=snapshots.filter(s=>s.tool==='opencli.wikipedia.search').flatMap(s=>s.value?.items||[])
  checks.push(check('detail-identity',details.length?(details.every(c=>searchRows.some(r=>r.title===c.input?.title))?'passed':'failed'):'unverified','Detail title is an actual returned title',details.map(c=>c.input?.title)))
  const p=runFor(browser,'initial-detail-pin-return'),quote=resolveSemantic(p?.final,'pinnedQuote',semanticMapping),title=resolveSemantic(p?.final,'pinnedTitle',semanticMapping),url=resolveSemantic(p?.final,'pinnedUrl',semanticMapping)
  const pages=snapshots.filter(s=>['opencli.wikipedia.page','opencli.wikipedia.summary'].includes(s.tool)).flatMap(s=>s.value?.items||[])
  const original=quote.found&&title.found&&url.found?pages.find(r=>r.title===title.value&&r.url===url.value&&normalize(r.extract).includes(normalize(quote.value))&&normalize(quote.value).length>=25):null
  checks.push(check('pinned-source-quote',quote.found&&title.found&&url.found?(original?'passed':'failed'):'unverified','Quote >=25 chars is contained in exact selected source extract',{quote:quote.value??null,title:title.value??null,url:url.value??null},[quote.path,title.path,url.path].filter(Boolean)))
  const attempts=allRuns.flatMap(r=>r.final?.navigation||[]).filter(n=>n.valid)
  checks.push(check('source-navigation',url.found?(attempts.some(n=>n.url===url.value)?'passed':'unverified'):'unverified','Actual source URL navigation attempt',attempts.map(n=>n.url)))
  checks.push(restoreCheck(p,'evidence-restore'))
  limitations.push('Fixed snapshots test result consumption, not current external-service availability. Live-read must be independently evidenced.')
 }
 const hard=checks.filter(c=>!c.id.startsWith('layout-'))
 const summarize=items=>!items.length?'unverified':items.some(c=>c.status==='failed')?'failed':items.every(c=>c.status==='passed')?'passed':items.some(c=>c.status==='passed')?'partial':'unverified'
 const businessStatus=summarize(hard),layoutStatus=summarize(checks.filter(c=>c.id.startsWith('layout-')))
 const status=summarize([{status:businessStatus},{status:layoutStatus}])
 return {version:'round1-independent-evaluator-r2',taskId,artifactHash:sha256(source||''),contextHash:sha256(spec?.context||{}),oracleHash:sha256(oracle),status,businessStatus,layoutStatus,checks,semanticMapping,manualIntervention:run.manualIntervention??null,limitations,humanPreference:null}
}

// Discovery proposes actions solely from accessible controls; expectations remain
// in the evaluator. Missing/ambiguous controls are unresolved, never guessed.
export function proposeSteps(taskId,inventory=[]){
 const controls=Array.isArray(inventory)?inventory:inventory.controls||[]
 const find=(rx,roles)=>{const a=controls.filter(c=>!c.disabled&&rx.test(c.name||'')&&(!roles||roles.includes(c.role)));return a.length===1?a[0]:null}
 const click=(c,path)=>c?{op:'click',name:c.name,role:c.role,path}:null
 const reload=path=>({op:'reload',path})
 const unresolved=[],steps=[]
 if(taskId==='screen-03-water-transfer'){
  const step=find(/单步|前进一|一步|step/i,['button']),rate=find(/速率|流量|rate/i,['slider','combobox','textbox']),pause=find(/^暂停|pause/i,['button'])
  if(step){for(let i=0;i<4;i++)steps.push(click(step,'step-pause-restore'));if(pause)steps.push(click(pause,'step-pause-restore'));steps.push({op:'check',path:'step-pause-restore',waitMs:2200},reload('step-pause-restore'))}else unresolved.push('A unique single-step control was not observed')
  if(rate&&step){steps.push({op:rate.role==='combobox'?'select':'fill',name:rate.name,value:'10',path:'rate-boundary'});for(let i=0;i<7;i++)steps.push(click(step,'rate-boundary'))}else unresolved.push('Rate/step controls not uniquely observed')
 }else if(taskId==='screen-01-recording-kit'){
  const a=find(/芦苇/),b=find(/苔藓/),compare=find(/对比|比较/),min=find(/最低续航|最低.*小时|续航要求/ ,['slider','textbox','combobox'])
  if(a&&b&&compare)steps.push(click(a,'initial-compare'),click(b,'initial-compare'),click(compare,'initial-compare'));else unresolved.push('Need observed entity-selection and comparison controls; list text alone is insufficient')
  if(min)steps.push({op:min.role==='combobox'?'select':'fill',name:min.name,value:'6',path:'relax-and-decide'});else unresolved.push('Minimum battery requirement control not uniquely observed')
  unresolved.push('Inspect/return/save targets must be resolved from the next actual inventory, not guessed from this initial view')
 }else if(taskId==='screen-04-luminous-library'){
  const query=find(/查询|搜索|关键词|query|search/i,['textbox']),submit=find(/^搜索$|^查询$|检索|search/i,['button'])
  if(query&&submit){for(const [path,value]of [['initial-detail-pin-return','bioluminescence'],['query-switch-refresh','biofluorescence']])steps.push({op:'fill',name:query.name,value,path},click(submit,path))}else unresolved.push('Query controls not uniquely observed')
  unresolved.push('Select actual returned entity, pin exact extract and return using subsequently observed controls')
 }else unresolved.push('Allocation controls require independently recorded job-to-machine semantic mapping; no guessed option values')
 return {steps:steps.filter(Boolean),unresolved,scope:'Inventory discovery only; not a proof of task completion and not model repair feedback'}
}

export async function layoutChecks(spec,{snapshots=[],replayMode,artifactDir,signal}={}){
 const {runDebugBrowser}=await import('../../server/cardspec/debug-browser.mjs')
 const results=[]
 // Serial because the existing debug-browser deliberately owns one browser slot.
 for(const size of ['square','auto'])results.push({size,...await runDebugBrowser(spec,{steps:[{op:'check'}],scenarios:['normal'],viewports:[320,360,432],size,snapshots,replayMode,signal,artifactDir:artifactDir?join(artifactDir,size):undefined})})
 return results
}
