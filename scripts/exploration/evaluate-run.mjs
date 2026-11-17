// Independent, serial evaluator for one explicitly ready study run.
// It reuses runDebugBrowser, never calls a model/live CLI, and never edits source.
import {readFile,mkdir,writeFile,readdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {runDebugBrowser} from '../../server/cardspec/debug-browser.mjs'
import {evaluate} from '../../shared/cardspec/expression.mjs'
import {makeScope} from '../../shared/cardspec/store.mjs'
import {evaluateFrozenTask,frozenTasks,sha256,resolveSemantic,layoutChecks} from './acceptance.mjs'

const args=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split('=')))
const object=async path=>JSON.parse(await readFile(path,'utf8'))
async function maybe(path){try{return await object(path)}catch{return null}}
const norm=v=>String(v??'').replace(/\s+/g,' ').trim()
function flatten(nodes,result=[]){for(const n of nodes||[]){result.push(n);flatten(n.children,result)}return result}
function choose(controls,match,roles){
 const candidates=controls.filter(c=>!c.disabled&&(!roles||roles.includes(c.role))&&match(c))
 return candidates.length===1?{control:candidates[0]}:{reason:candidates.length?'ambiguous controls':'control not observed',candidates:candidates.map(c=>({name:c.name,role:c.role}))}
}
function click(c,path){return {op:'click',name:c.name,role:c.role,path}}
function optionFor(spec,snapshot,control,label){
 const nodes=flatten(spec.children),scope=makeScope(spec,{values:structuredClone(snapshot.state||{}),types:{}})
 const candidates=nodes.filter(n=>n.type==='select').flatMap(n=>{
  try{if(norm(evaluate(n.props.label,scope))!==norm(control.name))return []
   return evaluate(n.props.options,scope).filter(o=>norm(typeof o==='object'?o.label:o).includes(label)).map(o=>typeof o==='object'?o.value??o.id:o)
  }catch{return []}
 })
 return candidates.length===1?String(candidates[0]):null
}
export function classifyIndependentFindings(acceptance,unresolved=[]){
 const failures=(acceptance.checks||[]).filter(c=>c.status==='failed').map(c=>({check:c.id,category:c.id.startsWith('layout-')?'布局/可见性':c.id==='runtime-errors'?'宿主执行或模型实现（需trace分诊）':c.id.startsWith('detail-identity')||c.id.startsWith('pinned-source')?'实体/来源契约':'业务/初始化',evidence:c.evidence,expected:c.expected,actual:c.actual}))
 const uncertain=unresolved.map(u=>({...u,category:/deadline|timeout|busy|browser|launch/i.test(u.reason||'')?'验收环境未验证':'验收定位/语义映射未验证'}))
 return {failures,uncertain,note:'Unresolved control lookup is not automatically a model failure. Product requirements remain unverified until independently observed.'}
}

export async function evaluateRun(runDirectory,{layouts=true,maxReplays=20,timeoutMs=180000}={}){
 const directory=resolve(runDirectory),result=await object(join(directory,'result.json')),request=await maybe(join(directory,'request.json'))
 const taskId=result.taskId||result.task?.id||request?.taskId||request?.task?.id
 const task=(await frozenTasks()).find(t=>t.id===taskId);if(!task)throw Error('Cannot identify frozen task from result/request: '+taskId)
 const product=result.output||result.result||result
 const spec=product.spec||result.spec||result.message?.metadata?.card_spec
 const source=product.source||result.source||result.message?.metadata?.validated_source
 if(!spec||typeof source!=='string')throw Error('No exact committed source + spec pair; refusing to test an arbitrary preview')
 const snapshotFile=request?.snapshotPath||result.snapshotPath
 const replayMode=request?.replayMode
 let snapshots=result.snapshots||request?.snapshots||[]
 if(!snapshots.length&&snapshotFile){const loaded=await object(resolve(snapshotFile));snapshots=Array.isArray(loaded)?loaded:loaded.snapshots||loaded.records||[]}
 if(!snapshots.length){const loaded=await maybe(join(directory,'snapshots.json'));snapshots=Array.isArray(loaded)?loaded:loaded?.snapshots||loaded?.records||[]}
 const mapping=await maybe(join(directory,'semantic-mapping.json'))||{}
 const old=await readdir(join(directory,'evaluation')).catch(()=>[]),revision=1+old.filter(n=>/^r\d+$/.test(n)).length,out=join(directory,'evaluation','r'+revision)
 await mkdir(out,{recursive:true})
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error('Independent evaluation deadline')),timeoutMs)
 const manifest={version:'independent-browser-r3',taskId,artifactHash:sha256(source),contextHash:sha256(spec.context||{}),snapshotHash:sha256(snapshots),replayMode:replayMode??null,createdAt:new Date().toISOString(),manualIntervention:null,oracleUnchanged:true,codeChanged:false,modelCalls:0,liveToolCalls:0,revision}
 await writeFile(join(out,'manifest.json'),JSON.stringify(manifest,null,2))
 const operationLog=[],pathPlans={},unresolved=[],browserRuns=[];let replays=0
 async function play(steps,label){
  if(replays>=maxReplays)throw Error('Independent evaluation replay limit reached')
  const dir=join(out,'replay-'+String(++replays).padStart(2,'0')+'-'+label)
  const browser=await runDebugBrowser(spec,{steps,scenarios:['normal'],viewports:[432],size:'square',snapshots,replayMode,captureSteps:true,artifactDir:dir,signal:controller.signal})
  await writeFile(join(dir,'browser.json'),JSON.stringify(browser,null,2)).catch(async()=>{await mkdir(dir,{recursive:true});await writeFile(join(dir,'browser.json'),JSON.stringify(browser,null,2))})
  return {browser,run:browser.runs?.at(-1),ref:dir}
 }
 async function pathRunner(path){
  let plan=[{op:'check',path}],current=await play(plan,path+'-inventory')
  const controls=()=>current.run?.final?.controls||[]
  async function submit(intent,step){
   if(!step){unresolved.push({path,intent,reason:'No independently resolved accessible target'});return false}
   plan.push(...(Array.isArray(step)?step:[step]))
   const before=plan.length;current=await play(plan,path+'-'+intent)
   const executed=current.run?.actions?.slice(before-(Array.isArray(step)?step.length:1)).every(a=>a.ok&&!a.skipped)
   if(executed)operationLog.push({path,intent,executed:true,evidenceRef:join(current.ref,'browser.json')})
   else unresolved.push({path,intent,reason:'Browser operation did not execute',evidence:join(current.ref,'browser.json')})
   return !!executed
  }
  function target(intent,regex,roles){const picked=choose(controls(),c=>regex.test(c.name||''),roles);if(!picked.control)unresolved.push({path,intent,...picked});return picked.control}
  return {path,controls,snapshot:()=>current.run?.final||{},submit,target,finish(){pathPlans[path]=plan;if(current.run)browserRuns.push(current.run);return current},register(intent){operationLog.push({path,intent,executed:true,evidenceRef:join(current.ref,'browser.json')})}}
 }
 try{
  if(taskId==='screen-03-water-transfer'){
   for(const [path,rate,count]of [['step-pause-restore',5,4],['rate-boundary',10,7]]){
    const p=await pathRunner(path)
    if(rate!==5){const c=p.target('rate',/速率|流量|rate/i,['slider','combobox','textbox']);if(c)await p.submit('rate',{op:c.role==='combobox'?'select':'fill',name:c.name,value:String(rate),path})}
    const c=p.target('step',/单步|前进一|一步|step/i,['button'])
    if(c)await p.submit('step',Array.from({length:count},()=>click(c,path)))
    if(path==='step-pause-restore'){
     const running=resolveSemantic(p.snapshot(),'running',mapping)
     if(running.found&&running.value===false)p.register('pause')
     else{const pause=p.target('pause',/暂停|pause/i,['button']);if(pause)await p.submit('pause',click(pause,path))}
     await p.submit('wait',{op:'check',path,waitMs:2200})
     await p.submit('reload',{op:'reload',path})
    }
    p.finish()
   }
  }else if(taskId==='screen-02-print-room'){
   for(const [path,job]of [['resolve-overrun','传单'],['different-overrun','海报']]){
    const p=await pathRunner(path),combo=p.target('assign',new RegExp(job),['combobox'])
    if(combo){const value=optionFor(spec,p.snapshot(),combo,'雪松');if(value!==null)await p.submit('assign',{op:'select',name:combo.name,value,path});else unresolved.push({path,intent:'assign',reason:'Could not independently resolve real select option value'})}
    else{const direct=p.target('assign',new RegExp('('+job+'.*雪松|雪松.*'+job+')'),['button','radio']);if(direct)await p.submit('assign',click(direct,path))}
    if(path==='resolve-overrun'){
     const inspect=p.target('inspect',/入场券.*(详情|查看)|(详情|查看).*入场券/,['button']);if(inspect&&await p.submit('inspect',click(inspect,path))){const back=p.target('return',/返回|关闭详情|收起详情/,['button']);if(back)await p.submit('return',click(back,path))}
     const save=p.target('save',/保存.*(安排|分配|方案)|^(保存|确认安排)$/i,['button']);if(save)await p.submit('save',click(save,path))
     await p.submit('reload',{op:'reload',path})
    }
    p.finish()
   }
  }else if(taskId==='screen-01-recording-kit'){
   const a=await pathRunner('initial-compare')
   for(const name of ['芦苇','苔藓']){let c=a.target('compare',new RegExp('('+name+'.*(对比|比较|选择)|(对比|比较|选择).*'+name+')'),['button','checkbox']);if(!c)c=a.target('compare',new RegExp('^'+name+'(?:\\s|$)'),['button','checkbox']);if(c)await a.submit('compare',click(c,a.path))}
   const compare=a.target('compare',/^(对比|比较|查看对比|开始比较)(?:\s|$)/,['button']);if(compare)await a.submit('compare',click(compare,a.path))
   const inspect=a.target('inspect',/苔藓.*(详情|查看)|(详情|查看).*苔藓/,['button']);if(inspect&&await a.submit('inspect',click(inspect,a.path))){const back=a.target('return',/返回|关闭详情|收起详情/,['button']);if(back)await a.submit('return',click(back,a.path))}
   a.finish()
   const b=await pathRunner('relax-and-decide'),minimum=b.target('setConstraint',/最低续航|续航要求|最少.*小时/,['slider','textbox','combobox'])
   if(minimum)await b.submit('setConstraint',{op:minimum.role==='combobox'?'select':'fill',name:minimum.name,value:'6',path:b.path})
   const chooseKit=b.target('choose',/石溪.*(选择|借用|决定)|(选择|借用|决定).*石溪|^石溪(?:\s|$)/,['button','radio']);if(chooseKit)await b.submit('choose',click(chooseKit,b.path))
   const reason=b.target('saveReason',/理由|原因/,['textbox']);if(reason)await b.submit('saveReason',{op:'fill',name:reason.name,value:'六小时足够且费用较低',path:b.path})
   const save=b.target('saveReason',/保存.*(决定|选择)|^(保存|确认借用)$/,['button']);if(save)await b.submit('saveReason',click(save,b.path))
   await b.submit('reload',{op:'reload',path:b.path});b.finish()
  }else{
   const searches=snapshots.filter(s=>s.tool==='opencli.wikipedia.search')
   for(const [path,query]of [['initial-detail-pin-return','bioluminescence'],['query-switch-refresh','biofluorescence']]){
    const p=await pathRunner(path),q=p.target('query',/查询|搜索|关键词|query|search/i,['textbox'])
    if(q)await p.submit('query',{op:'fill',name:q.name,value:query,path})
    const submit=p.target('query',/^(查询|搜索|检索|Search)$/i,['button']);if(submit)await p.submit('query',click(submit,path))
    const row=searches.find(s=>s.input?.query===query)?.value?.items?.[0]
    if(row){const c=choose(p.controls(),c=>norm(c.name).includes(norm(row.title)),['button','link']);if(c.control)await p.submit('inspect',click(c.control,path));else unresolved.push({path,intent:'inspect',reason:'Actual returned entity was not a unique accessible control',title:row.title,...c})}
    if(path==='initial-detail-pin-return'){
     const quote=p.target('pinQuote',/摘录|引文|引用|原文|依据/,['textbox']),page=snapshots.filter(s=>['opencli.wikipedia.page','opencli.wikipedia.summary'].includes(s.tool)).flatMap(s=>s.value?.items||[]).find(r=>r.title===row?.title)
     if(quote&&page?.extract)await p.submit('pinQuote',{op:'fill',name:quote.name,value:normalizeQuote(page.extract),path})
     const pin=p.target('pinQuote',/固定|保存依据|保存摘录|收藏依据/,['button']);if(pin)await p.submit('pinQuote',click(pin,path))
     const link=p.target('openSource',/原文|来源|Wikipedia|维基百科/,['link']);if(link)await p.submit('openSource',click(link,path))
     const back=p.target('return',/返回|关闭详情|收起详情/,['button']);if(back)await p.submit('return',click(back,path))
     await p.submit('reload',{op:'reload',path})
    }else{const refresh=p.target('refresh',/刷新|更新资料|重新查询/,['button']);if(refresh)await p.submit('refresh',click(refresh,path))}
    p.finish()
   }
  }
 }catch(e){unresolved.push({reason:e.message,classification:'evaluator-or-host',replays})}
 finally{clearTimeout(timer)}
 const browser={status:browserRuns.length?'tested':'unverified',runs:browserRuns,scope:'Independent frozen task path replay; no live tool invocation'}
 let layout=[];if(layouts&&!controller.signal.aborted)try{layout=await layoutChecks(spec,{snapshots,replayMode,artifactDir:join(out,'layouts'),signal:AbortSignal.timeout(90000)})}catch(e){unresolved.push({reason:e.message,classification:'layout-environment'})}
 const acceptance=await evaluateFrozenTask({taskId,source,spec,browser,snapshots,semanticMapping:mapping,run:{operationLog,manualIntervention:null}})
 const classification=classifyIndependentFindings(acceptance,unresolved)
 const all={...manifest,replays,browser,pathPlans,operationLog,semanticMapping:mapping,unresolved,classification,layouts:layout,acceptance}
 await writeFile(join(out,'evaluation.json'),JSON.stringify(all,null,2))
 await writeFile(join(directory,'acceptance.json'),JSON.stringify({...acceptance,evaluationPath:out,unresolved},null,2))
 console.log(JSON.stringify({run:directory,taskId,status:acceptance.status,passed:acceptance.checks.filter(c=>c.status==='passed').length,failed:acceptance.checks.filter(c=>c.status==='failed').length,unverified:acceptance.checks.filter(c=>c.status==='unverified').length,replays,evaluationPath:out}))
 return all
}
function normalizeQuote(extract){return String(extract).split(/\n\s*\n/).find(p=>p.trim().length>=25)?.trim().slice(0,180)||String(extract).trim().slice(0,180)}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const options={layouts:args.layouts!=='false',maxReplays:Number(args.maxReplays)||20,timeoutMs:Number(args.timeoutMs)||180000}
 if(args.batch){
  const root=resolve(args.batch),entries=await readdir(root,{withFileTypes:true}),queue=[]
  for(const e of entries.filter(e=>e.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))){const d=join(root,e.name);if(await maybe(join(d,'result.json'))&&!await maybe(join(d,'acceptance.json'))&&!await maybe(join(d,'evaluation','independent-calibration-r1','acceptance-calibration.json')))queue.push(d)}
  if(args.executeBatch!=='true')console.log(JSON.stringify({mode:'dry-run',queue,note:'Wait for generation browser release; then explicitly use --executeBatch=true. Serial only.'}))
  else{const outcomes=[];for(const d of queue){try{const r=await evaluateRun(d,options);outcomes.push({run:d,status:r.acceptance.status,evaluationRevision:r.revision})}catch(e){outcomes.push({run:d,status:'unverified',error:e.message})}await writeFile(join(root,'independent-batch-progress.json'),JSON.stringify({updatedAt:new Date().toISOString(),outcomes,remaining:queue.slice(outcomes.length)},null,2))}}
 }else{
  if(!args.run)throw Error('Usage: node scripts/exploration/evaluate-run.mjs --run=experiments/.../runs/RUN or --batch=.../runs [--executeBatch=true]')
  await evaluateRun(args.run,options)
 }
}
