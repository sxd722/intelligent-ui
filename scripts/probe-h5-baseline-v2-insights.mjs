import {invokeTool} from '../src/baseline/transport.mjs'
import {insightRequest,validateInsight,attitudeStats} from '../src/baseline/insights.mjs'
import {readFile,writeFile} from 'node:fs/promises'
const base='http://127.0.0.1:8787',dir='artifacts/h5-baseline-v2',saved=JSON.parse(await readFile(`${dir}/live.json`,'utf8')),results=[]
const samples=[
 {rowKey:'test-positive',source:'合成用户反馈',content:'我很喜欢这辆车的舒适性，坐起来舒服。',date:'2026-10-18'},
 {rowKey:'test-negative',source:'合成用户反馈',content:'这辆车的制动体验让我不满意，我不会购买。',date:'2026-10-19'},
 {rowKey:'test-media',source:'合成用户反馈',content:'这个博主太讨厌了，没开过这辆车，不评价车辆。',date:'2026-10-19'}]
for(const [kind,rows,prefs]of [['sentiment',samples,{}],['family',saved.results.find(r=>r.tool==='opencli.ctrip.search').value.items.slice(0,2),{age:'3–6岁',budget:300}]]){
 const input=insightRequest(kind,rows,prefs),start=Date.now();try{const value=await invokeTool('glm.generate',input,{sessionId:crypto.randomUUID(),pageId:'h5-v2-insight-probe',signal:AbortSignal.timeout(120000),fetcher:(p,o)=>fetch(base+p,o)});validateInsight(kind,value,rows);results.push({kind,dataMode:kind==='sentiment'?'explicit synthetic evidence':'recorded real Ctrip evidence',input,value,ms:Date.now()-start,passed:true,...(kind==='sentiment'?{counts:attitudeStats(rows,value).counts}: {})})}catch(e){results.push({kind,passed:false,error:e.message,ms:Date.now()-start})}console.log(JSON.stringify(results.at(-1)))
}
await writeFile(`${dir}/model-validation.json`,JSON.stringify({at:new Date().toISOString(),results},null,2))
