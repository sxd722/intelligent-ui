// Exact-artifact independent screening replay. No generation or external tools.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {runDebugBrowser} from '../../server/cardspec/debug-browser.mjs'
import {layoutChecks,sha256} from './acceptance.mjs'
const root=resolve('experiments/round1-20261117/runs')
const arg=process.argv.find(x=>x.startsWith('--task='))?.split('=')[1]
const json=async p=>JSON.parse(await readFile(p,'utf8'))
const ck=(name,extra={})=>({op:'click',name,...extra}),fill=(name,value)=>({op:'fill',name,value:String(value)})
const reason='六小时足够且费用较低'
for(const name of (await readdir(root)).filter(n=>n.startsWith('screen-0'+arg+'-')).sort()){
 const d=join(root,name),r=await json(join(d,'result.json')).catch(()=>null);if(!r?.spec)continue
 const out=join(d,'evaluation','frozen-path-r3');await mkdir(out,{recursive:true})
 if(await json(join(out,'review.json')).catch(()=>null))continue
 const sourceHash=sha256(r.source),arm=name.split('-').at(-2),spec=r.spec
 const candidates=[];for(const f of (await readdir(d)).filter(f=>/^browser-\d+\.json$/.test(f))){const b=await json(join(d,f));if(b.sourceHash===sourceHash)candidates.push(b)}
 const initial=candidates.flatMap(b=>b.result?.runs||[]).find(x=>x.width===432&&x.scenario==='normal')?.initial
 const inventory=initial?.controls||[]
 const byEntity=(entity,label)=>inventory.find(c=>decodeURIComponent(c.handle||'').split('/').includes(entity)&&(!label||c.name===label))
 const entityStep=(entity,label)=>{const c=byEntity(entity,label);return c?ck(c.name,{handle:c.handle}):null}
 const missing=[],paths={}
 if(arg==='1'){
  if(['B1','V1'].includes(arm)){
   paths['initial-compare']=[ck('芦苇'),ck('下一组'),ck('苔藓'),{op:'reload'}]
   paths['relax-and-decide']=[ck('要求'),fill('最低续航',6),ck('完成'),ck('下一组'),ck('石溪'),ck('苔藓'),fill('最终借哪套及理由',reason),ck('保存决定'),{op:'reload'}]
   missing.push('Individual detail and return destinations absent in source; save takes first selected object.')
  }else if(arm==='C1'){
   paths['initial-compare']=[entityStep('reed'),entityStep('moss'),{op:'reload'}]
   paths['relax-and-decide']=[ck('要求'),fill('最低续航',6),ck('完成'),{op:'click',name:'石溪 450g · 6h · 40元/天 达标'},entityStep('reed'),ck('石溪',{role:'radio'}),fill('理由',reason),ck('保存决定'),{op:'reload'}]
   missing.push('Individual detail and return destinations absent in source.')
  }else if(arm==='H1'){
   paths['initial-compare']=[ck('芦苇'),ck('苔藓'),{op:'reload'}]
   paths['relax-and-decide']=[ck('石溪'),ck('苔藓'),ck('要求与理由'),fill('最低续航(h)',6),fill('选择理由',reason),ck('完成'),ck('保存决定'),{op:'reload'}]
   missing.push('Individual detail and return destinations absent in source; save takes first selected object.')
  }else if(arm==='S1'){
   paths['initial-compare']=[ck('芦苇'),ck('下一组'),ck('下一组'),ck('苔藓'),ck('对照',{role:'radio'}),ck('筛选',{role:'radio'}),{op:'reload'}]
   paths['relax-and-decide']=[fill('最低续航',6),ck('决定',{role:'radio'}),ck('石溪 · 达标'),fill('借这套的理由',reason),ck('保存决定'),{op:'reload'}]
   missing.push('No individual inspect destination; comparison and list navigation are present.')
  }else if(arm==='S2'){
   paths['initial-compare']=[entityStep('reed','对比'),entityStep('moss','对比'),entityStep('moss','详情'),ck('返回列表'),ck('对比 2/2'),{op:'reload'}]
   paths['relax-and-decide']=[ck('调整要求'),fill('最低续航',6),ck('调整要求'),entityStep('stone','对比'),entityStep('reed','对比'),ck('决定'),ck('石溪'),fill('理由',reason),ck('保存决定'),{op:'reload'}]
  }
 }else if(arg==='2'){
  const assign=entity=>entityStep(entity,'雪松机')
  const saved=ck('保存安排'),ticket=inventory.find(c=>/入场券/.test(c.name)&&c.role==='button')
  paths['resolve-overrun']=[assign('leaflet')]
  if(!assign('leaflet')){missing.push('Assignment radios not observed in same-source inventory; no guessed index. Inspect second page only.');paths['inventory-only']=[ck('卡片页面：第 2 屏，共 2 屏'),{op:'check'}]}
  if(ticket)paths['resolve-overrun'].push(ck(ticket.name,...[]),...(arm==='H1'?[ck('查看 入场券')]:[]),...(arm==='S2'?[ck('返回列表')]:arm==='H1'?[ck('返回')]:[]))
  else missing.push('Ticket-specific inspect control not observed; do not substitute poster.')
  paths['resolve-overrun'].push(saved,{op:'reload'})
  paths['different-overrun']=[assign('poster'),{op:'check'}]
  if(!assign('leaflet')){delete paths['resolve-overrun'];delete paths['different-overrun']}
 }else{
  paths['step-pause-restore']=[...Array.from({length:4},()=>ck('前进一步')),{op:'check',waitMs:2200},{op:'reload'}]
  paths['rate-boundary']=[ck('10',{role:'radio'}),...Array.from({length:7},()=>ck('前进一步')),{op:'check'}]
  paths['play-pause-reset']=[ck('开始'),{op:'check',waitMs:2200},ck('暂停'),{op:'check',waitMs:2200},ck('重新开始'),{op:'check'}]
 }
 const steps=Object.entries(paths).flatMap(([path,steps])=>steps.filter(Boolean).map(s=>({...s,path})))
 await writeFile(join(out,'plan.json'),JSON.stringify({sourceHash,paths,missing,oracleUnchanged:true,sourceUnchanged:true,locatorBasis:'Same-source browser inventory plus readable source event labels; no state injection.'},null,2))
 let browser,layouts=[];try{browser=await runDebugBrowser(spec,{steps,scenarios:['normal'],viewports:[432],size:'square',snapshots:[],captureSteps:true,artifactDir:join(out,'paths'),signal:AbortSignal.timeout(110000)});await writeFile(join(out,'browser.json'),JSON.stringify(browser,null,2))}catch(e){browser={status:'unverified',reason:e.message,runs:[]}}
 try{layouts=await layoutChecks(spec,{artifactDir:join(out,'layouts'),signal:AbortSignal.timeout(100000)})}catch(e){missing.push('Layout environment: '+e.message)}
 await writeFile(join(out,'layouts.json'),JSON.stringify(layouts,null,2))
 const review={revision:'frozen-path-r3',sourceHash,contextHash:sha256(spec.context||{}),artifactRole:r.unverifiedPreview?'unverified-preview':'generated-result',oracleUnchanged:true,sourceUnchanged:true,modelCalls:0,liveCliCalls:0,missing,browserStatus:browser.status,paths:(browser.runs||[]).map(x=>({path:x.path,initial:x.initial?.state,final:x.final?.state,logic:x.final?.componentState,derived:x.final?.derived,operations:x.actions.map(a=>({step:a.step,ok:a.ok,error:a.error,restored:a.restored,observed:a.observed,layoutIssues:a.layoutIssues})),layout:x.final?.layout,screenshot:x.screenshot})),initialLayouts:layouts.flatMap(l=>(l.runs||[]).map(x=>({size:l.size,width:x.width,issues:x.final?.layout?.issues,pass:x.final?.layout?.pass}))),status:'pending-independent-oracle-mapping'}
 await writeFile(join(out,'review.json'),JSON.stringify(review,null,2));console.log(JSON.stringify({run:name,paths:review.paths.map(x=>({path:x.path,actions:x.operations.length,failed:x.operations.filter(a=>!a.ok).length})),initialLayouts:review.initialLayouts.length}))
}
