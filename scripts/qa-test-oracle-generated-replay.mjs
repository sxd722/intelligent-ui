import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
const root='artifacts/test-oracle-qa',results=[]
const relation={left:'derived.days.length',op:'eq',right:'derived.current.days'}
const cases=[
 {id:'motion',steps:[
  {op:'fill',name:'速度（米/秒）',value:'5',expect:{derived:{distance:50},sandboxChanged:'track'}},
  {op:'click',name:'揭晓计算解释',expect:{text:'5 米/秒 × 10 秒 = 50 米',state:{showWhy:true}}},
  {op:'click',name:'返回观察',expect:{state:{showWhy:false},controls:[{name:'揭晓计算解释',enabled:true}]}},
  {op:'reload',expect:{state:{speed:5,showWhy:false},derived:{distance:50}}},
 ]},
 {id:'shopping',steps:[
  {op:'click',name:'书 · 30元 · 平装小说',expect:{derived:{total:30,left:70}}},
  {op:'click',name:'耳机 · 80元 · 有线入耳',expect:{derived:{total:110,left:-10},controls:[{name:'确认购买',enabled:false}]}},
 ]},
 {id:'kilimanjaro',steps:[
  {op:'check',expect:{relations:[relation]}},
  {op:'select',name:'选择路线',value:'machame',expect:{relations:[relation],sandboxChanged:'routeMap'}},
  {op:'select',name:'选择路线',value:'rongai',expect:{relations:[relation],sandboxChanged:'routeMap'}},
  {op:'select',name:'选择路线',value:'lemosho',expect:{relations:[relation],sandboxChanged:'routeMap'}},
  {op:'click',name:'D8 巴拉夫—乌胡鲁峰—姆韦卡',expect:{state:{day:8},text:'夜间冲顶后下撤出山。'}},
  {op:'click',name:'返回日程',expect:{state:{day:0,routeId:'lemosho'},relations:[relation]}},
  {op:'reload',expect:{state:{day:0,routeId:'lemosho'},relations:[relation]}},
 ]},
]
for(const c of cases){
 const r=JSON.parse(await readFile(`${root}/generated/${c.id}.json`,'utf8'))
 const compiled=compileCard(r.source,{final:true,context:{renderMode:c.id==='shopping'?'native':'hybrid',expressionDialect:'js-v1'}});await validateRichContent(compiled)
 if(!compiled.complete)throw Error(JSON.stringify(compiled.diagnostics))
 const artifactDir=`${root}/generated-${c.id}`;await mkdir(artifactDir,{recursive:true})
 const browser=await runDebugBrowser(compiled.spec,{steps:c.steps,scenarios:['normal'],viewports:[432,320],captureSteps:true,size:'full',artifactDir})
 await writeFile(artifactDir+'/trace.json',JSON.stringify(browser,null,2))
 const failures=browser.runs.flatMap(run=>run.actions.filter(a=>!a.ok||a.assertion?.passed===false||a.restored===false).map(a=>({width:run.width,step:a.step,observed:a.observed,failures:a.assertion?.failures,error:a.error})))
 const errors=browser.runs.flatMap(run=>[...run.pageErrors,...run.initial.errors,...run.final.errors])
 const result={id:c.id,apiStatus:r.status,elapsedMs:r.elapsedMs,browser:browser.status,passed:browser.status==='tested'&&!failures.length&&!errors.length,failures,errors,scope:'Independent replay of actual newly generated source; no code edits. Route descriptions not fact-checked.'}
 results.push(result);console.log(JSON.stringify({id:result.id,apiStatus:r.status,passed:result.passed,failures:failures.length,errors}));await writeFile(root+'/generated-replay.json',JSON.stringify(results,null,2))
}
