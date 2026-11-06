import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {loadApiKey} from '../../server/env.mjs'
import {createModelClient} from '../../server/research/model-client.mjs'
import {createLocalEncoder} from '../../server/tools/semantic-discovery.mjs'
import {roles,schemaFor} from './cases.mjs'
import {CASES,MODEL,checkMapping,mappingScore,messagesFor,compile,checkInteraction} from './engine.mjs'
export const dir='artifacts/tool-binding-qa/deepseek-v4-flash-20261102-v2'
await mkdir(dir,{recursive:true})
const save=async(name,value)=>writeFile(`${dir}/${name}.json`,JSON.stringify(value,null,2))
const key=loadApiKey();if(!key.ok)throw Error('Configured gateway key unavailable')
const round=createModelClient({base:process.env.MODEL_BASE_URL||'https://model-gateway.example.invalid/v1',key:key.value,model:MODEL})
const args=process.argv.slice(2),mode=args[0]||'probe'
if(mode==='probe'){
 const t=Date.now();const result=await round([{role:'user',content:'Reply only OK'}],{maxTokens:100,thinking:{type:'disabled'},signal:AbortSignal.timeout(30000)});const record={requested:MODEL,reported:result.model,ms:Date.now()-t,content:result.message.content,usage:result.usage};await save('model-probe',record);console.log(JSON.stringify(record));
}else if(mode==='preflight'){
 for(const c of CASES){
  const content=c.static?'<state id="color" type="string" initial="蓝"/><button label="切换颜色" onPress="toggle"/><text>{state.color}</text><action id="toggle"><set target="color" value={state.color=="蓝"?"红":"蓝"}/></action>':c.write?'<button label="暂停" onPress="pause"/><text>{bindings.feed.value.items[0]?.status ?? "待命"}</text>':`<input label="筛选" value={state.query} onChange="filter"/><collection label="候选" items={derived.rows} onSelect="select"/><text>{state.selected.title ?? "未选择"}</text><button label="刷新" onPress="refresh"/>${c.detail?'<button label="查看详情" onPress="detail" disabled={!state.selected.id}/><button label="返回" onPress="back"/>':''}${c.compare?'<button label="加入比较" onPress="compare"/>':''}`
  const result=compile(c,'A2','<card>'+content+'</card>');console.log(JSON.stringify({case:c.id,complete:result.complete,diagnostics:result.diagnostics,interaction:result.complete?await checkInteraction(c,'A2',c.map,result.spec):null}));
 }
}else if(mode==='map'){
 const encoder=createLocalEncoder(),maps={},scores=[],calls=[];try{
 for(const c of CASES){
  maps[c.id]={A0:c.map,A1:c.map,A2:c.map};if(c.static||c.write){maps[c.id].A3=c.map;maps[c.id].A4=c.map;continue}
  const fields=schemaFor(c),names=Object.keys(roles),t=Date.now();
  const vectors=await encoder.encode([...names.map(k=>roles[k]),...fields.map(f=>`${c.tool} ${f.name}; type=${f.type}; ${JSON.stringify(f.sample).slice(0,200)}`)]),matrix=names.map((role,i)=>fields.map((f,j)=>({field:f.name,score:vectors[i].reduce((n,x,k)=>n+x*vectors[names.length+j][k],0),type:f.type})).filter(f=>role!=='metric'||f.type==='number').sort((a,b)=>b.score-a.score));
  const proposed=Object.fromEntries(names.map((r,i)=>[r,matrix[i][0]?.score>=.28?matrix[i][0].field:null]));
  try{maps[c.id].A3=checkMapping(c,proposed)}catch(e){maps[c.id].A3={};maps[c.id].A3error=e.message}
  maps[c.id].A3meta={elapsedMs:Date.now()-t,matrix,threshold:.28,note:'Exploratory threshold, not calibrated probability. No gold map used.'};
  const messages=[{role:'system',content:'Return only a JSON object mapping the semantic roles id,title,subtitle,metric,facet to an exact supplied field name or null. id is a real business ID needed by the downstream tool, never rowKey/rank. metric must be a number with the relevant meaning. Select at most one field for each role. Do not invent missing fields. No prose.'},{role:'user',content:JSON.stringify({tool:c.tool,purpose:c.prompt,fields,detail:c.detail,roles})}],start=Date.now();
  try{const result=await round(messages,{maxTokens:1000,thinking:{type:'disabled'},temperature:.2,signal:AbortSignal.timeout(60000)});let content=result.message.content.trim().replace(/^```(?:json)?\s*|\s*```$/g,'');maps[c.id].A4=checkMapping(c,JSON.parse(content));calls.push({case:c.id,messages,response:result,ms:Date.now()-start})}catch(e){maps[c.id].A4={};maps[c.id].A4error=e.message;calls.push({case:c.id,messages,error:e.message,ms:Date.now()-start})}
  for(const arm of ['A1','A2','A3','A4'])scores.push({case:c.id,arm,checks:mappingScore(c,maps[c.id][arm])});await save('maps',{maps,scores,calls});console.log(JSON.stringify({case:c.id,A3:maps[c.id].A3,A4:maps[c.id].A4}));
 }
 }finally{encoder.close()}
 await save('maps',{maps,scores,calls});
}else if(mode==='generate'){
 const mappings=JSON.parse(await readFile(`${dir}/maps.json`,'utf8')),records=[];try{records.push(...JSON.parse(await readFile(`${dir}/results.json`,'utf8')))}catch{}
 const files=['scripts/binding-experiment/engine.mjs','scripts/binding-experiment/cases.mjs','shared/cardspec/registry.mjs','shared/cardspec/tools.mjs'];const hashes=Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(f)).digest('hex')])));
 const manifest={model:MODEL,temperature:.4,maxTokens:6000,maxRepair:2,timeoutMs:120000,scope:'S1 controlled synthetic tool fixtures; native CardSpec; 8 cases x 5 arms x 1 model = 40 runs; no live CLI, no production changes.',hashes,createdAt:new Date().toISOString()};await save('manifest',manifest)
 const onlyCase=args[1],onlyArm=args[2];const jobs=CASES.flatMap((c,i)=>['A0','A1','A2','A3','A4'].map((_,j)=>({c,arm:['A0','A1','A2','A3','A4'][(i+j)%5]}))).filter(j=>(!onlyCase||j.c.id===onlyCase)&&(!onlyArm||j.arm===onlyArm)&&!records.some(r=>r.case===j.c.id&&r.arm===j.arm));
 let writing=Promise.resolve();async function worker(){while(jobs.length){const {c,arm}=jobs.shift(),map=mappings.maps[c.id][arm];const fallbackReason=arm==='A3'&&!c.static&&!c.write&&(!map.title||(c.detail&&(!map.id||map.id==='rowKey')))?'Required title/business identity missing or UI row key used; fall back to current authoring':null;const effectiveArm=fallbackReason?'A0':arm,messages=messagesFor(c,effectiveArm,map),started=Date.now(),trace=[],record={case:c.id,arm,effectiveArm,fallbackReason,model:MODEL,startedAt:new Date().toISOString(),mapping:map,initialCharacters:JSON.stringify(messages).length,attempts:0};let result;
  for(let i=0;i<=2;i++){
   const start=Date.now();let source='';try{const response=await round(messages,{temperature:.4,maxTokens:6000,thinking:{type:'disabled'},signal:AbortSignal.timeout(120000),onPiece:p=>{if(p.content)source+=p.content}});trace.push({messages:structuredClone(messages),response,elapsedMs:Date.now()-start});record.attempts++;record.reportedModel=response.model;record.source=response.message.content;result=compile(c,effectiveArm,record.source);record.diagnostics=result.diagnostics;record.complete=!!result.complete;record.expanded=result.expanded;
    if(result.complete){record.spec=result.spec;record.runtime=await checkInteraction(c,effectiveArm,map,result.spec);if(record.runtime.passed)break}
    if(i<2){messages.push({role:'assistant',content:record.source},{role:'user',content:'只修复这些错误，保留全部请求功能。输出完整card，不重新规划。宿主注入声明不能复制到你的输出；数据用data.x，派生用derived.x，事件动作ID必须为带引号字符串。\n'+JSON.stringify(result.complete?record.runtime.checks.filter(x=>!x.passed):result.diagnostics.filter(d=>d.severity==='error').slice(0,6).map(({code,message})=>({code,message})))})}
   }catch(e){record.error=e.message;record.partialSource=source;trace.push({messages:structuredClone(messages),error:e.message,usage:e.usage,elapsedMs:Date.now()-start});record.attempts++;break}
  }
  record.elapsedMs=Date.now()-started;record.firstPass=!!record.runtime?.passed&&record.attempts===1;record.passed=!!record.complete&&!!record.runtime?.passed;record.usage=trace.reduce((a,t)=>{for(const k of ['prompt_tokens','completion_tokens','total_tokens'])a[k]+=(t.response?.usage?.[k]||t.usage?.[k]||0);return a},{prompt_tokens:0,completion_tokens:0,total_tokens:0});record.tracePath=`${c.id}-${arm}-trace.json`;await save(record.tracePath.replace('.json',''),trace);records.push(record);writing=writing.then(()=>save('results',records));await writing;console.log(JSON.stringify({case:c.id,arm,passed:record.passed,complete:record.complete,attempts:record.attempts,ms:record.elapsedMs,error:record.error,checks:record.runtime?.checks.filter(x=>!x.passed)}))
 }}await Promise.all([worker(),worker()]);
}else throw Error('Unknown mode')


