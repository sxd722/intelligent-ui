import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {build} from 'esbuild'
import {loadApiKey} from '../../server/env.mjs'
import {createModelClient} from '../../server/research/model-client.mjs'
import {compileCard} from '../../shared/cardspec/compiler.mjs'
import {COMPOSITION_REFERENCE} from '../../shared/cardspec/task-composition.mjs'
import {TOOLS} from '../../shared/cardspec/tools.mjs'
const dir='artifacts/tooling-p0p1-20261103/complex',dest='dist/tooling-p0p1/complex';await mkdir(dir,{recursive:true});await mkdir(dest,{recursive:true})
const live=JSON.parse(await readFile('artifacts/tooling-p0p1-20261103/live.json','utf8')).results,extra=JSON.parse(await readFile('artifacts/tooling-p0p1-20261103/live-extra.json','utf8')).results
const seed=[...live,...extra].filter(r=>r.result?.value).map((r,i)=>({id:'D'+i,tool:r.tool,input:r.input,value:r.result.value,updatedAt:r.result.value.fetchedAt||new Date().toISOString()}))
const goals=[
 {id:'feed',goal:'合并 B站与小红书的亲子游内容，按来源筛选、选择条目查看详情，保留各自指标与来源。不将播放量和点赞量合计。',main:'opencli.bilibili.search',support:'opencli.xiaohongshu.search'},
 {id:'trip',goal:'以携程湘湖地点为主体，大众点评作为相关地点餐饮资料，天气按日期联动。选中地点后再按其名称搜索大众点评。地图只显示已确认坐标；返回保留选中，不伪造附近距离。',main:'opencli.ctrip.search',support:'opencli.dianping.search',weather:true},
 {id:'movie',goal:'豆瓣电影候选；选中电影后才用该电影名称查询 B站解读，展示相关资料并可返回，保留选择。',main:'opencli.douban.top250',support:'opencli.bilibili.search'}
]
const key=loadApiKey(),round=createModelClient({base:process.env.MODEL_BASE_URL||'https://model-gateway.example.invalid/v1',key:key.value,model:'deepseek-v4-flash'}),results=[]
for(const c of goals){
 const main=seed.find(r=>r.tool===c.main),support=seed.find(r=>r.tool===c.support)
 const messages=[{role:'system',content:'只输出一个CardSpec v1，使用binding/state/derive/action和task-board。不要输出模拟数据。根<card schemaVersion="1" actionMode="snapshot">。状态用state id/type/initial；根声明derive id/value；action中set target/value，invoke binding/input；snapshot里依次更新请用next。表达式js-v1。'+COMPOSITION_REFERENCE}, {role:'user',content:JSON.stringify({request:c.goal,main:{tool:c.main,input:main.input},support:{tool:c.support,input:c.id==='feed'?support.input:{...support.input,[c.id==='trip'?'keyword':'query']:''}},weather:c.weather?{tool:'opencli.wttr.forecast',input:{location:'Hangzhou',days:3},date:'2026-11-03'}:null,contracts:[c.main,c.support,...(c.weather?['opencli.wttr.forecast']:[])].map(id=>({id,input:TOOLS[id].inputSchema})),hint:'内容合并引用两个binding一起compose；相关搜索通过所选item.title产生参数，初始manual。无额外导航或第二套数据状态。'})}]
 const r={id:c.id,goal:c.goal,trace:[],startedAt:new Date().toISOString()},start=Date.now()
 for(let attempt=0;attempt<2;attempt++){
  try{const response=await round(messages,{maxTokens:3500,temperature:.3,thinking:{type:'disabled'},signal:AbortSignal.timeout(60000)});r.trace.push({messages:structuredClone(messages),response});r.source=response.message.content.trim().replace(/^```[^\n]*\n|\n```$/g,'');const compiled=compileCard(r.source,{final:true,cardId:'live-'+c.id,context:{expressionDialect:'js-v1'}});r.diagnostics=compiled.diagnostics;r.complete=compiled.complete;r.attempts=attempt+1;if(compiled.complete){r.spec=compiled.spec;r.spec.prefetched=seed;break}messages.push(response.message,{role:'user',content:'只修正以下契约错误，保留需求：'+JSON.stringify(compiled.diagnostics.filter(d=>d.severity==='error').slice(0,3))})}catch(e){r.error=e.message;break}
 }
 r.elapsedMs=Date.now()-start;await writeFile(dir+'/'+r.id+'-trace.json',JSON.stringify(r.trace,null,2));delete r.trace;await writeFile(dest+'/'+r.id+'.json',JSON.stringify(r));results.push(r);console.log(JSON.stringify({id:r.id,complete:r.complete,ms:r.elapsedMs,error:r.error}))
}
await writeFile(dir+'/generation.json',JSON.stringify(results,null,2))
await build({entryPoints:['scripts/tooling-p0p1/real-viewer.jsx'],bundle:true,format:'esm',platform:'browser',outfile:dest+'/viewer.js',define:{'process.env.NODE_ENV':'"production"'},loader:{'.woff2':'file','.ttf':'file','.woff':'file','.png':'file'},logLevel:'error'})
await writeFile(dest+'/viewer.html','<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="viewer.css"><style>body{margin:0;padding:12px;background:#e6ebf2;font-family:system-ui}main{margin:auto}</style><div id="root"></div><script type="module" src="viewer.js"></script>')
