// Locator-only revision: preserve r1 failures and the frozen expected results.
import{readFile,writeFile,mkdir}from'node:fs/promises'
import{join,resolve}from'node:path'
import{runDebugBrowser}from'../../server/cardspec/debug-browser.mjs'
const read=async p=>JSON.parse(await readFile(p,'utf8')),root=resolve('experiments/round1-20261117/runs'),c=(name,extra={})=>({op:'click',name,...extra}),f=(value)=>({op:'fill',name:'我的备注',value})
for(const arm of['B1','H1']){
 const d=join(root,arm==='B1'?'confirm-02-photo-evidence-B1-r4-rep1':'confirm-02-photo-evidence-H1-r4-rep2'),out=join(d,'evaluation/confirm-independent-r2'),r=await read(join(d,'result.json')),q=await read(join(d,'request.json'))
 await mkdir(out,{recursive:true})
 const page1=c('卡片页面：第 1 屏，共 2 屏'),paths=arm==='B1'?{
 'defer-conflict':[c('保留待核实'),f('先问相册主人，暂不定年份'),c('保存备注'),page1,c('开学第一天'),c('旧渡口合影'),{op:'reload'},c('只看未确认',{role:'checkbox'}),{op:'check'}],
 'confirm-agreement':[c('开学第一天'),c('确认年份'),f('两条独立记录一致'),c('保存备注'),page1,c('只看未确认',{role:'checkbox'}),c('雪后院子'),{op:'reload'}]
 }:{'confirm-agreement':[c('下一组'),c('开学第一天'),c('确认 2004 年'),f('两条独立记录一致'),c('未确认',{role:'radio'}),c('雪后院子'),{op:'reload'}]}
 await writeFile(join(out,'revision.json'),JSON.stringify({reason:arm==='B1'?'Same-source r1 controls show p2 already in first 2-item group; Next had skipped to p3.':'After filter the retained collection page already displays p3; Next is correctly disabled.',expectedUnchanged:true,sourceUnchanged:true,paths},null,2))
 const b=await runDebugBrowser(r.spec,{steps:Object.entries(paths).flatMap(([path,s])=>s.map(x=>({...x,path}))),scenarios:['normal'],viewports:[432],size:'square',snapshots:[],replayMode:q.replayMode,captureSteps:true,artifactDir:join(out,'paths'),signal:AbortSignal.timeout(110000)})
 await writeFile(join(out,'browser.json'),JSON.stringify(b,null,2));console.log(JSON.stringify({arm,runs:b.runs?.map(x=>({path:x.path,failed:x.actions.filter(a=>!a.ok).map(a=>({name:a.step.name,error:a.error})),state:x.final?.state,derived:x.final?.derived?.visiblePhotos||x.final?.derived?.visible}))}))
}
