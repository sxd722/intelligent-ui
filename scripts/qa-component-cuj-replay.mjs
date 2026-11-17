import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import {journeyCoverage} from '../server/cardspec/journey-coverage.mjs'
const root='artifacts/component-cuj-qa',results=[]
for(const id of ['shopping','motion']){
 const generated=JSON.parse(await readFile(`${root}/generated/${id}.json`,'utf8'))
 const compiled=compileCard(generated.source,{final:true,context:{renderMode:id==='motion'?'hybrid':'native',expressionDialect:'js-v1'}});await validateRichContent(compiled)
 if(!compiled.complete)throw Error(id+': '+JSON.stringify(compiled.diagnostics))
 const steps=id==='shopping'?[
  {op:'click',name:'选择 书',requirement:'R1',expect:{derived:{total:30,left:70}}},
  {op:'click',name:'选择 耳机',requirement:'R2',expect:{derived:{total:110,left:-10},controls:[{name:'确认购买',enabled:false}]}},
  {op:'click',name:'取消全部'},
  {op:'click',name:'选择 杯子',requirement:'R2',expect:{derived:{total:20},controls:[{name:'确认购买',enabled:true}]}},
  {op:'click',name:'确认购买',requirement:'R3',expect:{text:'本次所选',state:{confirmed:true}}},
  {op:'click',name:'返回修改',requirement:'R3',expect:{state:{confirmed:false},derived:{total:20}}},
  {op:'reload',requirement:'R4',expect:{derived:{total:20}}},
 ]:[
  {op:'fill',name:'速度',value:'5',requirement:'R1',expect:{derived:{distance:50},sandboxChanged:'track'}},
  {op:'click',name:'揭晓计算解释',requirement:'R2',expect:{state:{showWhy:true},text:'5 × 10 = 50'}},
  {op:'click',name:'返回观察',requirement:'R2',expect:{state:{showWhy:false},controls:[{name:'揭晓计算解释',enabled:true}]}},
  {op:'reload',requirement:'R3',expect:{state:{speed:5},derived:{distance:50}}},
 ]
 const goal=id==='shopping'?'多选计算合计；超预算阻止确认且取消后可继续；查看明细并返回修改；刷新保留选择':'修改速度同步更新位移和图形；查看解释并返回；刷新恢复速度'
 const artifactDir=`${root}/replay-${id}`;await mkdir(artifactDir,{recursive:true})
 const browser=await runDebugBrowser(compiled.spec,{steps,scenarios:['normal'],viewports:[432,320],size:'full',captureSteps:true,artifactDir})
 await writeFile(artifactDir+'/trace.json',JSON.stringify(browser,null,2))
 const coverage=journeyCoverage(goal,compiled.spec,browser),errors=browser.runs.flatMap(r=>[...r.final.errors,...r.actions.filter(a=>!a.ok||a.assertion?.passed===false).map(a=>a.error||a.assertion.failures.join(';'))])
 const r={id,originalGenerationStatus:generated.status,design:compiled.spec.design,elapsedMs:generated.elapsedMs,errors,coverage};results.push(r);console.log(JSON.stringify(r))
}
await writeFile(root+'/independent-replay.json',JSON.stringify(results,null,2))
if(results.some(r=>r.errors.length||r.coverage.status!=='checked'))process.exitCode=1
