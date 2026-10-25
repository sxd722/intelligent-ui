import {mkdir,writeFile} from 'node:fs/promises'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const base=process.env.QA_BASE||'http://127.0.0.1:8787',name=process.env.QA_NAME||'live';const out='artifacts/sandbox-inline';await mkdir(out,{recursive:true})
const prompt='做一张紧凑的SVG储能实验卡。原生滑块控制能量0到100，React sandbox显示能量流动动画和数值，点图形内的充能按钮让共享值增加10。再用沙箱局部状态记录观察次数。所有内容在首轮生成，不调用工具或额外GLM，不要原生fallback。保持两种交互，使用内联CSS和export styles，不用Tailwind。'
const started=Date.now(),frames=[],state={},apply=createDeltaApplier();let buffer='';const decoder=new TextDecoder()
try{const response=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({format:'cardspec',mode:'direct',generationProfile:'legacy',renderMode:'hybrid',debugGeneration:false,messages:[{role:'user',content:prompt}]}),signal:AbortSignal.timeout(300000)})
 for await(const bytes of response.body){buffer+=decoder.decode(bytes,{stream:true});let end;while((end=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);for(const line of block.split('\n')){if(!line.startsWith('data:'))continue;const raw=line.slice(5).trim();if(raw==='[DONE]')continue;const f=JSON.parse(raw);frames.push(f);if(!isControlEvent(f))apply.apply(state,f)}}}
}catch(e){frames.push({type:'qa_error',error:e.message})}
const result={elapsedMs:Date.now()-started,status:frames.findLast(f=>f.type==='message_stream_complete')?.status,error:frames.findLast(f=>f.type==='stream_error')?.error,metadata:frames.findLast(f=>f.type==='server_ste_metadata')?.metadata,modules:Object.keys(state.message?.metadata?.card_spec?.sandboxModules||{})}
await writeFile(`${out}/${name}.json`,JSON.stringify({result,message:state.message,frames},null,2));console.log(JSON.stringify(result));if(result.status!=='succeeded'||!result.modules.length)process.exitCode=1
