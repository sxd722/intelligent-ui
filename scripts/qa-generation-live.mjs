import {mkdir,writeFile} from 'node:fs/promises'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const out='artifacts/generation-refactor-qa/live';await mkdir(out,{recursive:true})
for(const [id,prompt]of[
 ['trains','请在生成前实际用OpenCLI查询2026-10-16杭州东到上海南下午12:00–18:00的车次（仅只读）。按真实返回结果制作分组筛选与选择详情卡，collection优先；不要把真实查询推迟到点击后，不编造车次。如果没有结果，如实显示范围。'],
 ['movies','请先实际用OpenCLI获取豆瓣Top250前6部电影，然后用collection制作有海报（仅来源有图才显示）的选片卡，规划两个基于当前选择的后续交互。先取得数据再生成；读取失败如实显示，不改用虚构榜单。']]){
 const started=Date.now(),frames=[],state={},apply=createDeltaApplier();let buffer='';const decoder=new TextDecoder()
 try{const response=await fetch('http://127.0.0.1:8787/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({format:'cardspec',mode:'direct',messages:[{role:'user',content:prompt}]}),signal:AbortSignal.timeout(330000)})
 for await(const bytes of response.body){buffer+=decoder.decode(bytes,{stream:true});let end;while((end=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);for(const line of block.split('\n')){if(!line.startsWith('data:'))continue;const raw=line.slice(5).trim();if(raw==='[DONE]')continue;const f=JSON.parse(raw);frames.push(f);if(!isControlEvent(f))apply.apply(state,f)}}}
 }catch(e){frames.push({type:'qa_error',error:e.message})}
 const result={id,elapsed:Date.now()-started,status:frames.findLast(f=>f.type==='message_stream_complete')?.status,tools:frames.filter(f=>f.type==='research'),error:frames.findLast(f=>f.type==='stream_error')?.error}
 await writeFile(`${out}/${id}.json`,JSON.stringify({result,message:state.message,frames},null,2));console.log(JSON.stringify(result))
}
