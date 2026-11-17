import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
const dir='artifacts/reading-navigation-qa'
for(const id of ['compact','systems']){
 const r=JSON.parse(await readFile(`${dir}/${id}/result.json`,'utf8'))
 const live=JSON.parse(await readFile(dir+'/live-tools.json','utf8')).filter(t=>t.result).map(t=>({tool:t.tool,input:t.input,value:t.result.value}))
 const steps=id==='compact'?[
 {op:'click',name:'人性偏见',expect:{state:{theme:'human',selected:'baigu'},text:'三打白骨精'}},
 {op:'click',name:'地方统治',expect:{state:{theme:'local',selected:'chechi'}}},
 {op:'click',name:'通天河与灵感大王',expect:{state:{selected:'tongtian'}}},
 {op:'click',name:'案例解读与书内证据',expect:{text:'陈家庄百姓为求平安'}},
 {op:'click',name:'查阅《西游记》书内证据',expect:{text:'书内检索关键词'}},
 {op:'reload',expect:{state:{selected:'tongtian',theme:'local'},text:'书内检索关键词'}},
 {op:'click',name:'返回上一层',expect:{text:'社会映射 · 一种解释'}},
 {op:'click',name:'返回上一层',expect:{state:{selected:'tongtian'},text:'相关案例'}}
 ]:[
 {op:'click',name:'缓存',expect:{state:{topic:'cache',caseId:'hit'}}},
 {op:'click',name:'局部性',expect:{state:{caseId:'locality',level:'detail'},text:'近期或相邻访问可能复用'}},
 {op:'click',name:'查看具体例子',expect:{state:{level:'example'},text:'对比顺序遍历与随机跳跃访问。'}},
 {op:'reload',expect:{state:{caseId:'locality',level:'example'},text:'对比顺序遍历与随机跳跃访问。'}},
 {op:'click',name:'返回机制对照',expect:{text:'所有随机访问都会命中'}},
 {op:'click',name:'返回案例',expect:{state:{caseId:'locality',level:'list'}}}
 ]
 const result=await runDebugBrowser(r.spec,{steps,viewports:[320,360,432],scenarios:['normal'],size:'full',snapshots:[...(r.spec.prefetched||[]),...live],artifactDir:`${dir}/${id}/browser`,captureSteps:true,signal:AbortSignal.timeout(90000)})
 await writeFile(`${dir}/${id}/browser.json`,JSON.stringify(result,null,2))
 console.log(id,result.status,result.runs.map(r=>({width:r.width,errors:r.final?.errors,failed:r.actions.filter(a=>!a.ok||a.assertion?.passed===false).map(a=>({name:a.step.name,error:a.error,assert:a.assertion})),restored:r.actions.some(a=>a.restored)})))
}
