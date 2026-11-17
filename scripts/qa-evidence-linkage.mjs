import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {bindingRecipe} from '../server/cardspec/binding-plan.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
import {composeTask} from '../shared/cardspec/task-composition.mjs'
const root='artifacts/evidence-linkage';await mkdir(root,{recursive:true})
const read=async p=>JSON.parse(await readFile(p,'utf8'))
const stored=await read(root+'/real-snapshots.json'),live=stored.slice(0,2),bili=stored[2]
const fixture=(query)=>{
 const raw={id:'D1',tool:'opencli.xiaohongshu.search',input:{query},value:{items:[{id:'a',title:query+'体验便利',url:'https://example.com/a',rowKey:'a'},{id:'b',title:query+'等待很久',url:'https://example.com/b',rowKey:'b'},{id:'c',title:query+'需要更多信息',url:'https://example.com/c',rowKey:'c'}],source:'controlled fixture',fetchedAt:'2026-11-11',truncated:false},updatedAt:'2026-11-11T00:00:00Z'}
 const analysis={id:'D2',tool:'dataset.analyze',input:{items:raw.value.items,instruction:'分类'},value:{...raw.value,items:raw.value.items.map((r,i)=>({...r,analysisLabel:['支持','担忧','未分类'][i],analysisQuote:i<2?r.title:''})),analysis:{dataset:{id:'D1',tool:raw.tool}}},updatedAt:raw.updatedAt}
 const other={id:'D3',tool:'opencli.bilibili.search',input:{query},value:{...raw.value,items:[{bvid:'other',title:query+'视频讨论',url:'https://example.com/video',rowKey:'v'}]},updatedAt:raw.updatedAt}
 return [raw,analysis,other]
}
const cases=[{id:'iphone',title:'iPhone Duo · 讨论证据',records:[...live,{...bili,id:'D3'}],mode:'real-snapshot'},...['城市骑行','新游戏体验'].map((x,i)=>({id:'cross-'+i,title:x,records:fixture(x),mode:'controlled-fixture'}))]
for(const c of cases){
 const [raw,analysis,other]=c.records,rawId=bindingRecipe(raw.tool,raw.input).id,otherId=bindingRecipe(other.tool,other.input).id,analysisId=bindingRecipe(analysis.tool,analysis.input).id
 const source=`<card design="business"><title>${c.title}</title>${bindingRecipe(raw.tool,raw.input).declaration}${bindingRecipe(other.tool,other.input).declaration}<binding id="${analysisId}" tool="dataset.analyze" input={{items:context.datasets.D1.items,instruction:${JSON.stringify(analysis.input.instruction)}}} load="manual"/><task-board id="evidence" label="样本与依据" layout="evidence" skin="signal" view={compose({main:"${rawId}",related:"${otherId}"},{annotations:"${analysisId}"})}/></card>`
 const compiled=compileCard(source,{final:true,context:{expressionDialect:'js-v1',datasets:Object.fromEntries(c.records.map(r=>[r.id,r.value]))}});if(!compiled.complete)throw Error(JSON.stringify(compiled.diagnostics))
 const chosen=analysis.value.items.find(r=>r.analysisQuote),category=chosen.analysisLabel
 const normalized=composeTask({raw:{...raw,status:'success'},other:{...other,status:'success'}},{annotations:'analysis'},{analysis:{...analysis,status:'success'}})
 const target=normalized.items.filter(x=>x.classification?.label===category).sort((a,b)=>(Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0))[0]
 const resultKey='evidence:/evidence',steps=[
  {op:'click',name:'分类 '+category,expect:{changedResults:[resultKey]}},
  {op:'click',name:'小红书',expect:{text:target.title}},
  {op:'click',name:'查看 '+target.title,expect:{text:target.classification.quote,changedResults:[resultKey]}},
  {op:'click',name:'打开原始来源 ↗',expect:{navigation:target.url}},
  {op:'click',name:'← 返回候选',expect:{text:target.title,changedResults:[resultKey]}},
  {op:'reload',expect:{text:target.title}},
  {op:'click',name:'B站',expect:{text:'暂无匹配结果',changedResults:[resultKey]}},
  {op:'click',name:'全部分类',expect:{changedResults:[resultKey]}},
 ]
 await mkdir(root+'/'+c.id,{recursive:true});await writeFile(root+'/'+c.id+'/candidate.cardspec',source);await writeFile(root+'/'+c.id+'/spec.json',JSON.stringify({...compiled.spec,prefetched:c.records}))
 const reports=[]
 for(const size of c.id==='iphone'?['square','full']:['full'])for(const width of c.id==='iphone'?[320,360,432]:[320,432]){
  const narrow=size==='square'||width<=360,selectedSteps=narrow?steps.map(s=>s.name==='分类 '+category?{...s,op:'select',name:'样本分类',value:category}:s.name==='小红书'?{...s,op:'select',name:'样本来源',value:raw.tool}:s.name==='B站'?{...s,op:'select',name:'样本来源',value:other.tool}:s.name==='全部分类'?{...s,op:'select',name:'样本分类',value:''}:s):steps
  const report=await runDebugBrowser(compiled.spec,{snapshots:c.records,steps:selectedSteps,scenarios:['normal'],viewports:[width],size,artifactDir:root+'/'+c.id+'/'+size,captureSteps:true})
  reports.push({size,...report});console.log(JSON.stringify({case:c.id,size,status:report.status,runs:report.runs.map(r=>({width:r.width,errors:r.pageErrors,actions:r.actions.map(a=>({name:a.step.name,ok:a.ok,assertion:a.assertion,error:a.error,restored:a.restored}))}))}))
 }
 await writeFile(root+'/'+c.id+'/browser.json',JSON.stringify({mode:c.mode,producer:'agent repaired CardSpec; exact real snapshots or explicitly controlled fixtures',reports},null,2))
}
