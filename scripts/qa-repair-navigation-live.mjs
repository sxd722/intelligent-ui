import {mkdir,writeFile} from 'node:fs/promises'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
import {generationHistory} from '../src/generation-history.mjs'
const out='artifacts/repair-navigation';await mkdir(out,{recursive:true});const messages=[],results=[]
for(const prompt of ['做一张喝水计数器，标题“饮水实验”，显示杯数和增加、重置两个按钮。无工具，不使用沙箱。','做一张全新的旅行预算试算卡，标题“旅行预算”，滑块设置天数，显示每天200元的总费用。与饮水无关，不要修复或沿用上一张卡。']){
 const started=Date.now(),frames=[],state={},apply=createDeltaApplier();let buffer='';const decoder=new TextDecoder()
 const response=await fetch('http://127.0.0.1:8787/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({format:'cardspec',mode:'direct',generationProfile:'adaptive-v1',renderMode:'native',debugGeneration:true,toolsEnabled:false,messages:generationHistory(messages,'cardspec',prompt,m=>m.source)}),signal:AbortSignal.timeout(900000)})
 for await(const bytes of response.body){buffer+=decoder.decode(bytes,{stream:true});let end;while((end=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);for(const line of block.split('\n')){if(!line.startsWith('data:'))continue;const raw=line.slice(5).trim();if(raw==='[DONE]')continue;const f=JSON.parse(raw);frames.push(f);if(!isControlEvent(f))apply.apply(state,f)}}}
 const result={prompt,elapsedMs:Date.now()-started,status:frames.findLast(f=>f.type==='message_stream_complete')?.status,error:frames.findLast(f=>f.type==='stream_error')?.error,metadata:frames.findLast(f=>f.type==='server_ste_metadata')?.metadata}
 messages.push({role:'user',content:prompt},{role:'assistant',format:'cardspec',status:result.status,source:state.message?.metadata?.validated_source,phases:[{message:state.message}]})
 results.push(result);await writeFile(`${out}/live-${results.length}.json`,JSON.stringify({result,message:state.message,frames},null,2));console.log(JSON.stringify(result))
 if(result.status!=='succeeded'){process.exitCode=1;break}
 if(results.length===2&&(!state.message.metadata.validated_source.includes('旅行预算')||state.message.metadata.validated_source.includes('饮水实验')))throw Error('Fresh task source contamination')
}
await writeFile(`${out}/live-summary.json`,JSON.stringify(results,null,2))
