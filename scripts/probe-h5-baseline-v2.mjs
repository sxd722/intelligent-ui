import {invokeTool} from '../src/baseline/transport.mjs'
import {insightRequest,validateInsight} from '../src/baseline/insights.mjs'
import {mkdir,writeFile} from 'node:fs/promises'
const base='http://127.0.0.1:8787',dir='artifacts/h5-baseline-v2';await mkdir(dir,{recursive:true})
const before=await(await fetch(base+'/api/tools/connections')).json(),results=[],sessionId=crypto.randomUUID()
async function invoke(tool,input){const t=Date.now();try{const value=await invokeTool(tool,input,{sessionId,pageId:'h5-v2-live',signal:AbortSignal.timeout(tool==='glm.generate'?120000:45000),fetcher:(p,o)=>fetch(base+p,o)});results.push({tool,input,value,ms:Date.now()-t,passed:true});console.log(JSON.stringify({tool,ms:Date.now()-t,passed:true,items:value.items?.length}));return value}catch(e){results.push({tool,input,error:e.message,ms:Date.now()-t,passed:false});console.log(JSON.stringify({tool,passed:false,error:e.message}));return null}}
async function analyze(kind,rows,prefs){if(!rows?.length)return;const v=await invoke('glm.generate',insightRequest(kind,rows,prefs));if(v)try{validateInsight(kind,v,rows);results.at(-1).semanticValidation=true}catch(e){Object.assign(results.at(-1),{passed:false,semanticValidation:false,error:e.message})}}
const places=await invoke('opencli.ctrip.search',{query:'杭州 萧山 亲子乐园',limit:5})
// User chooses from actual returned candidates; no invented attractions.
const selected=places?.items?.filter(r=>!/Hotel|酒店/.test(r.displayType||r.type||'')&&!/^[^,，]+区[,，]/.test(r.name||'')).slice(0,2)
await analyze('family',selected,{age:'3–6岁',budget:300,preference:'户外'})
const video=await invoke('opencli.bilibili.search',{query:'星际穿越 官方 预告',type:'video',limit:3})
const posts=await invoke('opencli.weibo.search',{keyword:'尊界 刹车',limit:5})
await analyze('sentiment',posts?.items?.map(r=>({...r,source:'微博反馈'})))
await analyze('overview',video?.items)
const after=await(await fetch(base+'/api/tools/connections')).json()
const preserved=before.browser?.binding?.session===after.browser?.binding?.session&&before.browser?.daemonPid===after.browser?.daemonPid
await writeFile(`${dir}/live.json`,JSON.stringify({at:new Date().toISOString(),before,after,preserved,results},null,2));console.log(JSON.stringify({connectionPreserved:preserved}))
