// Conversation display/persistence stays intact. Model context uses recent,
// complete successful examples; rejected programs must not become templates.
export function generationHistory(messages,format,userText,sourceForTurn){
 const turns=[]
 for(const message of messages){
  if(message.role==='user')turns.push([message])
  else if(message.format===format&&turns.length)turns.at(-1).push(message)
 }
 const chosen=[];let budget=20000
 for(const turn of turns.slice(-3).reverse()){
  const pair=[{role:'user',content:String(turn[0].content).slice(0,4000)}]
  const assistant=turn.findLast(m=>m.role==='assistant')
  if(assistant){
   const source=sourceForTurn(assistant),errors=(assistant.phases||[]).flatMap(p=>p.message?.metadata?.diagnostics||[]).filter(d=>d.severity==='error')
   if(assistant.status==='succeeded'&&!errors.length&&source&&source.length+200<=budget-pair[0].content.length)pair.push({role:'assistant',content:JSON.stringify({status:'completed',purpose:'历史参考，任务已结束。仅在新请求明确要求修改此卡时复用；不要继续修复此卡。',source})})
   else pair.push({role:'assistant',content:assistant.status==='succeeded'?'上一张卡片已完成；源码未纳入上下文。':'上一项任务已结束且未完成。失败草稿及修复指令不延续到新请求。'})
  }
  const size=pair.reduce((n,m)=>n+m.content.length,0)
  if(size>budget)break
  budget-=size;chosen.unshift(...pair)
 }
 return [...chosen,{role:'user',content:userText}]
}
