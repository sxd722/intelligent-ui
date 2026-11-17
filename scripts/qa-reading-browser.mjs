import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
const dir='artifacts/reading-organization-qa'
for(const id of (process.env.READING_CASE?[process.env.READING_CASE]:['journey','systems'])){
 const r=JSON.parse(await readFile(`${dir}/${id}/result.json`,'utf8'))
 const steps=id==='journey'?[
  {op:'click',name:'地方豪强',expect:{state:{topic:'local'},text:'3 / 3 项'}},
  {op:'click',name:'车迟国三妖',expect:{state:{selected:'tiger'}}},
  {op:'reload',expect:{state:{topic:'local',selected:'tiger'}}}
 ]:[
  {op:'click',name:'缓存',expect:{state:{topic:'cache'},text:'局部性'}},
  {op:'click',name:'局部性',expect:{state:{selection:{concurrency:'mutex',cache:'locality'}},text:'所有随机访问都命中'}},
  {op:'click',name:'查看详情'},
  {op:'click',name:'展开具体例子 · 局部性',expect:{text:'对比顺序遍历数组与随机跳跃访问。'}},
  {op:'click',name:'关闭详情'},
  {op:'click',name:'并发',expect:{state:{topic:'concurrency'}}},
  {op:'click',name:'缓存',expect:{state:{selection:{concurrency:'mutex',cache:'locality'}}}},
  {op:'click',name:'查看详情',expect:{text:'对比顺序遍历数组与随机跳跃访问。'}},
  {op:'reload',expect:{state:{selection:{concurrency:'mutex',cache:'locality'},expanded:{locality:true}}}},
  {op:'click',name:'查看详情',expect:{text:'对比顺序遍历数组与随机跳跃访问。'}}
 ]
 const result=await runDebugBrowser(r.spec,{steps,scenarios:['normal'],viewports:[320,432],size:'full',snapshots:r.spec.prefetched||[],artifactDir:`${dir}/${id}/browser`,captureSteps:true,signal:AbortSignal.timeout(90000)})
 await writeFile(`${dir}/${id}/browser.json`,JSON.stringify(result,null,2))
 console.log(id,result.status,JSON.stringify(result.runs.map(run=>({width:run.width,errors:run.final?.errors,actions:run.actions.map(a=>({name:a.step.name,ok:a.ok,error:a.error,assertion:a.assertion,restored:a.restored}))}))))
}
