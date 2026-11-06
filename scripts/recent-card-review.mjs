import fs from 'node:fs/promises';
import vm from 'node:vm';
import {build} from 'esbuild';
const root='artifacts/recent-card-review',dest='dist/recent-card-review';
await fs.mkdir(root,{recursive:true});await fs.mkdir(dest+'/runs',{recursive:true});
const cases=[['transformer','bce11196-db60-4a5d-8b4f-82749ffb4653'],['antarctica','5edd5443-5f4f-41a1-b598-67b5b0bb1a8d'],['mag7','6bc6be18-5e70-4430-9543-c48653cc8669'],['election-step','f7a1f2dd-5d89-4df7-aaba-1aca703e4165'],['election-rebind','1b715211-7382-4162-88d0-158b738da19d'],['election','956f2dac-ba97-407d-87ee-d64f911adef0'],['election-failed','bf9d3527-8582-4843-9e9a-d383f3079d67'],['rail','d9e07ac3-9632-4849-9228-8ee2b76b2de1'],['greek','edbfe596-560b-4e06-88c1-daf1bce78709'],['greek-earlier','1afb6b3a-73ae-449d-8f75-d025e5c7d88a']];
const records=[];
for(const [name,id]of cases){const r=JSON.parse(await fs.readFile(`artifacts/rsi-adaptive/runs/${id}.json`,'utf8')),a=r.artifacts[0];records.push({name,id,createdAt:r.createdAt,model:a.spec?.context?.modelProfile||r.profiles,goal:r.goal,compiled:!!a.spec,status:a.status,modelCalls:r.budget.modelCalls,researchReads:r.budget.reads,repairs:r.budget.repairs,elapsedMs:r.budget.elapsedMs,sourceChars:a.source?.length,bindings:(a.source?.match(/<binding\b/g)||[]).length,gate:a.gate});await fs.writeFile(root+'/'+name+'.cardspec',a.source||'');if(['transformer','greek'].includes(name))await fs.writeFile(dest+'/runs/'+name+'.json',JSON.stringify({id:name,title:name+' · 原始 LLM 产物重放',prompt:r.goal,source:a.source,spec:a.spec,status:'succeeded'}));}
await fs.writeFile(root+'/runs.json',JSON.stringify(records,null,2));
const source=await fs.readFile(root+'/transformer.cardspec','utf8');
const start=source.indexOf('const TOKENS='),end=source.indexOf('const INK=');
const numeric=vm.runInNewContext(source.slice(start,end)+`;({normal:compute(1),large:compute(2)})`,{}, {timeout:1000});
const n={selectedToken:'The',clickedRow:'cat',clickedColumn:'The',clickedValue:numeric.normal.att[1][0],displayedValueFromSelectedRow:numeric.normal.att[0][0],nonlinearEffectInAllowedRange:[.5,1,2].map(scale=>{const r=vm.runInNewContext(source.slice(start,end)+`;compute(${scale})`,{}, {timeout:1000});return {scale,reluChanged:r.h.some((row,i)=>row.some((v,j)=>v!==r.res1[i][j])),outputExactlyDoubleResidual:r.out.every((row,i)=>row.every((v,j)=>v===2*r.res1[i][j]))}})};
await fs.writeFile(root+'/numeric-evidence.json',JSON.stringify(n,null,2));
await build({entryPoints:['scripts/complex-live-cuj/viewer.jsx'],bundle:true,jsx:'automatic',format:'esm',platform:'browser',outfile:dest+'/viewer.js',define:{'process.env.NODE_ENV':'"production"'},loader:{'.woff2':'file','.ttf':'file','.woff':'file','.png':'file'},logLevel:'error'});
let html=await fs.readFile('dist/folio-design/viewer.html','utf8');await fs.writeFile(dest+'/viewer.html',html.replace('图片先行头部回归','近期 LLM 卡片原始产物重放'));
console.log({runs:records.length,compiled:records.filter(r=>r.compiled).length,numeric:n});
