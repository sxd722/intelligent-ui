import {readFile,writeFile} from 'node:fs/promises'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
const root='artifacts/tool-field-navigation'
const r=JSON.parse(await readFile(root+'/game-round2.json','utf8'))
const xhs=r.spec.prefetched.find(r=>r.tool==='opencli.xiaohongshu.search').value.items[0]
const steps=[
 {op:'click',name:'小红书',role:'radio',expect:{state:{platform:'小红书'},text:'发言 18 条'}},
 {op:'click',name:'查看详情',index:0,expect:{changedKeys:['openId']}},
 {op:'click',name:'打开原文',role:'link',expect:{navigation:true}},
 {op:'click',name:'收起',expect:{state:{openId:''}}},
 {op:'click',name:'喜欢',role:'radio',expect:{text:'发言 0 条'}},
 {op:'click',name:'清除筛选',expect:{state:{platform:'all',stance:'all'},text:'发言 38 条'}},
 {op:'reload',expect:{state:{platform:'all',stance:'all'}}}
]
// The failed source has no real rows; explicitly supply an empty test double
// so the debug renderer does not inject generic DEBUG_SAMPLE rows for it.
const snapshots=[...r.spec.prefetched,{tool:'opencli.weibo.search',input:{keyword:'原神 影域 枪战',limit:20},value:{items:[],source:'QA_EMPTY_UNAVAILABLE_SOURCE',fetchedAt:new Date().toISOString(),truncated:false}}]
const result=await runDebugBrowser(r.spec,{steps,snapshots,scenarios:['normal'],viewports:[320,360,432],size:'auto',captureSteps:true,artifactDir:root+'/game-acceptance'})
for(const run of result.runs){
 const a=run.actions[2],selected=run.actions[1]?.observed?.state?.openId
 const row=r.spec.prefetched.find(r=>r.tool==='opencli.xiaohongshu.search').value.items.find(r=>'xhs-'+r.rowKey===selected)
 run.sourceIdentityPassed=!!row&&a?.observed?.navigation?.some(n=>n.valid&&n.url===new URL(row.url).href)
}
await writeFile(root+'/game-acceptance.json',JSON.stringify(result,null,2))
console.log(JSON.stringify(result.runs.map(r=>({width:r.width,actions:r.actions.map(a=>({ok:a.ok,step:a.step.name||a.step.op,assertion:a.assertion,error:a.error}))}))))
