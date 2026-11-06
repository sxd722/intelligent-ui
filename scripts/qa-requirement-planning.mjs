import {readFile,mkdir,writeFile,appendFile} from 'node:fs/promises'
const name=process.argv[2]||'game'
const goals={
 game:await readFile('tests/fixtures/requirements-game.md','utf8'),
 budget:`# 两天旅行预算实验台
## 目标
做一个可玩的预算规划器，使用明确标注的本地样例，不查询真实价格。
## 用户旅程
1. 调整人数、总预算与住宿档位，实时重新计算花费。
2. 多选三个候选活动中的任意几个，候选标明价格和时长；显示选中活动的总费用。
3. 切换两天行程与费用分布视图，保持选中活动、人数和预算。
4. 超预算时显示差额，并可取消活动观察差额下降；重置恢复初始选择。
## 边界情况
没有选活动、预算低于住宿费都可继续操作。
## 可选建议
保存旅行相册不是本轮要求。`,
 learning:`# 缓存替换互动课堂
## 目标
解释容量为3的缓存如何使用FIFO或LRU策略，样例访问序列为A B C A D B。
## 用户旅程
1. 显示三格缓存、当前访问对象、命中与未命中次数。
2. 点击单步推进，格子、计数及本步解释同步改变；可重置。
3. 切换FIFO/LRU后从头重放相同序列，观察最终格子和命中率差异。
4. 在揭晓下一步前，选择命中/未命中进行预测，揭晓时显示答对与否并解释。
## 边界情况
序列结束后禁用推进，重置清除预测和计数；不自动请求新题。
## 可选建议
外部资料搜索、登录和排行榜暂不需要。`
}
if(!goals[name])throw Error('unknown case')
const mode=process.argv[3]||(name==='game'?'web':'native')
const dir=`artifacts/requirement-planning-qa/${name}${process.argv[3]?'-'+mode:''}`;await mkdir(dir,{recursive:true})
const payload={messages:[{role:'user',content:goals[name]}],format:'cardspec',mode:'direct',buildMode:'deep',modelProfile:'default',cardSize:name==='game'?'full':'auto',renderMode:mode,debugGeneration:true,extendedGeneration:name==='game',expressionDialect:'js-v1',toolsEnabled:name==='game',generationProfile:'adaptive-v1'}
await writeFile(dir+'/request.json',JSON.stringify(payload,null,2))
await writeFile(dir+'/stream.sse','');const start=Date.now();let buffer='',metadata={},spec,source,error,status,requestId
try{
 const response=await fetch('http://127.0.0.1:8787/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(1200000)})
 const decoder=new TextDecoder()
 for await(const chunk of response.body){
  const text=decoder.decode(chunk,{stream:true});await appendFile(dir+'/stream.sse',text);buffer+=text
  let end;while((end=buffer.indexOf('\n\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+2);if(!line.startsWith('data:'))continue;let event;try{event=JSON.parse(line.slice(5).trim())}catch{continue}
   if(event.requestId)requestId=event.requestId
   if(event.type==='build_progress')console.log(name,Math.round((Date.now()-start)/1000),event.message)
   if(event.type==='stream_error')error=event.error
   if(event.type==='server_ste_metadata')metadata=event.metadata
   if(event.type==='message_stream_complete')status=event.status
   for(const op of event.o==='patch'?event.v:[]){if(op.p==='/message/metadata'&&op.v?.card_spec)spec=op.v.card_spec;if(op.p==='/message/metadata'&&op.v?.validated_source)source=op.v.validated_source}
  }
 }
}catch(e){error={message:e.message};status='failed'}
if(spec)await writeFile(dir+'/spec.json',JSON.stringify(spec,null,2))
if(source)await writeFile(dir+'/source.cardspec',source)
const summary={name,requestId,status,error,elapsedMs:Date.now()-start,metadata,cardId:spec?.cardId}
await writeFile(dir+'/summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary))
