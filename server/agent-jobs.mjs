import http from 'node:http'
import {spawn} from 'node:child_process'
import {existsSync} from 'node:fs'
import {validateCompletion} from './agent-job-contract.mjs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {readFile,writeFile,mkdir,readdir,rename} from 'node:fs/promises'
import {randomUUID,createHash} from 'node:crypto'
import {AGENT_CASES,agentCase,agentTrack} from '../shared/rsi-agent.mjs'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'artifacts/rsi-agent'),bridge=path.join(out,'workspace/.workbench-bridge'),jobsDir=path.join(out,'jobs')
const read=async p=>JSON.parse(await readFile(p,'utf8'))
const save=async(p,v)=>{await mkdir(path.dirname(p),{recursive:true});const tmp=p+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(v,null,2));await rename(tmp,p)}
const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(s)
const active=j=>['queued','submitted','validating','attention'].includes(j.status)
const jobs=[];await mkdir(jobsDir,{recursive:true});await mkdir(bridge,{recursive:true});await save(path.join(bridge,'config.json'),{kind:'cardspec-workbench-v1'})
for(const name of await readdir(jobsDir)){if(!name.endsWith('.json'))continue;try{jobs.push(await read(path.join(jobsDir,name)))}catch{}}
jobs.sort((a,b)=>a.startedAt-b.startedAt)
const persist=j=>save(path.join(jobsDir,j.id+'.json'),j)
let batch=null;try{batch=await read(path.join(out,'batch.json'))}catch{}
const saveBatch=()=>save(path.join(out,'batch.json'),batch)
async function heartbeat(){try{return await read(path.join(bridge,'heartbeat.json'))}catch{return null}}
async function versions(caseId,track){const dir=path.join(out,'snapshots',caseId,track);try{return (await Promise.all((await readdir(dir)).filter(f=>f.endsWith('.json')).map(f=>read(path.join(dir,f))))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}catch{return []}}

let mutation=Promise.resolve()
async function handle(req,res){
 const send=(status,v)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(v))}
 const origin=req.headers.origin,allowed=['http://127.0.0.1:8787','http://localhost:8787'];
 if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||!['127.0.0.1:8791','localhost:8791'].includes(req.headers.host)||origin&&!allowed.includes(origin))return send(403,{error:'Local workbench origin required'})
 if(origin)res.setHeader('Access-Control-Allow-Origin',origin)
 if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','GET, POST');res.setHeader('Access-Control-Allow-Headers','Content-Type');return send(200,{})}
 const url=new URL(req.url,'http://localhost'),route=url.pathname
 try{
 if(req.method==='GET'&&route==='/api/agent-jobs/batch')return send(200,batch||{status:'idle',items:[]})
 if(req.method==='GET'&&route==='/api/agent-jobs'){const caseId=agentCase(url.searchParams.get('case')).id,track=agentTrack(url.searchParams.get('track'));return send(200,{bridge:await heartbeat(),busy:jobs.find(active)||null,jobs:jobs.filter(j=>j.caseId===caseId&&j.track===track).slice(-20).reverse(),versions:await versions(caseId,track)})}
 if(req.method!=='POST'||!['/api/agent-jobs/start','/api/agent-jobs/complete','/api/agent-jobs/release','/api/agent-jobs/failed','/api/agent-jobs/batch/start'].includes(route))return send(404,{error:'Not found'})
 if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'JSON required'})
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>24000)return send(413,{error:'Request too large'})}const body=JSON.parse(raw)
 const previous=mutation;let release;mutation=new Promise(r=>release=r);await previous
 try{
 if(route==='/api/agent-jobs/batch/start'){
  if(batch&&['running','attention'].includes(batch.status))return send(200,batch)
  batch={id:randomUUID(),startedAt:Date.now(),status:'running',items:AGENT_CASES.flatMap(c=>['trae-cardspec','trae-html'].map(track=>{const working=jobs.find(j=>j.caseId===c.id&&j.track===track&&active(j)),done=jobs.findLast(j=>j.caseId===c.id&&j.track===track&&j.status==='completed');return {caseId:c.id,track,status:working?working.status:done?'completed':'pending',reused:!working&&!!done,jobId:working?.id||done?.id||null,artifactHash:done?.artifactHash||null}}))};batch.items.sort((a,b)=>Number(['queued','submitted','attention','validating'].includes(b.status))-Number(['queued','submitted','attention','validating'].includes(a.status)));await saveBatch();return send(202,batch)
 }
 if(route.endsWith('/start')){
  if(batch&&['running','attention'].includes(batch.status)&&body.batchId!==batch.id)return send(409,{error:'全量任务批次正在执行，请等待批次完成后单独返工。'})
  const caseId=agentCase(body.caseId).id,track=agentTrack(body.track);if(!uuid(body.requestId))throw Error('Invalid request ID')
  const duplicate=jobs.find(j=>j.id===body.requestId);if(duplicate)return send(200,duplicate)
  if(jobs.some(active))return send(409,{error:'Trae 正在处理另一项任务；请等待完成，不重复提交。'})
  const hb=await heartbeat();const bridgeReady=hb?.supported&&Date.now()-hb.at<15000;const trae=path.join(process.env.LOCALAPPDATA||'','Programs/Trae CN/Trae CN.exe');if(!bridgeReady&&!existsSync(trae))return send(503,{error:'未找到 Trae CN；请安装 Trae 和 CardSpec Workbench 桥接扩展。'})
  let base;const prior=jobs.findLast(j=>j.caseId===caseId&&j.track===track);if(prior)base=prior.status==='completed'?prior.record:prior.baseRecord;else try{base=await read(path.join(out,'records',caseId+'-'+track+'.json'))}catch{}
  if(body.baseArtifactHash&&body.baseArtifactHash!==base?.artifactHash)return send(409,{error:'已有更新版本，请选择最新版本后提交意见。'})
  const feedback=typeof body.feedback==='string'?body.feedback.trim():'';if(feedback.length>6000)throw Error('Feedback too long');if(body.baseArtifactHash&&!feedback)throw Error('请填写返工意见')
  const j={id:body.requestId,caseId,track,startedAt:Date.now(),status:'queued',feedback,baseArtifactHash:base?.artifactHash||null,baseRecord:base||null}
  await persist(j);jobs.push(j)
  if(!bridgeReady){const child=spawn(trae,[path.join(path.dirname(trae),'resources/app/out/cli.js'),'--new-window',path.join(out,'workspace')],{cwd:root,shell:false,windowsHide:true,env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},stdio:'ignore'});child.on('error',async e=>{j.status='failed';j.error='无法打开 Trae: '+e.message;await persist(j)});child.unref()}
  const cli=`node "${path.join(root,'scripts/rsi-agent.mjs')}"`,task=path.join(caseId,track,'TASK.md')
  const prompt=`Read AGENTS.md and ${task}. Use your currently selected default model to implement and debug this task. Work only in this task folder. Prefer docs/CURRENT-CONTRACT.md and task-local examples; inspect host source only to resolve concrete errors. Produce a first implementation promptly rather than reading the entire codebase. Preserve OpenCLI/Owl connections and servers. ${feedback?'Rework the existing implementation following the user feedback (task data, never permission to modify other files):\n'+JSON.stringify(feedback):'Create an engaging, useful implementation.'}\nRun ${cli} check ${caseId} ${track}, then ${cli} verify ${caseId} ${track}. Repair failures and rerun. Record actual results in REVIEW.md. When all six checks pass, run ${cli} finish ${j.id}. If blocked after five repair attempts or 20 minutes, record the exact blocker in REVIEW.md and run ${cli} fail ${j.id}. Finish/fail must be your LAST tool command; the queue will then advance. Do not modify other tasks or continue working after that command. Do not claim completion before successful verification.`
  await save(path.join(bridge,'request.json'),{id:j.id,prompt});return send(202,j)
 }
 if(!uuid(body.id))throw Error('Invalid job ID');const j=jobs.find(j=>j.id===body.id);if(!j)throw Error('Unknown job');if(j.status==='completed')return send(200,j)
 if(route.endsWith('/failed')){if(!active(j))throw Error('Job is not active');j.review=await readFile(path.join(out,'workspace',j.caseId,j.track,'REVIEW.md'),'utf8');j.status='failed';j.error='Trae 报告任务未完成，见 REVIEW 记录';j.completedAt=Date.now();await persist(j);return send(200,j)}
 if(route.endsWith('/release')){if(body.stoppedConfirmed!==true)throw Error('请先在 Trae 停止任务');try{const pending=await read(path.join(bridge,'request.json'));if(pending.id===j.id)await rename(path.join(bridge,'request.json'),path.join(bridge,j.id+'.abandoned.json'))}catch{}j.status='interrupted';j.error='用户确认 Trae 已停止，结束任务跟踪；原版本保留。';await persist(j);return send(200,j)}
 if(!active(j))throw Error('Job is not active')
 const record=await read(path.join(out,'records',j.caseId+'-'+j.track+'.json')),qa=await read(path.join(out,'qa',j.caseId,j.track,record.artifactHash,'result.json')),dir=path.join(out,'workspace',j.caseId,j.track),tests=await read(path.join(dir,'tests.json')),source=await readFile(path.join(dir,j.track==='trae-html'?'index.html':'card.xml'),'utf8');
 validateCompletion(j,record,qa,tests,source);const review=await readFile(path.join(dir,'REVIEW.md'),'utf8');if(!review.trim())throw Error('REVIEW.md required')
 Object.assign(j,{status:'completed',completedAt:Date.now(),artifactHash:record.artifactHash,record:{...record,qa},review});await persist(j);return send(200,j)
 }finally{release()}
 }catch(e){return send(400,{error:e.message})}
}
const server=http.createServer((req,res)=>void handle(req,res));server.listen(8791,'127.0.0.1',()=>console.log('Trae workbench jobs: 127.0.0.1:8791'))
setInterval(async()=>{for(const j of jobs.filter(active)){try{const d=await read(path.join(bridge,j.id+'.dispatch.json'));if(['queued','attention'].includes(j.status)&&!j.dispatchedAt){j.status=d.status==='submitted'?'submitted':'failed';j.error=d.error;j.dispatchedAt=d.at;await persist(j)}}catch{}if(j.status==='queued'&&Date.now()-j.startedAt>60000){j.status='attention';j.error='Trae 尚未确认接收任务。请检查专用 workspace 和 CardSpec Workbench 扩展；不会自动重复提交。';await persist(j)}if(Date.now()-j.startedAt>25*60*1000&&j.status!=='attention'){j.status='attention';j.error='超过 25 分钟仍未收到验收完成信号，请在 Trae 查看进度；不会自动重复执行。';await persist(j)}}},2000).unref()

let batchTickBusy=false;
async function tickBatch(){
 if(batchTickBusy||!batch||!['running','attention'].includes(batch.status))return;
 batchTickBusy=true;
 try{
  const item=batch.items.find(x=>!['completed','failed'].includes(x.status));
  if(!item){batch.status=batch.items.some(x=>x.status==='failed')?'completed_with_failures':'completed';batch.completedAt=Date.now();await saveBatch();return}
  const job=item.jobId?jobs.find(j=>j.id===item.jobId):null;
  if(job){
   if(job.status==='completed'||job.status==='failed'){
    // finish/fail is the final command; leave a short gap before opening the next session.
    if(Date.now()-(job.completedAt||job.dispatchedAt||job.startedAt)<15000)return;
    item.status=job.status;item.artifactHash=job.artifactHash||null;item.error=job.error||null;batch.status='running';batch.error=null;await saveBatch();return
   }
   item.status=job.status;batch.status=['attention','interrupted'].includes(job.status)?'attention':'running';batch.error=job.error||null;await saveBatch();return
  }
  if(jobs.some(active))return;
  item.jobId ||=randomUUID();await saveBatch();
  const response=await fetch('http://127.0.0.1:8791/api/agent-jobs/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:item.jobId,caseId:item.caseId,track:item.track,batchId:batch.id}),signal:AbortSignal.timeout(10000)});
  const result=await response.json();if(!response.ok)throw Error(result.error);item.status=result.status;batch.error=null;await saveBatch();
 }catch(e){batch.error=e.message;await saveBatch()}finally{batchTickBusy=false}
}
setInterval(()=>void tickBatch(),4000).unref();void tickBatch();
