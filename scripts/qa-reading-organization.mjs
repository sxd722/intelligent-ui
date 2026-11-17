import fs from 'node:fs/promises'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const root='artifacts/reading-organization-qa',base='http://127.0.0.1:8787'
await fs.mkdir(root,{recursive:true})
const previous=JSON.parse(await fs.readFile('artifacts/rsi-journal/9ac1d92c-ed59-482c-810c-62cc8ade0a45/record.json','utf8'))
const cases=[
 {id:'journey',prompt:previous.prompt,tools:true},
 {id:'systems',tools:false,prompt:'制作一张原生CardSpec计算机系统复习卡，完整长页，偏专业编辑式设计。\n### CUJ-1【必需】选择主题后改变案例集合和解释，不只改变标题。\n### CUJ-2【必需】选择案例，比较机制与常见误解；展开详情看到额外具体例子；返回主题保留选择，刷新恢复。\n固定教学材料：并发主题包含互斥锁（保护临界区，误解是锁越多越快；例子：两个线程同时修改计数器时需要保护读改写整个过程）和死锁（形成循环等待，误解是等待等于死锁；例子：线程A持有锁1等锁2，线程B持锁2等锁1）；缓存主题包含命中（复用已有数据，误解是缓存总是最新；例子：后端修改后客户端旧缓存须失效）和局部性（近期或相邻访问可能复用，误解是所有随机访问都命中；例子：顺序遍历数组与随机跳跃的区别）。不要新增事实或外部查询，不使用sandbox或图片，重点测试主题-案例-解释关系与原生布局。'}
]
for(const c of cases){
 if(process.env.QA_CASE&&process.env.QA_CASE!==c.id)continue
 const dir=`${root}/${c.id}`;await fs.mkdir(dir,{recursive:true})
 const request={messages:[{role:'user',content:c.prompt}],format:'cardspec',mode:'direct',modelProfile:'gpt-instant',cardSize:'full',renderMode:c.tools?'web':'native',expressionDialect:'js-v1',debugGeneration:true,extendedGeneration:true,toolsEnabled:c.tools,stitchComparison:false,turnId:`reading-${c.id}-${Date.now()}`}
 const envelope={},apply=createDeltaApplier(),events=[],start=Date.now();let error
 await fs.writeFile(dir+'/request.json',JSON.stringify(request,null,2));console.log('start',c.id)
 try{
  const response=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(request),signal:AbortSignal.timeout(360000)})
  if(!response.ok)throw Error('HTTP '+response.status)
  let buf='';const decoder=new TextDecoder()
  for await(const chunk of response.body){buf+=decoder.decode(chunk,{stream:true});let i;while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i);buf=buf.slice(i+1);if(!line.startsWith('data:')||line.slice(5).trim()==='[DONE]')continue;const e=JSON.parse(line.slice(5));events.push(e);if(!isControlEvent(e))apply.apply(envelope,e);if(['research','debug','cardplan','stream_error'].includes(e.type))console.log(c.id,e.type,e.tool||e.phase||'',e.status||'');await fs.appendFile(dir+'/trace.jsonl',JSON.stringify(e)+'\n')}}
 }catch(e){error=e.message}
 const meta=envelope.message?.metadata||{},result={case:c.id,elapsedMs:Date.now()-start,error,status:events.findLast(e=>e.type==='message_stream_complete')?.status,spec:meta.card_spec,deck:meta.card_deck||[],source:meta.validated_source||envelope.message?.content?.parts?.join(''),events}
 await fs.writeFile(dir+'/result.json',JSON.stringify(result,null,2));if(result.source)await fs.writeFile(dir+'/card.cardspec',result.source)
 console.log('done',c.id,result.status,result.elapsedMs,error||'')
}
