import {readFile,writeFile,readdir} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {sha256,frozenOracle} from './acceptance.mjs'
const root=resolve('experiments/round1-20261117/runs'),task=process.argv.find(a=>a.startsWith('--task='))?.split('=')[1]
const json=async p=>JSON.parse(await readFile(p,'utf8')),canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort().map(([k,v])=>[k,canon(v)])):v,eq=(a,b)=>JSON.stringify(canon(a))===JSON.stringify(canon(b))
const summary=[]
for(const name of(await readdir(root)).filter(n=>n.startsWith('screen-0'+task+'-')).sort()){
 const d=join(root,name),out=join(d,'evaluation','frozen-path-r3'),review=await json(join(out,'review.json')).catch(()=>null);if(!review)continue
 const product=await json(join(d,'result.json')),b=await json(join(out,'browser.json')),oracle=await frozenOracle('screen-0'+task+'-'+(task==='1'?'recording-kit':task==='2'?'print-room':'water-transfer'))
 const r4=await json(join(d,'evaluation','frozen-path-r4','browser.json')).catch(()=>null)
 const runs=[...b.runs.filter(r=>!r4?.runs.some(x=>x.path===r.path)),...(r4?.runs||[])],checks=[],semanticMapping={}
 const check=(id,expected,actual,available=true,note='')=>checks.push({id,status:!available?'unverified':eq(actual,expected)?'passed':'failed',expected,actual:actual??null,note})
 const get=p=>runs.find(r=>r.path===p),worked=r=>!!r&&r.actions.every(a=>a.ok),state=r=>r?.final?.state||{}
 if(task==='1'){
  const a=get('initial-compare'),z=get('relax-and-decide'),s=state(z),initial=a?.initial?.derived?.rows,rows=z?.final?.derived?.rows
  const ids=(rows,kind)=>rows?.filter(x=>kind==='pass'?['pass','达标'].includes(x.status):['unknown','续航未知'].includes(x.status)).map(x=>x.id).sort()
  check('initial-eligible',['reed'],ids(initial,'pass'),Array.isArray(initial));check('initial-unknown',['moss'],ids(initial,'unknown'),Array.isArray(initial))
  const picks=state(a).picks||state(a).picked||state(a).cmp;check('comparison-selection',['moss','reed'],picks?.slice().sort(),worked(a))
  const pair=a?.final?.derived?.pickRows||a?.final?.derived?.pickedRows||a?.final?.derived?.pair||a?.final?.derived?.picked
  const actualPair=Array.isArray(pair)?Object.fromEntries(pair.map(x=>[x.id,{batteryHours:x.batteryHours,weightG:x.weightG,dailyYuan:x.dailyYuan}])):null
  check('comparison-fields',oracle.paths[0].expected.comparison,actualPair,worked(a)&&!!actualPair)
  const detail=a?.actions.find(x=>x.ok&&x.observed?.state?.detail==='moss'&&x.observed?.state?.tab==='detail'),back=a?.actions.find(x=>x.ok&&x.step.name==='返回列表')
  check('detail-return',true,!!detail&&!!back,!!a,'A comparison destination alone is not a separate entity inspect/return path.')
  check('relaxed-eligible',['reed','stone'],ids(rows,'pass'),Array.isArray(rows)&&s.minB===6);check('relaxed-unknown',['moss'],ids(rows,'unknown'),Array.isArray(rows)&&s.minB===6)
  const saved=typeof s.saved==='object'?s.saved.id:typeof s.saved==='string'?s.saved:s.saved===true?s.final:s.decision?.kitId
  const savedReason=typeof s.saved==='object'?s.saved.reason:s.decision?.reason??s.reason
  check('saved-entity','stone',saved,!!z);check('saved-reason','六小时足够且费用较低',savedReason,!!z)
  const reload=z?.actions.find(a=>a.step.op==='reload'&&a.ok);check('restore',true,reload?.restored,!!reload)
  semanticMapping.rows='browser derived.rows status discriminator';semanticMapping.comparison='browser derived pickRows/pickedRows/pair/picked projected by id';semanticMapping.saved='actual declared state saved/decision/final, no guessed default'
 }else if(task==='2'){
  for(const p of oracle.paths){const r=get(p.id),s=state(r),assignment=s.assign,loads=r?.final?.derived?.loads||r?.final?.derived?.load
   const assigned=r?.actions.some(a=>a.ok&&a.step.name==='雪松机');check(p.id+'-assignment',p.expected.assignment,assignment,assigned)
   for(const k of ['loads','remaining','overrun']){const actual=Array.isArray(loads)?Object.fromEntries(loads.map(m=>[m.id,k==='loads'?m.used:k==='remaining'?Math.max(0,(m.cap??m.availableMinutes)-m.used):Math.max(0,m.used-(m.cap??m.availableMinutes))])):null;check(p.id+'-'+k,p.expected[k],actual,assigned&&!!actual,'Projection of observed per-machine used/capacity values; expected independently frozen. Render visibility is gated separately.')}
   if(p.id==='resolve-overrun'){const ticket=r?.actions.some(a=>a.ok&&/入场券/.test(a.step.name||''));check('ticket-inspect',true,ticket,!!r);const back=r?.actions.some(a=>a.ok&&/返回|关闭详情/.test(a.step.name||''));check('detail-return',true,back,!!r);const reload=r?.actions.find(a=>a.step.op==='reload'&&a.ok);check('restore',true,reload?.restored,!!reload);const saved=s.saved?.poster?s.saved:Object.values(s.saved||{}).find(v=>v?.assign)?.assign;check('saved-assignment',p.expected.assignment,saved,!!saved);if(ticket)check('selected-job-restored','ticket',s.focus??s.sel,!!reload)}
  }
  semanticMapping.assignment='state.assign';semanticMapping.machineResults='observed derived loads/load rows keyed by id'
 }else{
  const graphics=await json(join(out,'graphic-observations.json')).catch(()=>[])
  for(const p of oracle.paths){const r=get(p.id),s=state(r),logic=Object.values(r?.final?.componentState||{}).map(v=>v.logic).find(v=>v&&typeof v.sourceL==='number'),v=logic||s
   for(const [k,e]of Object.entries(p.expected)){if(['totalL','extraStepChangesWater'].includes(k))continue;let actual=v[k];if(k==='elapsedSeconds')actual=v.elapsedSeconds??v.elapsed;if(k==='rateLPerSecond')actual=v.rateLPerSecond??v.rate;check(p.id+'-'+k,e,actual,!!r)}
   check(p.id+'-conservation',80,v.sourceL+v.receiverL,!!r)
   const graphic=graphics.find(g=>g.path===p.id&&g.artifactHash===sha256(product.source));check(p.id+'-graphic-business-link',[v.sourceL,v.receiverL],graphic?.volumes,!!graphic,graphic?.evidenceRef||'Requires independent screenshot/surface review; copied state is insufficient.')
   if(p.id==='step-pause-restore'){const reload=r?.actions.find(a=>a.step.op==='reload'&&a.ok);check('restore',true,reload?.restored,!!reload)}
  }
  const play=get('play-pause-reset'),wait=play?.actions.find(a=>a.step.op==='check'&&a.step.waitMs===2200),after=wait?.observed?.state||{},comp=Object.values(wait?.observed?.componentState||wait?.observed?.persisted||{}).map(v=>v.logic?.state||v.logic).find(v=>v&&typeof v.sourceL==='number'),values=comp||after
  const visibleSource=Number((wait?.observed?.text||'').match(/^(\d+(?:\.\d+)?)\n源罐/)?.[1]);const source=typeof values.sourceL==='number'?values.sourceL:Number.isFinite(visibleSource)?visibleSource:null
  check('play-advances',true,source<60,source!==null,'Observed after 2200 ms, from root state or source-labelled visible text.')
  const finalLogic=Object.values(play?.final?.componentState||{}).map(v=>v.logic).find(v=>v&&typeof v.sourceL==='number')||state(play);check('reset',[60,20,0,false],[finalLogic.sourceL,finalLogic.receiverL,finalLogic.elapsedSeconds??finalLogic.elapsed,finalLogic.running],!!play)
  semanticMapping.business='root state or independently observed componentState[module].logic';semanticMapping.graphics='unverified until surface review'
 }
 const layoutIssues=runs.flatMap(r=>[...(r.initial?.layout?.issues||[]),...(r.final?.layout?.issues||[]),...(r.actions||[]).flatMap(a=>a.layoutIssues||[])]).filter(i=>['control-not-fully-visible','control-occluded','clipped-content'].includes(i.code)||i.code==='internal-overflow'&&!i.allowed&&!i.decorativeOnly)
 const layoutStatus=layoutIssues.length?'failed':review.initialLayouts.length===6?'passed':'unverified',businessStatus=checks.some(c=>c.status==='failed')?'failed':checks.every(c=>c.status==='passed')?'passed':'partial'
 const status=businessStatus==='failed'||layoutStatus==='failed'?'failed':businessStatus==='passed'&&layoutStatus==='passed'?'passed':'partial'
 const result={version:'frozen-independent-mapping-r3',sourceHash:sha256(product.source),oracleHash:sha256(oracle),status,businessStatus,layoutStatus,checks,semanticMapping,layoutIssues,artifactRole:review.artifactRole,sourceChanged:false,oracleChanged:false,testRevision:r4?'modal-close-target-r4':'r3',limitations:['Missing controls are unverified unless source confirms absent business implementation.','Initial layout pass is insufficient; intermediate and final paths included.','No live tools invoked.']}
 await writeFile(join(out,'acceptance.json'),JSON.stringify(result,null,2));summary.push({run:name,status,businessStatus,layoutStatus,passed:checks.filter(c=>c.status==='passed').length,failed:checks.filter(c=>c.status==='failed').map(c=>c.id),unverified:checks.filter(c=>c.status==='unverified').map(c=>c.id)})
}
console.log(JSON.stringify(summary,null,2));await writeFile(join(root,'task-'+task+'-independent-summary.json'),JSON.stringify(summary,null,2))
