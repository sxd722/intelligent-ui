import {mkdir,writeFile,appendFile,readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createDeltaApplier,isControlEvent} from '../../src/delta.js';
import {ROOT as BASE,DEST,cases} from './cases.mjs';
const ROOT=process.env.QA_ROUND?BASE+'/'+process.env.QA_ROUND:BASE;
const base='http://127.0.0.1:8787',headers={'Content-Type':'application/json',Origin:base};
await mkdir(ROOT,{recursive:true});await mkdir(DEST+'/runs',{recursive:true});
await writeFile(ROOT+'/BRIEF.md','# 三个新题真实生成对照\n\n同需求、432px、DeepSeek Flash、direct quick、严格沙箱可用、正常调试预算；本轮显式传入相同Stitch reference，重新读取真实工具。无人工修改产物，无 mock 工具。Stitch 仅视觉 mock，功能不记为实现。每例只跑一轮，保留生产流程内部修复。现有用户请求与连接不变。\n\n'+cases.map(c=>'## '+c.title+'\n\n'+c.prompt+'\n\n'+c.requirements.map(x=>'- '+x).join('\n')).join('\n\n'));
await writeFile(ROOT+'/connections-before.json',JSON.stringify(await fetch(base+'/api/tools/connections').then(r=>r.json()),null,2));
const jobs=[{caseId:'earth-sounds',id:'bd80a6d5-73d1-46e8-a7ca-52b9cf86f913'},{caseId:'dodo-detective',id:'8a0e5a7a-d5c2-44cc-9da2-f7b88fa4eac3'},{caseId:'space-game-night',id:'59711cf7-9212-405e-bd56-dbf4248aea7b'}];
for(const c of cases.filter(c=>!process.env.QA_CASE||c.id===process.env.QA_CASE)){
 const feedback=process.env.QA_ROUND?JSON.parse(await readFile(BASE+'/feedback.json','utf8'))[c.id]:null;
 const prior=feedback?JSON.parse(await readFile(BASE+'/round2/'+c.id+'.json','utf8')):null;
 const request={stitchReferenceId:jobs.find(j=>j.caseId===c.id).id,messages:feedback?[{role:'user',content:c.prompt},{role:'assistant',content:prior.source},{role:'user',content:c.prompt+'\n\n实际验收反馈（修复后用card_test提交关键路径断言，勿只编译；保持原生CardSpec主体）：'+feedback}]:[{role:'user',content:c.prompt}],format:'cardspec',mode:'direct',generationProfile:'adaptive-v1',expressionDialect:'js-v1',modelProfile:'deepseek-flash',toolsEnabled:true,designMode:'host',debugGeneration:true,buildMode:'quick',cardSize:'square',renderMode:'hybrid',turnId:randomUUID()};
 const started=Date.now(),events=[],applier=createDeltaApplier(),envelope={};let error;
 await writeFile(ROOT+'/'+c.id+'-request.json',JSON.stringify(request,null,2));await writeFile(ROOT+'/'+c.id+'.sse','');console.log('START '+c.id);
 try{const response=await fetch(base+'/api/chat',{method:'POST',headers,body:JSON.stringify(request),signal:AbortSignal.timeout(780000)});if(!response.ok)throw Error('HTTP '+response.status);let buffer='';const decoder=new TextDecoder();for await(const chunk of response.body){const text=decoder.decode(chunk,{stream:true});await appendFile(ROOT+'/'+c.id+'.sse',text);buffer+=text;let index;while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);if(!line.startsWith('data:')||line.slice(5).trim()==='[DONE]')continue;const e=JSON.parse(line.slice(5));events.push(e);if(!isControlEvent(e))applier.apply(envelope,e);if(['research','generation_debug','stream_error','message_stream_complete'].includes(e.type))console.log(JSON.stringify({case:c.id,type:e.type,status:e.status,tool:e.tool,phase:e.phase,message:e.message?.slice?.(0,180)}));}}}catch(e){error=e.message;}
 const m=envelope.message||{},r={...c,elapsedMs:Date.now()-started,error,status:events.findLast(e=>e.type==='message_stream_complete')?.status,metadata:m.metadata,spec:m.metadata?.card_spec,source:m.metadata?.validated_source||m.content?.parts?.join('')||'',events,stitchId:jobs.find(j=>j.caseId===c.id)?.id};
 await writeFile(ROOT+'/'+c.id+'.json',JSON.stringify(r,null,2));await writeFile(DEST+'/runs/'+c.id+'.json',JSON.stringify(r));console.log('FINISH '+JSON.stringify({id:c.id,seconds:r.elapsedMs/1000,status:r.status,spec:!!r.spec,error}));
}
for(const job of jobs){job.final=await fetch(base+'/api/stitch-comparisons/'+job.id).then(r=>r.json());}
await writeFile(ROOT+'/stitch-jobs.json',JSON.stringify(jobs,null,2));console.log('ALL_GENERATED');
