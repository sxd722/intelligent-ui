import fs from 'node:fs/promises'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const root='artifacts/reading-navigation-qa',base='http://127.0.0.1:8787'
await fs.mkdir(root,{recursive:true})
const previous=JSON.parse(await fs.readFile('artifacts/rsi-journal/9ac1d92c-ed59-482c-810c-62cc8ade0a45/record.json','utf8'))
const cases=[
 {id:'compact',tools:true,prompt:'西游记所描述的妖魔鬼怪和现实的古代社会有什么映射，有没有可以读的深度解析？制作原生阅读卡，保留官僚庇护、地方统治、宗教资源、人性偏见几种视角。先展示主题与当前相关案例，核心结论一句；进入案例后用事实/解释/边界对照，继续进入书内证据。以具体情节为证据，不给静态长文章或重复每个案例。CUJ-1：主题改变案例集合和解释；CUJ-2：选择案例，进入具名解读目的地再查阅证据，书内检索随选择改变关键词，空结果允许修改关键词并打开原著。CUJ-3：返回、刷新保留主题与选择。用WeRead真实检索，优先查询已取得的《西游记》人民文学版bookId 34631845；车迟国、通天河为已成功检索关键词，青牛精/白骨精原词可能为空。来源未给出的章节和解释不要声称已核实。图谱可选，只在表达真实关系时使用。'},
 {id:'systems',tools:false,prompt:'制作原生计算机系统复习卡：先选择并发或缓存，再选择案例，进入解读比较机制与误解，再进入具体例子。不把四例全文同时展示。CUJ-1：主题改变案例；CUJ-2：详情与具体例子有新增内容；CUJ-3：返回与刷新恢复选择。固定材料：互斥锁保护临界区，误解是锁越多越快，例子是两个线程同时修改计数器需要保护读改写；死锁是循环等待而非普通等待，例子是两个线程各持一锁等另一锁；命中是复用已有数据而非保证最新，例子是后端修改后旧缓存需要失效；局部性是近期或相邻访问可能复用而非所有随机访问命中，例子是顺序遍历与随机跳跃。不要新增事实或查询。'}
]
for(const c of cases){
 if(process.env.QA_CASE&&process.env.QA_CASE!==c.id)continue
 const dir=`${root}/${c.id}`;await fs.mkdir(dir,{recursive:true})
 const request={messages:[{role:'user',content:c.prompt}],format:'cardspec',mode:'direct',modelProfile:'gpt-instant',cardSize:'full',contentMode:'guided',renderMode:'native',expressionDialect:'js-v1',debugGeneration:true,extendedGeneration:false,toolsEnabled:c.tools,stitchComparison:false,turnId:`reading-navigation-${c.id}-${Date.now()}`}
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
