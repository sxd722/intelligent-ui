import {writeFile,mkdir} from 'node:fs/promises'
const base='http://127.0.0.1:8787',out='artifacts/webgpu-material';await mkdir(out,{recursive:true})
const start=Date.now()
const res=await fetch(base+'/api/chat',{method:'POST',headers:{'content-type':'application/json',origin:base},signal:AbortSignal.timeout(180000),body:JSON.stringify({format:'cardspec',mode:'direct',renderMode:'native',modelProfile:'deepseek-flash',toolsEnabled:false,debugGeneration:false,expressionDialect:'js-v1',messages:[{role:'user',content:'制作一张高级流动金属材质实验卡。使用原生 gpu-material 主视觉，自行编写 WGSL 片段函数体；一个原生滑块绑定 params.x 控制材质变化，一个开关控制动画。精简标题和一句说明，不需要工具、图片、沙箱或后续页面。'}]})})
const raw=await res.text();await writeFile(out+'/generation-trace.sse',raw)
const events=raw.split('\n').filter(x=>x.startsWith('data: ')&&x!=='data: [DONE]').map(x=>{try{return JSON.parse(x.slice(6))}catch{return {}}})
const specs=[];function walk(x){if(!x||typeof x!=='object')return;if(x.card_spec)specs.push(x.card_spec);for(const v of Object.values(x))if(typeof v==='object')walk(v)}events.forEach(walk)
const spec=specs.at(-1);if(spec)await writeFile(out+'/generated-spec.json',JSON.stringify(spec,null,2))
const result={elapsedMs:Date.now()-start,http:res.status,completion:events.find(x=>x.type==='message_stream_complete'),spec:!!spec,errors:events.filter(x=>x.type==='stream_error')};await writeFile(out+'/generation-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!spec)process.exitCode=1
