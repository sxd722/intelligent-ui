// Frozen confirm-task UI replay. Explicit execution only after shared-browser release.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {runDebugBrowser} from '../../server/cardspec/debug-browser.mjs'
import {sha256,layoutChecks} from './acceptance.mjs'
const root=resolve('experiments/round1-20261117'),read=async p=>JSON.parse(await readFile(p,'utf8')),code=await read(join(root,'code-version.json'))
const c=(name,x={})=>({op:'click',name,...x}),fill=(name,value)=>({op:'fill',name,value}),reload={op:'reload'},check={op:'check'},filter=process.argv.find(x=>x.startsWith('--filter='))?.slice(9)||''
for(const name of (await readdir(join(root,'runs'))).filter(n=>n.startsWith('confirm-')&&n.includes(filter)).sort()){
 const d=join(root,'runs',name),r=await read(join(d,'result.json')).catch(()=>null),q=await read(join(d,'request.json')),out=join(d,'evaluation/confirm-independent-r1');await mkdir(out,{recursive:true})
 if(!r?.spec){await writeFile(join(d,'acceptance.json'),JSON.stringify({version:'confirm-independent-r1',runId:name,status:'failed',businessStatus:'unverified',layoutStatus:'unverified',artifactDelivered:false,sourceHash:r?.source?sha256(r.source):null,checks:[{id:'delivery',status:'failed',note:'No compiled spec delivered. Attempt remains in denominator; no manual source repair or regeneration.'}],evidence:[join(d,'run.json'),join(d,'result.json')],sourceUnmodified:true,oracleUnchanged:true},null,2));console.log(name+' no spec');continue}
 if(await read(join(out,'browser.json')).catch(()=>null)){console.log(name+' already evaluated');continue}
 const sourceHash=sha256(r.source),rep2=name.endsWith('rep2'),arm=name.includes('-H1-')?'H1':name.includes('-S1-')?'S1':'B1';let paths={}
 if(name.includes('piece')){
  const label=arm==='S1'?(rep2?'零件名字':'或输入零件名'):arm==='B1'&&rep2?'或输入零件名':'或输入名字'
  paths={'known-lookup':[fill(label,'月亮标记'),reload],'unknown-lookup':[fill(label,'沙漏标记'),reload]}
 }else if(arm==='S1'){
  const title=(s,suffix='未定')=>rep2?s+' · '+suffix:s
  const filterStep=c(rep2?'只看未确认':'只看尚未确认的照片',{role:rep2?'button':'checkbox'})
  paths={'defer-conflict':[fill('我的备注','先问相册主人，暂不定年份'),c('保留待核实'),c(title('开学第一天'),{role:'radio'}),c(title('旧渡口合影','待核实'),{role:'radio'}),reload,filterStep,check], 'confirm-agreement':[c(title('开学第一天'),{role:'radio'}),fill('我的备注','两条独立记录一致'),c('确认 2004 年'),filterStep,c(title('雪后院子'),{role:'radio'}),reload]}
 }else{
  const page1=arm==='B1'?[c('卡片页面：第 1 屏，共 2 屏')]:[],note=[fill('我的备注','先问相册主人，暂不定年份'),...(arm==='B1'?[c('保存备注')]:[])],filterStep=c(arm==='B1'?'只看未确认':'未确认',{role:arm==='B1'?'checkbox':'radio'})
  paths={'defer-conflict':[c('保留待核实'),...note,...page1,c('下一组'),c('开学第一天'),c('上一组'),c('旧渡口合影'),reload,filterStep,check], 'confirm-agreement':[c('下一组'),c('开学第一天'),c(arm==='B1'?'确认年份':'确认 2004 年'),fill('我的备注','两条独立记录一致'),...(arm==='B1'?[c('保存备注')]:[]),...page1,filterStep,c('下一组'),c('雪后院子'),reload]}
 }
 const snapshots=await read(join(d,'snapshots.json')).catch(()=>[]),manifest={runId:name,sourceHash,contextHash:sha256(r.spec.context||{}),evaluationBuildHash:code.buildHash,replayMode:q.replayMode,snapshotHash:sha256(snapshots),sourceUnmodified:true,oracleUnchanged:true,paths,locatorBasis:'Same-source generated browser inventory and source labels. No state injection, forced clicks, or source changes.',modelCalls:0,liveCliCalls:0}
 await writeFile(join(out,'manifest.json'),JSON.stringify(manifest,null,2))
 if(!process.argv.includes('--execute'))continue
 const b=await runDebugBrowser(r.spec,{steps:Object.entries(paths).flatMap(([path,s])=>s.map(v=>({...v,path}))),scenarios:['normal'],viewports:[432],size:'square',snapshots,replayMode:q.replayMode,captureSteps:true,artifactDir:join(out,'paths'),signal:AbortSignal.timeout(110000)})
 await writeFile(join(out,'browser.json'),JSON.stringify(b,null,2));const ls=await layoutChecks(r.spec,{snapshots,replayMode:q.replayMode,artifactDir:join(out,'layouts'),signal:AbortSignal.timeout(110000)});await writeFile(join(out,'layouts.json'),JSON.stringify(ls,null,2));console.log(JSON.stringify({run:name,paths:b.runs?.map(x=>({path:x.path,failed:x.actions.filter(a=>!a.ok).map(a=>({name:a.step.name||a.step.op,error:a.error})),state:x.final?.state,derived:x.final?.derived})).map(x=>({...x,derived:Object.keys(x.derived||{})}))}))
}
