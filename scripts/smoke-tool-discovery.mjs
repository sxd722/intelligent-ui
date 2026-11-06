import {writeFile} from 'node:fs/promises'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const prompt='杭州现在冷不冷？查询真实当前天气，做一张简洁卡片显示温度、天气和手动刷新按钮。不需要图片或额外下一页。'
const started=Date.now(),frames=[],envelope={},applier=createDeltaApplier(),decoder=new TextDecoder()
const response=await fetch('http://127.0.0.1:8787/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:prompt}],format:'cardspec',mode:'direct',toolsEnabled:true,debugGeneration:false,renderMode:'native',expressionDialect:'js-v1'}),signal:AbortSignal.timeout(180000)})
if(!response.ok)throw Error('generation HTTP '+response.status)
let buffer=''
for await(const chunk of response.body){buffer+=decoder.decode(chunk,{stream:true});let boundary;while((boundary=/\r?\n\r?\n/.exec(buffer))){const block=buffer.slice(0,boundary.index);buffer=buffer.slice(boundary.index+boundary[0].length);for(const line of block.split('\n')){if(!line.startsWith('data:')||line.slice(5).trim()==='[DONE]')continue;const frame=JSON.parse(line.slice(5));frames.push(frame);if(!isControlEvent(frame))applier.apply(envelope,frame)}}}
const source=envelope.message?.content?.parts?.[0]||'',spec=envelope.message?.metadata?.card_spec
const result={prompt,elapsedMs:Date.now()-started,status:frames.findLast(f=>f.type==='message_stream_complete')?.status,reads:spec?.prefetched?.map(r=>({tool:r.tool,input:r.input,count:r.value?.items?.length})),refreshBindingReferenced:/bindings\./.test(source),scope:'真实生成/取数/编译冒烟；binding引用静态检查，不等于浏览器交互通过',source,frames,envelope}
await writeFile('artifacts/tool-discovery-qa/generation-smoke-final.json',JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,elapsedMs:result.elapsedMs,reads:result.reads,refreshBindingReferenced:result.refreshBindingReferenced,discovery:frames.filter(f=>f.type==='tool_disclosure')}))
