import {writeFile} from 'node:fs/promises'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const cases=[
 {id:'greenhouse',prompt:'做一个温室升温模拟器，用局部 logic 处理本地规则：初始20度，可调加热功率，宿主播放/暂停/单步，温度随步数变化并用图表展示，达到目标后有明确反馈；可保存当前方案的快照继续试算，旧快照不能变化。无需真实数据、图片或背景。'},
 {id:'order',prompt:'做一个三步采购预算演练，用局部 logic 处理多步规则：选数量和单价，下一步计算总价并确认，最后保存独立收据；可返回改输入，旧收据不随输入改变。显示当前步骤和数值变化，不执行真实购买。不需要图片或背景。'}
]
await Promise.all(cases.map(async c=>{
 const started=Date.now(),frames=[],envelope={},applier=createDeltaApplier();let buffer=''
 const response=await fetch('http://127.0.0.1:8787/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:8787'},body:JSON.stringify({messages:[{role:'user',content:c.prompt}],format:'cardspec',mode:'direct',cardSize:'auto',toolsEnabled:false}),signal:AbortSignal.timeout(190000)})
 const decoder=new TextDecoder()
 for await(const bytes of response.body){buffer+=decoder.decode(bytes,{stream:true});let n;while((n=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,n).trim();buffer=buffer.slice(n+1);if(!line.startsWith('data:'))continue;const data=line.slice(5).trim();if(data==='[DONE]')continue;const f=JSON.parse(data);frames.push(f);if(!isControlEvent(f))applier.apply(envelope,f)}}
 const result={...c,elapsedMs:Date.now()-started,status:frames.findLast(f=>f.type==='message_stream_complete')?.status,metadata:envelope.message?.metadata,source:envelope.message?.content?.parts?.[0],frames}
 await writeFile(`artifacts/logic-qa/${c.id}.json`,JSON.stringify(result,null,2))
 console.log(JSON.stringify({id:c.id,status:result.status,elapsedMs:result.elapsedMs,repairs:result.metadata?.repair_count}))
}))
